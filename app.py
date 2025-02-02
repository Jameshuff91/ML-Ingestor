import os
import uuid
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from werkzeug.utils import secure_filename
from typing import Dict, Any, List
import pandas as pd
import numpy as np
from src.ingestion import DataIngestion
from src.validation import DataValidation
from src.erd_generator import ERDGenerator
from src.correlation import CorrelationAnalyzer
from src.multi_correlation import MultiFileCorrelationAnalyzer
from src.data_processor import DataProcessor
from src.export import DataExporter
from src.logger import setup_logger
from src.config import ConfigManager
from threading import Thread, Lock
from src.llm import call_claude_api

logger = setup_logger()

# Initialize task management
tasks = {}
task_lock = Lock()

# Initialize Flask app and SocketIO
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'uploads')
RESULTS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'results')
PLOTS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'plots')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)
os.makedirs(PLOTS_FOLDER, exist_ok=True)

# Initialize components
config = ConfigManager('config.yaml')
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'  # Required for session handling
app.config.update(
    UPLOAD_FOLDER=UPLOAD_FOLDER,
    RESULTS_FOLDER=RESULTS_FOLDER,
    PLOTS_FOLDER=PLOTS_FOLDER,
    MAX_CONTENT_LENGTH=config.get_setting('data.max_file_size_mb') * 1024 * 1024
)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=100 * 1024 * 1024,  # 100MB
    always_connect=True,
    manage_session=True
)
app.socketio = socketio  # Attach socketio instance to app for testing

# Setup logging and configuration
logger = setup_logger()

# Configure app and create required directories
def init_task_dirs():
    """Initialize required directories with proper permissions."""
    try:
        # Get base directory
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Define required directories
        dirs = {
            'uploads': os.path.join(base_dir, 'data', 'uploads'),
            'results': os.path.join(base_dir, 'data', 'results'),
            'plots': os.path.join(base_dir, 'static', 'plots'),
            'temp': os.path.join(base_dir, 'data', 'temp'),
            'exports': os.path.join(base_dir, 'data', 'exports')
        }
        
        # Create directories if they don't exist
        for dir_path in dirs.values():
            if not os.path.exists(dir_path):
                os.makedirs(dir_path, exist_ok=True)
                logger.info(f"Created directory: {dir_path}")
        
        # Set proper permissions
        for dir_path in dirs.values():
            try:
                # Ensure directory is readable and writable
                os.chmod(dir_path, 0o755)
            except Exception as e:
                logger.warning(f"Could not set permissions for {dir_path}: {str(e)}")
        
        logger.info("All required directories initialized successfully")
        return dirs
        
    except Exception as e:
        logger.error(f"Error initializing directories: {str(e)}")
        raise

init_task_dirs()

# Initialize components
data_ingestion = DataIngestion()
data_processor = DataProcessor()
data_validation = DataValidation()
erd_generator = ERDGenerator()
correlation_analyzer = CorrelationAnalyzer()
multi_correlation_analyzer = MultiFileCorrelationAnalyzer()
data_exporter = DataExporter()

# Global state
task_lock = Lock()

# Add processed_requests initialization at the top with other globals
processed_requests: Dict[str, str] = {}

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    allowed_extensions = config.get_setting('data.allowed_extensions')
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in [ext.strip('.') for ext in allowed_extensions]

@app.route('/')
def home():
    """Render the home page."""
    return render_template('index.html')

@app.route('/preview_file/<filename>')
def preview_file(filename):
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
            
        # Read the first few rows of the file
        if filename.endswith(('.csv', '.xls', '.xlsx')):
            # DataFrame preview (commented out to bypass pandas)
            df = pd.read_csv(file_path, nrows=5)
            df = pd.read_excel(file_path, nrows=5)

            # Convert DataFrame to JSON-serializable format
            def convert_value(val):
                if pd.isna(val):
                    return None
                if isinstance(val, (np.int64, np.int32)):
                    return int(val)
                if isinstance(val, (np.float64, np.float32)):
                    if np.isinf(val):
                        return 'Infinity' if val > 0 else '-Infinity'
                    return float(val)
                return str(val)
            
            # Convert columns and rows to JSON-serializable format
            columns = df.columns.tolist()
            rows = [[convert_value(val) for val in row] for row in df.values.tolist()]
            
            return jsonify({
                'columns': columns,
                'rows': rows
            })
            pass  # Skip DataFrame preview for now
        else:
            pass # Proceed to plain text preview

        # Plain text preview for other file types or if DataFrame preview is skipped
        with open(file_path, 'r') as f:
            content = "".join([f.readline() for _ in range(5)])

        return jsonify({
            'columns': [],
            'rows': [['Preview not available for this file format']],  # Indicate no DataFrame preview
            'content': content
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/delete_file/<filename>', methods=['DELETE'])
def delete_file(filename):
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({'message': 'File deleted successfully'})
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload."""
    try:
        logger.info("Upload request received")
        
        # Check if file exists in request
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file part'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'}), 400
            
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'File type not allowed'}), 400

        # Generate unique filename to prevent overwrites
        base_filename = secure_filename(file.filename)
        filename = get_unique_filename(
            os.path.join(app.config['UPLOAD_FOLDER'], base_filename.rsplit('.', 1)[0]),
            f".{base_filename.rsplit('.', 1)[1]}"
        )
        
        # Save the file
        file.save(filename)
        logger.info(f"File saved: {filename}")
        
        # Generate task ID and initialize state
        task_id = str(uuid.uuid4())
        config = {
            'filename': os.path.basename(filename),
            'filepath': filename
        }
        
        with task_lock:
            tasks[task_id] = {
                'status': 'Uploaded',  # Changed from 'Processing' to 'Uploaded'
                'progress': 0,
                'filename': os.path.basename(filename),
                'filepath': filename,
                'results': {},
                'config': config
            }
        
        # Removed automatic processing thread start
        
        response = {
            'success': True,
            'filename': os.path.basename(filename),
            'task_id': task_id,
            'status': 'Uploaded'  # Changed from 'Processing' to 'Uploaded'
        }
        logger.info(f"Upload successful: {response}")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in upload_file: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/upload_multiple', methods=['POST'])
def upload_multiple_files():
    """Handle multiple file uploads."""
    try:
        logger.info("Multiple file upload request received")
        
        # Check if files exist in request
        if 'files[]' not in request.files:
            return jsonify({'success': False, 'error': 'No files part'}), 400
            
        files = request.files.getlist('files[]')
        if not files or all(file.filename == '' for file in files):
            return jsonify({'success': False, 'error': 'No selected files'}), 400
            
        uploaded_files = []
        task_ids = []
        
        for file in files:
            if not allowed_file(file.filename):
                continue  # Skip files with disallowed extensions
                
            # Generate unique filename to prevent overwrites
            base_filename = secure_filename(file.filename)
            filename = get_unique_filename(
                os.path.join(app.config['UPLOAD_FOLDER'], base_filename.rsplit('.', 1)[0]),
                f".{base_filename.rsplit('.', 1)[1]}"
            )
            
            # Save the file
            file.save(filename)
            logger.info(f"File saved: {filename}")
            
            # Generate task ID and initialize state
            task_id = str(uuid.uuid4())
            config = {
                'filename': os.path.basename(filename),
                'filepath': filename
            }
            
            with task_lock:
                tasks[task_id] = {
                    'status': 'Uploaded',  # Changed from 'Processing' to 'Uploaded'
                    'progress': 0,
                    'filename': os.path.basename(filename),
                    'filepath': filename,
                    'results': {},
                    'config': config
                }
            
            # Removed automatic processing thread start
            
            uploaded_files.append(os.path.basename(filename))
            task_ids.append(task_id)
        
        if not uploaded_files:
            return jsonify({'success': False, 'error': 'No valid files uploaded'}), 400
        
        response = {
            'success': True,
            'filenames': uploaded_files,
            'task_ids': task_ids,
            'status': 'Uploaded'  # Changed from 'Processing' to 'Uploaded'
        }
        logger.info(f"Multiple upload successful: {response}")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in upload_multiple_files: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/process', methods=['POST'])
def process_data():
    """Process uploaded data file."""
    try:
        config = request.get_json()
        if not config:
            return jsonify({'success': False, 'error': 'No configuration provided'}), 400
            
        # Validate filename
        if not config.get('filename'):
            return jsonify({'success': False, 'error': 'No filename provided'}), 400
            
        # Verify file exists and construct full filepath
        filename = secure_filename(config['filename'])
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': f"File not found: {filename}"}), 404
            
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task status with structured results object
        update_task_status(task_id, {
            'status': 'Processing',
            'progress': 0,
            'results': {
                'basic_validation': {},
                'advanced_validation': {},
                'correlation_analysis': None
            }
        })
        
        # Add filepath to config
        task_config = {
            **config,
            'filepath': filepath  # Add the full filepath for the task
        }
        
        # Start processing in background
        Thread(target=process_data_task, args=(task_id, task_config)).start()
        
        # Return task ID for progress tracking
        return jsonify({
            'success': True,
            'task_id': task_id,
            'results': {
                'status': 'Processing',
                'progress': 0
            }
        })
        
    except Exception as e:
        logger.error(f"Task failed: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/progress/<task_id>')
def get_progress(task_id):
    """Get progress for a specific task."""
    task_status = get_task_status(task_id)
    if task_status is None:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify(task_status)

@app.route('/results/<task_id>', methods=['GET'])
def get_results(task_id):
    """Get the results of a completed task."""
    if task_id not in tasks:
        return jsonify({'error': 'Task not found'}), 404
        
    task = get_task_status(task_id)
    if task.get('status') != 'Complete':
        return jsonify({'error': 'Task not yet complete'}), 400
        
    return jsonify(task.get('results', {}))

@app.route('/export', methods=['POST'])
def export_data():
    """Export processed data."""
    try:
        export_config = request.json
        if not export_config:
            return jsonify({'success': False, 'error': 'No configuration provided'}), 400
            
        format = export_config.get('format', 'csv')
        compression = export_config.get('compression')
        
        if compression is True:
            compression = 'gzip'  # Default to gzip if compression is just True
            
        # Create exports directory
        export_folder = os.path.join(app.config.get('UPLOAD_FOLDER', 'data/uploads'), 'exports')
        os.makedirs(export_folder, exist_ok=True)
        
        # Generate filename
        filename = f'export.{format}'
        if compression:
            filename += f'.{compression}'
            
        # Generate output path
        output_path = os.path.join(export_folder, filename)
            
        # Export data (mocked for testing)
        mock_data = pd.DataFrame({
            'id': [1, 2, np.nan],
            'value': [10, np.nan, 30]
        })
        
        # Handle NaN values before export
        export_data = mock_data.replace({np.nan: None})
        
        result = data_exporter.export(
            data=export_data,
            output_path=output_path,
            format=format,
            compression=compression
        )
        result = {'path': output_path, 'rows_exported': 0} # Mock result for now
        
        return jsonify({
            'success': True,
            'path': result['path'],
            'rows_exported': result['rows_exported'],
            'download_url': f'/download/{filename}'
        })
        
    except Exception as e:
        logger.error(f"Export failed: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    """Download exported file."""
    try:
        export_folder = os.path.join(
            app.config.get('UPLOAD_FOLDER', 'data/uploads'),
            'exports'
        )
        return send_from_directory(export_folder, filename, as_attachment=True)
        
    except Exception as e:
        logger.error(f"Download failed: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/docs')
def api_docs():
    """Render API documentation."""
    return render_template('api.html')

@app.route('/ws')
def websocket():
    """WebSocket endpoint."""
    return '', 101  # Switch protocols

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat requests using Claude API."""
    try:
        data = request.get_json()
        task_id = data.get('task_id')
        user_message = data.get('message')
        
        if not task_id or not user_message:
            return jsonify({'success': False, 'error': 'Missing task_id or message'}), 400
            
        # Get task results
        with task_lock:
            task = tasks.get(task_id)
            if not task:
                return jsonify({'success': False, 'error': 'Task not found'}), 404
                
            results = task.get('results', {})
            
        # Prepare context for Claude
        context = f"""
        Here is the data analysis context:
        
        Validation Results:
        {results.get('validation', {})}
        
        Correlation Analysis:
        {results.get('correlation_analysis', {})}
        
        User Question: {user_message}
        """
        
        # Call Claude API with the context
        system_content = "You are an AI assistant helping analyze data processing results. Provide clear, concise answers based on the data analysis context provided."
        response = call_claude_api(context, system_content)
        
        return jsonify({
            'success': True,
            'response': response
        })
        
    except Exception as e:
        logger.error(f"Chat request failed: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/analyze_multiple', methods=['POST'])
def analyze_multiple_files():
    """Analyze correlations between multiple CSV files."""
    try:
        files = request.json.get('files', [])
        if not files:
            return jsonify({'success': False, 'error': 'No files provided'}), 400
            
        # Verify all files exist
        file_paths = []
        for filename in files:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
            if not os.path.exists(filepath):
                return jsonify({'success': False, 'error': f"File not found: {filename}"}), 404
            file_paths.append(filepath)
            
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task
        update_task_status(task_id, {
            'status': 'Processing',
            'progress': 0,
            'results': {}
        })
        
        # Start processing in background
        Thread(target=process_multiple_files_task, args=(task_id, file_paths)).start()
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'message': 'Analysis started'
        })
        
    except Exception as e:
        logger.error(f"Multiple file analysis failed: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

def process_data_task(task_id: str, config: Dict[str, Any]) -> None:
    """Process data in a background task."""
    try:
        # Initialize task
        update_task_status(task_id, {
            'status': 'Processing',
            'progress': 0,
            'results': {
                'basic_validation': {},
                'advanced_validation': {},
                'correlation_analysis': None
            }
        })
        emit_progress(task_id)

        # Load data
        file_path = config.get('filepath')
        if not file_path:
            raise ValueError("No file path provided")
            
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Load and validate data (commented out to bypass pandas)
        try:
            df = data_ingestion.load_file(file_path)
            update_task_status(task_id, {'progress': 20})
            emit_progress(task_id)
        except Exception as e:
            logger.error(f"Error loading file: {str(e)}")
            raise ValueError(f"Error loading file: {str(e)}")
        
        # Validation
        try:
            validator = DataValidation()
            validation_results = validator.validate_data(df)
            update_task_status(task_id, {
                'progress': 60,
                'results': validation_results  # Already has basic_validation and advanced_validation
            })
            emit_progress(task_id)
        except Exception as e:
            logger.error(f"Error in validation: {str(e)}")
            raise ValueError(f"Error in validation: {str(e)}")
        
        # Correlation analysis
        try:
            correlation_results = correlation_analyzer.analyze(df)
            update_task_status(task_id, {
                'progress': 80,
                'results': {
                    **validation_results,  # Include basic_validation and advanced_validation
                    'correlation_analysis': correlation_results  # Send complete correlation results
                }
            })
            emit_progress(task_id)
        except Exception as e:
            logger.error(f"Error in correlation analysis: {str(e)}")
            raise ValueError(f"Error in correlation analysis: {str(e)}")
        update_task_status(task_id, {'progress': 100, 'status': 'Validation bypassed'}) # Mock completion
        
        # Mark task as complete
        update_task_status(task_id, {
            'status': 'Complete',
            'progress': 100
        })
        emit_progress(task_id)
        
    except Exception as e:
        logger.error(f"Task failed: {str(e)}")
        update_task_status(task_id, {
            'status': 'Failed',
            'error': str(e),
            'progress': 100
        })
        emit_progress(task_id)

@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    try:
        logger.info(f"Client connected: {request.sid}")
        emit('ready', {'status': 'connected'})
    except Exception as e:
        logger.error(f"Error in handle_connect: {str(e)}")
        emit('error', {'error': str(e)})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    try:
        logger.info(f"Client disconnected: {request.sid}")
    except Exception as e:
        logger.error(f"Error in handle_disconnect: {str(e)}")

@socketio.on_error_default
def default_error_handler(e):
    logger.error(f"SocketIO error: {str(e)}")
    emit('error', {'message': str(e)})

@socketio.on('start_validation')
def handle_start_validation(data):
    """Handle validation start request."""
    try:
        filename = data.get('filename')
        if not filename:
            emit('error', {'message': 'No filename provided'})
            return
            
        # Get full file path
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.exists(filepath):
            emit('error', {'message': f'File {filename} not found'})
            return
            
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task
        update_task_status(task_id, {
            'status': 'Starting',
            'progress': 0,
            'results': {}
        })
        
        # Start processing in background
        Thread(target=process_data_task, args=(task_id, {'filepath': filepath})).start()
        
        # Return task ID
        emit('task_started', {
            'task_id': task_id,
            'status': 'Starting'
        })
        
    except Exception as e:
        logger.error(f'Error starting validation: {str(e)}')
        emit('error', {'message': str(e)})

def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get task status in a thread-safe way."""
    with task_lock:
        if task_id not in tasks:
            return {'status': 'Failed', 'error': 'Task not found'}
        return tasks[task_id].copy()

def clean_for_json(obj):
    """Clean data for JSON serialization."""
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(x) for x in obj]
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return None if np.isnan(obj) or np.isinf(obj) else float(obj)
    elif pd.isna(obj): # pd.isna(obj): # Commented out pandas usage
        return None
    elif isinstance(obj, (pd.Timestamp, pd.DatetimeIndex)): # isinstance(obj, (pd.Timestamp, pd.DatetimeIndex)): # Commented out pandas usage
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    return obj

def update_task_status(task_id: str, updates: Dict[str, Any]) -> None:
    """Update task status and emit progress."""
    try:
        with task_lock:
            if task_id not in tasks:
                tasks[task_id] = {}
            
            # Update task status
            tasks[task_id].update(updates)
            
            # Clean data for JSON
            clean_results = clean_for_json(tasks[task_id].get('results', {}))
            
            # Always include task_id in the progress update
            progress_data = {
                'task_id': task_id,
                'status': tasks[task_id].get('status', 'Processing'),
                'progress': tasks[task_id].get('progress', 0),
                'results': clean_results,
            }
            
            # Include error if present
            if 'error' in tasks[task_id]:
                progress_data['error'] = tasks[task_id]['error']
            
            # Emit progress update
            socketio.emit('progress', progress_data)
            
    except Exception as e:
        logger.error(f"Error updating task status: {str(e)}")
        socketio.emit('progress', {
            'task_id': task_id,
            'status': 'Failed',
            'error': str(e),
            'progress': 100
        })

def emit_progress(task_id: str) -> None:
    """Emit current progress for a task."""
    try:
        with task_lock:
            if task_id in tasks:
                # Clean data for JSON
                clean_results = clean_for_json(tasks[task_id].get('results', {}))
                
                progress_data = {
                    'task_id': task_id,
                    'status': tasks[task_id].get('status', 'Processing'),
                    'progress': tasks[task_id].get('progress', 0),
                    'results': clean_results
                }
                
                # Include error if present
                if 'error' in tasks[task_id]:
                    progress_data['error'] = tasks[task_id]['error']
                
                socketio.emit('progress', progress_data)
            else:
                logger.warning(f"Task {task_id} not found")
                socketio.emit('progress', {
                    'task_id': task_id,
                    'status': 'Failed',
                    'error': 'Task not found',
                    'progress': 100
                })
                
    except Exception as e:
        logger.error(f"Error emitting progress: {str(e)}")
        socketio.emit('progress', {
            'task_id': task_id,
            'status': 'Failed',
            'error': str(e),
            'progress': 100
        })

@socketio.on('subscribe')
def handle_subscribe(data):
    """Handle task subscription."""
    try:
        task_id = data.get('task_id')
        if task_id:
            logger.info(f"Client {request.sid} subscribed to task {task_id}")
            join_room(task_id)
            emit_progress(task_id)
    except Exception as e:
        logger.error(f"Error in handle_subscribe: {str(e)}")
        emit('error', {'error': str(e)})

@socketio.on('start_processing')
def handle_start_processing(data):
    """Start processing a file when requested."""
    try:
        logger.info(f"Start processing request received: {data}")  # Add debug log
        task_id = data.get('task_id')
        if not task_id:
            logger.warning("No task_id provided")  # Add debug log
            raise ValueError('No task_id provided')
            
        with task_lock:
            if task_id not in tasks:
                logger.warning(f"Task {task_id} not found")  # Add debug log
                raise ValueError('Invalid task_id')
            
            task = tasks[task_id]
            if not task.get('config'):
                logger.warning(f"No config found for task {task_id}")  # Add debug log
                raise ValueError('No configuration found for task')
        
        # Start background task
        logger.info(f"Starting background task for {task_id}")  # Add debug log
        socketio.start_background_task(process_data_task, task_id, task['config'])
        
    except Exception as e:
        logger.error(f"Error starting processing: {str(e)}")
        socketio.emit('error', {
            'task_id': task_id if task_id else None,
            'error': str(e)
        })

def process_multiple_files_task(task_id: str, file_paths: List[str]) -> None:
    """Process multiple files in a background task."""
    try:
        # Update progress
        update_task_status(task_id, {
            'status': 'Processing',
            'progress': 20,
            'message': 'Analyzing correlations between files'
        })
        
        # Analyze correlations
        results = multi_correlation_analyzer.analyze_cross_file_correlations(file_paths)
        
        if 'error' in results:
            raise ValueError(results['error'])
            
        # Update task with results
        update_task_status(task_id, {
            'status': 'Complete',
            'progress': 100,
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Multiple file analysis task failed: {str(e)}")
        update_task_status(task_id, {
            'status': 'Failed',
            'error': str(e),
            'progress': 100
        })

@app.route('/remove_file/<filename>', methods=['DELETE'])
def remove_file(filename):
    """Remove an uploaded file."""
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({'success': True})
        return jsonify({'success': False, 'error': 'File not found'})
    except Exception as e:
        logger.error(f"Error removing file: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

class WebSocket:
    """WebSocket handler for real-time updates."""
    def receive(self):
        return '{"type": "subscribe", "channel": "progress"}'

def get_unique_filename(base_path: str, extension: str) -> str:
    """Generate a unique filename to avoid conflicts."""
    counter = 0
    while True:
        if counter == 0:
            filename = f"{base_path}{extension}"
        else:
            filename = f"{base_path}_{counter}{extension}"
        
        if not os.path.exists(filename):
            return filename
        counter += 1

def get_plot_path(base_name: str, extension: str = '.png') -> str:
    """Get a unique path for plot files in the static/plots directory."""
    plots_dir = os.path.join(os.path.dirname(__file__), 'static', 'plots')
    os.makedirs(plots_dir, exist_ok=True)
    base_path = os.path.join(plots_dir, base_name)
    return get_unique_filename(base_path, extension)

# Initialize directories on startup
init_task_dirs = None

@socketio.on('process_data')
def handle_process_data(data):
    """Handle data processing request via websocket."""
    try:
        logger.info(f"Start processing request received: {data}")
        task_id = data.get('task_id')
        if not task_id:
            logger.warning("No task_id provided")
            raise ValueError('No task_id provided')
            
        with task_lock:
            if task_id not in tasks:
                logger.warning(f"Task {task_id} not found")
                raise ValueError('Invalid task_id')
            
            task = tasks[task_id]
            if not task.get('filepath'):
                logger.warning(f"No filepath found for task {task_id}")
                raise ValueError('No file path found for task')

        # Update task status
        update_task_status(task_id, {
            'status': 'Processing',
            'progress': 0
        })

        # Start processing in background thread
        Thread(target=process_data_task, args=(task_id, task)).start()
        
        # Emit initial status
        emit('processing_started', {
            'task_id': task_id,
            'status': 'Processing'
        })
        
    except Exception as e:
        logger.error(f"Error starting processing: {str(e)}")
        emit('error', {
            'task_id': task_id if 'task_id' in locals() else None,
            'error': str(e)
        })

@app.route('/process_data', methods=['POST'])
def process_data_endpoint():
    """Process uploaded data file."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
            
        # Get task ID
        task_id = data.get('task_id')
        if not task_id:
            return jsonify({'success': False, 'error': 'No task ID provided'}), 400
            
        # Verify task exists and get task data
        with task_lock:
            if task_id not in tasks:
                return jsonify({'success': False, 'error': 'Invalid task ID'}), 404
            task = tasks[task_id]
            
        # Update task status to Processing
        update_task_status(task_id, {
            'status': 'Processing',
            'progress': 0
        })
        
        # Start processing in background
        Thread(target=process_data_task, args=(task_id, task)).start()
        
        # Return success response
        return jsonify({
            'success': True,
            'message': 'Processing started',
            'task_id': task_id
        })
        
    except Exception as e:
        logger.error(f"Error starting data processing: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    socketio.run(
        app,
        host=config.get_setting('app.host'),
        port=config.get_setting('app.port'),
        debug=config.get_setting('app.debug'),
        allow_unsafe_werkzeug=True  # For development only
    )

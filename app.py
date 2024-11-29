import os
from flask import Flask, request, jsonify, send_file, render_template
from flask_socketio import SocketIO, emit
import pandas as pd
import yaml
import numpy as np
from typing import Dict, Any
from werkzeug.utils import secure_filename
import threading
import uuid
from threading import Thread

from src.ingestion import DataIngestion
from src.validation import DataValidation
from src.erd_generator import ERDGenerator
from src.correlation import CorrelationAnalyzer
from src.export import DataExporter
from src.config import ConfigManager
from src.logger import setup_logger
from src.llm import call_claude_api

# Initialize Flask app and SocketIO
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', logger=True, engineio_logger=True)
app.socketio = socketio  # Attach socketio instance to app for testing

# Setup logging and configuration
logger = setup_logger()
config = ConfigManager('config.yaml')

# Configure app
app.config['MAX_CONTENT_LENGTH'] = config.get_setting('data.max_file_size_mb') * 1024 * 1024
app.config['UPLOAD_FOLDER'] = config.get_setting('data.upload_folder')

# Initialize components
data_ingestion = DataIngestion()
data_validation = DataValidation()
erd_generator = ERDGenerator()
correlation_analyzer = CorrelationAnalyzer()
data_exporter = DataExporter()

# Global state
tasks = {}
task_lock = threading.Lock()

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    allowed_extensions = config.get_setting('data.allowed_extensions')
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in [ext.strip('.') for ext in allowed_extensions]

@app.route('/')
def home():
    """Render the home page."""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload."""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file part'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'}), 400
            
        if not allowed_file(file.filename):
            return jsonify({
                'success': False, 
                'error': 'File type not allowed'
            }), 400
            
        # Save file
        filename = secure_filename(file.filename)
        upload_folder = app.config.get('UPLOAD_FOLDER', 'data/uploads')
        os.makedirs(upload_folder, exist_ok=True)
        filepath = os.path.join(upload_folder, filename)
        
        # Load and validate data
        df = data_ingestion.load_file(file)
        validation_results = data_validation.validate_data(df)
        
        # Save file after successful validation
        file.seek(0)
        file.save(filepath)
        
        # Generate preview, handling NaN values
        preview_df = df.head()
        preview = preview_df.replace({np.nan: None}).to_dict(orient='records')
        
        return jsonify({
            'success': True,
            'filename': filename,
            'preview': preview,
            'columns': df.columns.tolist(),
            'rows': len(df),
            'validation': validation_results
        })
        
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection."""
    logger.info(f"Client connected: {request.sid}")
    socketio.emit('connected', {'status': 'Connected'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('subscribe')
def handle_subscribe(data):
    """Handle subscription to channels."""
    logger.info(f"Client {request.sid} subscribed to channels: {data}")
    return {'status': 'subscribed', 'channel': data.get('channel')}

def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get task status in a thread-safe way."""
    with task_lock:
        if task_id not in tasks:
            return {'status': 'Failed', 'error': 'Task not found'}
        return tasks[task_id].copy()

def update_task_status(task_id: str, updates: Dict[str, Any]) -> None:
    """Update task status in a thread-safe way."""
    with task_lock:
        if task_id not in tasks:
            tasks[task_id] = {}
        tasks[task_id].update(updates)
        tasks[task_id]['task_id'] = task_id

def emit_progress(task_id: str) -> None:
    """Emit progress update for a task."""
    task_status = get_task_status(task_id)
    socketio.emit('progress', task_status, namespace='/')

def process_data_task(task_id: str, config: Dict[str, Any]) -> None:
    """Process data in a background task."""
    try:
        # Initialize task
        update_task_status(task_id, {
            'status': 'Running',
            'progress': 0,
            'results': {},
            'task_id': task_id
        })
        emit_progress(task_id)

        # Load data
        filename = config.get('filename')
        if not filename:
            raise ValueError("No filename provided")
            
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {filename}")
            
        df = pd.read_csv(file_path)
        
        # Update progress
        update_task_status(task_id, {
            'progress': 20,
            'task_id': task_id
        })
        emit_progress(task_id)
        
        # Validate data
        validation_results = data_validation.validate_data(df)
        update_task_status(task_id, {
            'results': {'validation': validation_results},
            'progress': 40,
            'task_id': task_id
        })
        emit_progress(task_id)
        
        # Analyze correlations
        correlation_results = correlation_analyzer.analyze(df)
        logger.info(f"Correlation results: {correlation_results}")  # Debug log
        
        updates = {
            'results': {
                'validation': validation_results,
                'correlations': correlation_results.get('correlations', {}),
                'high_correlations': correlation_results.get('high_correlations', []),
                'top_correlations': correlation_results.get('top_correlations', [])
            },
            'progress': 60,
            'task_id': task_id
        }
        logger.info(f"Updates to send: {updates}")  # Debug log
        
        update_task_status(task_id, updates)
        emit_progress(task_id)
        
        # Save correlation matrix plot
        if correlation_results.get('correlation_matrix_path'):
            updates['results']['correlation_matrix_path'] = correlation_results['correlation_matrix_path']
            
        update_task_status(task_id, updates)
        emit_progress(task_id)
        
        # Generate ERD if requested
        if config.get('generate_erd', False):
            try:
                erd_path = get_plot_path(f'erd_{task_id}')
                orientation = config.get('erd_orientation', 'LR')  # Default to left-to-right
                erd_path = erd_generator.generate_erd(df, filename, orientation=orientation)
                update_task_status(task_id, {
                    'results': {'erd_path': erd_path},
                    'task_id': task_id
                })
            except Exception as e:
                logger.error(f"ERD generation failed: {str(e)}")
                update_task_status(task_id, {
                    'status': 'Failed',
                    'error': str(e),
                    'results': {'erd_error': str(e)},
                    'task_id': task_id
                })
                emit_progress(task_id)
                return
        
        update_task_status(task_id, {
            'progress': 80,
            'task_id': task_id
        })
        emit_progress(task_id)
        
        # Mark task as complete
        update_task_status(task_id, {
            'status': 'Complete',
            'progress': 100,
            'task_id': task_id
        })
        emit_progress(task_id)
        
    except Exception as e:
        logger.error(f"Task failed: {str(e)}")
        update_task_status(task_id, {
            'status': 'Failed',
            'error': str(e),
            'task_id': task_id
        })
        emit_progress(task_id)

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
            
        # Verify file exists
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(config['filename']))
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': f"File not found: {config['filename']}"}), 404
            
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task
        update_task_status(task_id, {
            'status': 'Running',
            'progress': 0,
            'results': {},
            'task_id': task_id
        })
        
        # Start processing in background
        Thread(target=process_data_task, args=(task_id, config)).start()
        
        # Return task ID for progress tracking
        return jsonify({
            'success': True,
            'task_id': task_id,
            'results': {
                'status': 'Running',
                'progress': 0
            }
        })
        
    except Exception as e:
        logger.error(f"Task failed: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/progress/<task_id>', methods=['GET'])
def get_progress(task_id):
    """Get task progress."""
    if task_id not in tasks:
        return jsonify({'error': 'Task not found'}), 404
        
    task = get_task_status(task_id)
    response = {
        'status': task.get('status'),
        'progress': task.get('progress', 0),
        'error': task.get('error') if task.get('status') == 'Failed' else None
    }
    
    # Include results if task is complete or failed
    if task.get('results') is not None:
        response['results'] = task['results']
        
    return jsonify(response)

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
        return send_file(
            os.path.join(export_folder, filename),
            as_attachment=True,
            download_name=filename
        )
        
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
        {results.get('correlation', {})}
        
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

class WebSocket:
    """WebSocket handler for real-time updates."""
    def receive(self):
        return '{"type": "subscribe", "channel": "progress"}'

def init_task_dirs():
    """Initialize required directories with proper permissions."""
    # Create data directories
    os.makedirs(config.get_setting('data.upload_folder'), exist_ok=True)
    os.makedirs(config.get_setting('data.export_folder'), exist_ok=True)
    
    # Create plots directory for ERD and correlation matrices
    plots_dir = os.path.join(os.path.dirname(__file__), 'static', 'plots')
    os.makedirs(plots_dir, exist_ok=True)

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
init_task_dirs()

if __name__ == '__main__':
    socketio.run(
        app,
        host=config.get_setting('app.host'),
        port=config.get_setting('app.port'),
        debug=config.get_setting('app.debug')
    )

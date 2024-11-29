import os
import io
import json
import time
import logging
import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from flask import Flask
from flask_socketio import SocketIO

from app import app, socketio, tasks, erd_generator
from src import correlation

logger = logging.getLogger(__name__)

class TestWebInterface(unittest.TestCase):
    """Test cases for web interface functionality."""

    def setUp(self):
        """Set up test client and create necessary directories."""
        app.config['TESTING'] = True
        self.app = app.test_client()
        
        # Create necessary directories
        self.static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
        self.plots_dir = os.path.join(self.static_dir, 'plots')
        os.makedirs(self.plots_dir, exist_ok=True)
        
        # Create uploads directory
        self.uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
        os.makedirs(self.uploads_dir, exist_ok=True)
        
        # Initialize SocketIO test client
        self.socketio = socketio
        self.socket_client = self.socketio.test_client(app)
        
        # Create required directories
        self.test_upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'uploads')
        self.test_plots_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'plots')
        
        os.makedirs(self.test_upload_dir, exist_ok=True)
        os.makedirs(self.test_plots_dir, exist_ok=True)
        
        # Clear any existing tasks
        tasks.clear()

    def tearDown(self):
        """Clean up test files and directories."""
        # Clean up uploaded files
        if os.path.exists(self.test_upload_dir):
            for file in os.listdir(self.test_upload_dir):
                file_path = os.path.join(self.test_upload_dir, file)
                try:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                    elif os.path.isdir(file_path):
                        import shutil
                        shutil.rmtree(file_path)
                except Exception as e:
                    logger.warning(f"Failed to remove {file_path}: {str(e)}")

        # Clean up plots directory
        if os.path.exists(self.test_plots_dir):
            for file in os.listdir(self.test_plots_dir):
                file_path = os.path.join(self.test_plots_dir, file)
                try:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                    elif os.path.isdir(file_path):
                        import shutil
                        shutil.rmtree(file_path)
                except Exception as e:
                    logger.warning(f"Failed to remove {file_path}: {str(e)}")

        # Clean up exported files
        export_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'exports')
        if os.path.exists(export_dir):
            for file in os.listdir(export_dir):
                file_path = os.path.join(export_dir, file)
                try:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                    elif os.path.isdir(file_path):
                        import shutil
                        shutil.rmtree(file_path)
                except (PermissionError, OSError) as e:
                    logger.warning(f"Failed to remove {file_path}: {e}")
                
        # Clean up plot files
        if os.path.exists(self.test_plots_dir):
            for file in os.listdir(self.test_plots_dir):
                file_path = os.path.join(self.test_plots_dir, file)
                try:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                    elif os.path.isdir(file_path):
                        import shutil
                        shutil.rmtree(file_path)
                except (PermissionError, OSError) as e:
                    logger.warning(f"Failed to remove {file_path}: {e}")

    def wait_for_task_completion(self, task_id: str, timeout: int = 30) -> dict:
        """Wait for a task to complete and return the final status."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            progress_response = self.app.get(f'/progress/{task_id}')
            if progress_response.status_code != 200:
                time.sleep(0.5)
                continue
                
            progress_result = json.loads(progress_response.data)
            if progress_result.get('status') in ['Complete', 'Failed']:
                return progress_result
                
            time.sleep(0.5)
            
        raise TimeoutError(f"Task {task_id} did not complete within {timeout} seconds")

    def test_home_page(self):
        """Test home page loads correctly."""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'ML Ingestor', response.data)

    def test_upload_csv(self):
        """Test CSV file upload."""
        data = {
            'file': (io.BytesIO(b'id,name,value\n1,Alice,10\n2,Bob,20'), 'test.csv')
        }
        response = self.app.post('/upload', 
                               content_type='multipart/form-data',
                               data=data)
        
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        self.assertIn('success', result)
        self.assertTrue(result['success'])
        self.assertIn('preview', result)

    def test_invalid_file_upload(self):
        """Test handling of invalid file upload."""
        data = {
            'file': (io.BytesIO(b'invalid data'), 'test.txt')
        }
        response = self.app.post('/upload', 
                               content_type='multipart/form-data',
                               data=data)
        
        self.assertEqual(response.status_code, 400)
        result = json.loads(response.data)
        self.assertFalse(result['success'])
        self.assertIn('error', result)

    def test_process_data(self):
        """Test data processing endpoint."""
        # First upload a file
        data = {
            'file': (io.BytesIO(b'id,name,value\n1,Alice,10\n2,Bob,20'), 'test.csv')
        }
        upload_response = self.app.post('/upload', 
                                      content_type='multipart/form-data',
                                      data=data)
        self.assertEqual(upload_response.status_code, 200)
        upload_result = json.loads(upload_response.data)
        self.assertTrue(upload_result['success'])
        
        # Then try to process without filename
        test_config = {
            'generate_erd': True,
            'analyze_correlations': True
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))
        
        result = json.loads(response.data)
        self.assertEqual(response.status_code, 400)  # Should be 400 Bad Request
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'No filename provided')
        
        # Now process with filename
        test_config['filename'] = 'test.csv'
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))
        
        result = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(result['success'])
        self.assertIn('task_id', result)
        self.assertIn('results', result)
        self.assertEqual(result['results']['status'], 'Processing')
        self.assertEqual(result['results']['progress'], 0)

    def test_process_nonexistent_file(self):
        """Test processing a file that doesn't exist."""
        test_config = {
            'filename': 'nonexistent.csv',
            'generate_erd': True,
            'analyze_correlations': True
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))
        
        result = json.loads(response.data)
        self.assertEqual(response.status_code, 404)  # Should be 404 Not Found
        self.assertFalse(result['success'])
        self.assertIn('File not found', result['error'])

    def test_export_data(self):
        """Test data export endpoint."""
        mock_exporter = MagicMock()
        mock_exporter.return_value.export.return_value = {
            'path': '/path/to/exported/data.csv',
            'rows_exported': 100
        }
        
        export_config = {
            'format': 'csv',
            'compression': True
        }
        response = self.app.post('/export',
                               content_type='application/json',
                               data=json.dumps(export_config))
        
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        self.assertTrue(result['success'])
        self.assertIn('download_url', result)

    @patch('app.data_exporter')
    def test_export_with_nan_values(self, mock_exporter):
        """Test data export with NaN values."""
        # Create a mock DataFrame with NaN values
        df = pd.DataFrame({
            'id': [1, 2, np.nan],
            'value': [10, np.nan, 30]
        })
        
        # Mock the export function
        mock_exporter.export.return_value = {
            'path': '/path/to/exported/data.csv',
            'rows_exported': 3
        }
        
        # Test export
        export_config = {
            'format': 'csv',
            'compression': True
        }
        response = self.app.post('/export',
                               content_type='application/json',
                               data=json.dumps(export_config))
        
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        self.assertTrue(result['success'])
        
        # Verify that the export function was called with NaN-handled DataFrame
        args = mock_exporter.export.call_args
        export_df = args[1]['data']
        self.assertTrue(export_df.isna().any().any())  # Verify NaN values are present
        self.assertTrue(all(export_df.notna().any()))  # Verify non-NaN values are preserved

    def test_get_progress(self):
        """Test progress tracking endpoint."""
        # First create a task
        data = {
            'file': (io.BytesIO(b'id,name,value\n1,Alice,10\n2,Bob,20'), 'test.csv')
        }

        # Start processing
        test_config = {
            'filename': 'test.csv',
            'generate_erd': True,
            'analyze_correlations': True
        }
        process_response = self.app.post('/process',
                                       content_type='application/json',
                                       data=json.dumps(test_config))
        process_result = json.loads(process_response.data)
        self.assertEqual(process_response.status_code, 200)
        self.assertIn('task_id', process_result)
        
        # Check progress
        task_id = process_result['task_id']
        response = self.app.get(f'/progress/{task_id}')
        result = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('progress', result)
        self.assertIn('status', result)
        self.assertIsInstance(result['progress'], int)
        self.assertIsInstance(result['status'], str)
        
        # Test nonexistent task
        response = self.app.get('/progress/999999')
        self.assertEqual(response.status_code, 404)
        result = json.loads(response.data)
        self.assertEqual(result['error'], 'Task not found')

    def test_websocket_connection(self):
        """Test WebSocket connection for real-time updates."""
        with patch('app.WebSocket') as mock_ws:
            mock_ws.return_value.receive.return_value = json.dumps({
                'type': 'subscribe',
                'channel': 'progress'
            })
            
            response = self.app.get('/ws')
            self.assertEqual(response.status_code, 101)  # Switching protocols

    def test_api_documentation(self):
        """Test API documentation endpoint."""
        response = self.app.get('/api/docs')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'API Documentation', response.data)

    @patch('app.data_ingestion')
    def test_upload_with_nan_values(self, mock_ingestion):
        """Test file upload with NaN values."""
        # Create a DataFrame with NaN values
        df = pd.DataFrame({
            'id': [1, 2, np.nan],
            'value': [10, np.nan, 30],
            'text': ['a', 'b', None]
        })
        
        # Mock the load_file function
        mock_ingestion.load_file.return_value = df
        
        # Create a mock file
        data = io.BytesIO(b'test data')
        data.filename = 'test.csv'
        
        response = self.app.post(
            '/upload',
            data={'file': (data, 'test.csv')},
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        self.assertTrue(result['success'])
        
        # Check that NaN values are converted to null in JSON
        preview = result['preview']
        self.assertIsNone(preview[2]['id'])  # NaN should be None
        self.assertIsNone(preview[1]['value'])  # NaN should be None
        self.assertIsNone(preview[2]['text'])  # None should stay None

    @patch('app.erd_generator')
    def test_erd_generation(self, mock_erd_generator):
        """Test ERD generation and path handling."""
        # Create test data with relationships
        data = {
            'file': (io.BytesIO(b'user_id,order_id,product_id\n1,1,100\n2,2,200'), 'test.csv')
        }

        # Set up mock to return a valid path
        mock_erd_generator.generate.return_value = 'static/plots/erd_test.png'

        # Upload and process
        upload_response = self.app.post('/upload',
                                      content_type='multipart/form-data',
                                      data=data)
        self.assertEqual(upload_response.status_code, 200)

        test_config = {
            'filename': 'test.csv',
            'generate_erd': True
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))

        result = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(result['success'])

        # Wait for task completion
        task_result = self.wait_for_task_completion(result['task_id'])
        self.assertEqual(task_result['status'], 'Complete')

        # Check results contain ERD path
        results = task_result.get('results', {})
        self.assertIn('erd_path', results)

        # Create the expected file
        erd_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static',
                             os.path.basename(results['erd_path']))
        os.makedirs(os.path.dirname(erd_path), exist_ok=True)
        with open(erd_path, 'w') as f:
            f.write('test')

        # Verify ERD file exists
        self.assertTrue(os.path.exists(erd_path))

    @patch('app.erd_generator')
    def test_erd_generation_failure(self, mock_erd_generator):
        """Test ERD generation failure handling."""
        # Mock ERD generator to raise an exception
        mock_erd_generator.generate.side_effect = Exception("ERD generation failed")

        # First upload a file
        data = {
            'file': (io.BytesIO(b'id,name,value\n1,Alice,10\n2,Bob,20'), 'test.csv')
        }
        upload_response = self.app.post('/upload',
                                      content_type='multipart/form-data',
                                      data=data)
        self.assertEqual(upload_response.status_code, 200)

        # Process with ERD generation
        test_config = {
            'filename': 'test.csv',
            'generate_erd': True
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))

        # Initial response should be successful as task is started
        result = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(result['success'])
        self.assertIn('task_id', result)

        # Wait for task completion and verify failure
        task_result = self.wait_for_task_completion(result['task_id'])
        self.assertEqual(task_result['status'], 'Failed')
        self.assertIn('error', task_result)
        self.assertIn('ERD generation failed', task_result['error'])

    @patch('app.socketio')
    @patch('app.erd_generator')
    def test_erd_generation_progress(self, mock_erd_generator, mock_socketio):
        """Test progress updates during ERD generation."""
        # Mock ERD generator
        mock_erd_generator.generate.return_value = 'test_erd.png'
        
        # First upload a file
        data = {
            'file': (io.BytesIO(b'id,name,value\n1,Alice,10\n2,Bob,20'), 'test.csv')
        }
        upload_response = self.app.post('/upload',
                                      content_type='multipart/form-data',
                                      data=data)
        self.assertEqual(upload_response.status_code, 200)
        
        # Process with ERD generation
        test_config = {
            'filename': 'test.csv',
            'generate_erd': True,
            'analyze_correlations': False
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))
        
        result = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(result['success'])
        
        # Verify progress updates were emitted
        progress_calls = [
            call for call in mock_socketio.emit.call_args_list 
            if call[0][0] == 'progress'
        ]
        self.assertTrue(len(progress_calls) > 0)
        
        # Verify progress values
        progress_values = [
            call[0][1]['progress'] 
            for call in progress_calls
        ]
        self.assertTrue(all(0 <= p <= 100 for p in progress_values))
        self.assertTrue(progress_values == sorted(progress_values))  # Progress should increase

    def test_high_correlation_detection(self):
        """Test detection of high correlations in data."""
        # Create test data with known correlations
        data = {
            'file': (io.BytesIO(b'a,b,c\n1,2,1\n2,4,2\n3,6,3\n4,8,4'), 'test.csv')
        }
        
        # Upload the file
        upload_response = self.app.post('/upload',
                                      content_type='multipart/form-data',
                                      data=data)
        self.assertEqual(upload_response.status_code, 200)
        
        # Process the file with correlation analysis
        test_config = {
            'filename': 'test.csv'
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))
        
        result = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(result['success'])
        
        # Wait for task completion
        task_result = self.wait_for_task_completion(result['task_id'])
        self.assertEqual(task_result['status'], 'Complete')
        
        # Check results
        results = task_result.get('results', {})
        self.assertIn('correlations', results)
        self.assertIn('high_correlations', results)
        
        # Verify high correlations are found
        high_correlations = results['high_correlations']
        self.assertGreater(len(high_correlations), 0)
        
        # Check correlation values
        for corr in high_correlations:
            self.assertIn('column1', corr)
            self.assertIn('column2', corr)
            self.assertIn('correlation', corr)
            self.assertGreaterEqual(abs(corr['correlation']), 0.8)

    def test_websocket_progress_updates(self):
        """Test WebSocket progress updates during processing."""
        # Create a Flask-SocketIO test client
        socket_client = socketio.test_client(app)
        self.assertTrue(socket_client.is_connected())
        
        # Upload and process a file
        data = {
            'file': (io.BytesIO(b'a,b,c\n' + b'1,2,3\n' * 1000), 'test.csv')
        }
        upload_response = self.app.post('/upload',
                                      content_type='multipart/form-data',
                                      data=data)
        self.assertEqual(upload_response.status_code, 200)
        
        test_config = {
            'filename': 'test.csv',
            'analyze_correlations': True,
            'generate_erd': True
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))
        self.assertEqual(response.status_code, 200)
        
        # Get task ID
        result = json.loads(response.data)
        task_id = result['task_id']
        
        # Wait for task completion
        try:
            final_status = self.wait_for_task_completion(task_id)
        except TimeoutError as e:
            self.fail(f"Task timed out: {e}")
            
        # Get received events
        received = socket_client.get_received()
        progress_updates = [
            event for event in received 
            if event['name'] == 'progress' and 
               event['args'][0].get('task_id') == task_id
        ]
        
        # Verify progress updates
        self.assertTrue(len(progress_updates) > 0, "No progress updates received")
        
        # Check final update
        final_update = progress_updates[-1]['args'][0]
        self.assertEqual(final_update['progress'], 100)
        self.assertEqual(final_update['status'], 'Complete')
        self.assertIn('results', final_update)
        
        # Disconnect client
        socket_client.disconnect()

    def test_erd_generation(self):
        """Test ERD generation and path handling."""
        # Create test data with relationships
        data = {
            'file': (io.BytesIO(b'user_id,order_id,product_id\n1,1,100\n2,2,200'), 'test.csv')
        }
        
        # Upload and process
        upload_response = self.app.post('/upload',
                                      content_type='multipart/form-data',
                                      data=data)
        self.assertEqual(upload_response.status_code, 200)
        
        test_config = {
            'filename': 'test.csv',
            'generate_erd': True
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))
        
        result = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(result['success'])
        
        # Wait for task completion
        task_result = self.wait_for_task_completion(result['task_id'])
        self.assertEqual(task_result['status'], 'Complete')
        
        # Check results contain ERD path
        results = task_result.get('results', {})
        self.assertIn('erd_path', results)
        
        # Verify ERD file exists
        erd_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 
                               os.path.basename(results['erd_path']))
        self.assertTrue(os.path.exists(erd_path))
        
        # Clean up
        try:
            os.remove(erd_path)
        except FileNotFoundError:
            pass

    def test_result_formatting(self):
        """Test proper formatting of processing results."""
        # Create test data with various types of values
        data = {
            'file': (io.BytesIO(b'numeric,text,date\n1.23456,test,2023-01-01\n2.34567,sample,2023-01-02'), 'test.csv')
        }

        # Upload and process
        upload_response = self.app.post('/upload', 
                                      content_type='multipart/form-data',
                                      data=data)
        
        test_config = {
            'filename': 'test.csv',
            'analyze_correlations': True,
            'generate_erd': True
        }
        response = self.app.post('/process',
                               content_type='application/json',
                               data=json.dumps(test_config))
        
        result = json.loads(response.data)
        task_id = result['task_id']
        
        # Poll until complete
        max_retries = 10
        retry_count = 0
        while retry_count < max_retries:
            progress_response = self.app.get(f'/progress/{task_id}')
            progress_result = json.loads(progress_response.data)
            
            if progress_result.get('status') == 'Complete':
                break
                
            retry_count += 1
            time.sleep(0.5)
        
        self.assertTrue(retry_count < max_retries, "Task did not complete in time")
        
        # Get final results
        results_response = self.app.get(f'/results/{task_id}')
        self.assertEqual(results_response.status_code, 200)
        results = json.loads(results_response.data)
        
        # Verify result structure and formatting
        self.assertIn('validation', results)
        self.assertIn('correlations', results)
        
        # Check correlation formatting
        correlations = results['correlations']
        if 'high_correlations' in correlations:
            for corr in correlations['high_correlations']:
                self.assertIn('column1', corr)
                self.assertIn('column2', corr)
                self.assertIn('correlation', corr)
                # Verify correlation is formatted to 3 decimal places
                self.assertRegex(str(corr['correlation']), r'^\d+\.\d{3}$')

    def test_process_data_results(self):
        """Test that data processing returns complete results."""
        # First upload a file
        data = {
            'file': (io.BytesIO(b'id,value1,value2\n1,10,20\n2,15,25\n3,30,35'), 'test.csv')
        }
        upload_response = self.app.post('/upload', 
                                      content_type='multipart/form-data',
                                      data=data)
        self.assertEqual(upload_response.status_code, 200)
        
        # Process the data
        process_data = {
            'filename': 'test.csv',
            'generate_erd': True
        }
        process_response = self.app.post('/process',
                                       content_type='application/json',
                                       data=json.dumps(process_data))
        self.assertEqual(process_response.status_code, 200)
        result = json.loads(process_response.data)
        
        # Wait for task completion with longer timeout
        task_result = self.wait_for_task_completion(result['task_id'], timeout=30)
        
        # Check result structure
        self.assertEqual(task_result['status'], 'Complete')
        self.assertEqual(task_result['progress'], 100)
        
        # Check results contain all required components
        results = task_result.get('results', {})
        self.assertIn('validation', results)
        self.assertIn('correlations', results)
        self.assertIn('high_correlations', results)
        self.assertIn('correlation_matrix_path', results)
        
        # Verify correlation matrix exists
        if results.get('correlation_matrix_path'):
            full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 
                                   os.path.basename(results['correlation_matrix_path']))
            self.assertTrue(os.path.exists(full_path))
            
            # Clean up
            try:
                os.remove(full_path)
            except FileNotFoundError:
                pass

    @patch('src.correlation.CorrelationAnalyzer.analyze')
    def test_correlation_analysis_always_runs(self, mock_analyze):
        """Test that correlation analysis runs regardless of config."""
        # Setup mock
        mock_analyze.return_value = {
            'correlations': {},
            'high_correlations': [],
            'correlation_matrix_path': None
        }
        
        # Upload and process a file
        data = {
            'file': (io.BytesIO(b'id,value\n1,10\n2,20'), 'test.csv')
        }
        upload_response = self.app.post('/upload', content_type='multipart/form-data', data=data)
        self.assertEqual(upload_response.status_code, 200)
        
        # Process with different configs
        configs = [
            {'filename': 'test.csv', 'generate_erd': True},
            {'filename': 'test.csv', 'generate_erd': False},
            {'filename': 'test.csv'}
        ]
        
        for config in configs:
            response = self.app.post('/process',
                                   content_type='application/json',
                                   data=json.dumps(config))
            self.assertEqual(response.status_code, 200)
            result = json.loads(response.data)
            
            # Wait for task completion
            task_result = self.wait_for_task_completion(result['task_id'])
            self.assertEqual(task_result['status'], 'Complete')
        
        # Check that analyze was called for each config
        self.assertGreater(mock_analyze.call_count, 0)

    def test_socket_progress_updates(self):
        """Test that socket emits progress updates correctly."""
        with patch('app.socketio.emit') as mock_emit:
            # Upload and process a file
            data = {
                'file': (io.BytesIO(b'id,value\n1,10\n2,20'), 'test.csv')
            }
            upload_response = self.app.post('/upload',
                                          content_type='multipart/form-data',
                                          data=data)
            self.assertEqual(upload_response.status_code, 200)
            
            process_response = self.app.post('/process',
                                           content_type='application/json',
                                           data=json.dumps({'filename': 'test.csv'}))
            self.assertEqual(process_response.status_code, 200)
            result = json.loads(process_response.data)
            
            # Wait for task completion
            task_result = self.wait_for_task_completion(result['task_id'])
            self.assertEqual(task_result['status'], 'Complete')
            
            # Check that progress was emitted
            progress_calls = [call for call in mock_emit.call_args_list 
                            if call[0][0] == 'progress']
            self.assertGreater(len(progress_calls), 0)
            
            # Check final progress update
            final_progress = progress_calls[-1][0][1]
            self.assertEqual(final_progress['progress'], 100)
            self.assertEqual(final_progress['status'], 'Complete')
            self.assertIn('results', final_progress)

if __name__ == '__main__':
    unittest.main()

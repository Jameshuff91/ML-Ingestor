import unittest
import pandas as pd
import os
import json
import tempfile
from src.export import DataExporter

class TestDataExporter(unittest.TestCase):
    def setUp(self):
        """Set up test cases."""
        self.exporter = DataExporter()
        
        # Create test data
        self.test_data = pd.DataFrame({
            'id': [1, 2, 3],
            'name': ['Alice', 'Bob', 'Charlie'],
            'value': [10.5, 20.0, 30.7]
        })
        
        # Create temporary directory for test outputs
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up after tests."""
        # Remove test files
        for file in os.listdir(self.temp_dir):
            os.remove(os.path.join(self.temp_dir, file))
        os.rmdir(self.temp_dir)

    def test_export_csv(self):
        """Test exporting data to CSV format."""
        output_path = os.path.join(self.temp_dir, 'output.csv')
        result = self.exporter.export(self.test_data, output_path, format='csv')
        
        self.assertTrue(os.path.exists(output_path))
        self.assertIn('path', result)
        self.assertIn('rows_exported', result)
        self.assertEqual(result['rows_exported'], 3)
        
        # Verify data integrity
        loaded_data = pd.read_csv(output_path)
        pd.testing.assert_frame_equal(loaded_data, self.test_data)

    def test_export_json(self):
        """Test exporting data to JSON format."""
        output_path = os.path.join(self.temp_dir, 'output.json')
        result = self.exporter.export(self.test_data, output_path, format='json')
        
        self.assertTrue(os.path.exists(output_path))
        self.assertEqual(result['rows_exported'], 3)
        
        # Verify data integrity
        with open(output_path, 'r') as f:
            loaded_data = json.load(f)
        self.assertEqual(len(loaded_data), 3)
        self.assertEqual(loaded_data[0]['name'], 'Alice')

    def test_export_parquet(self):
        """Test exporting data to Parquet format."""
        output_path = os.path.join(self.temp_dir, 'output.parquet')
        result = self.exporter.export(self.test_data, output_path, format='parquet')
        
        self.assertTrue(os.path.exists(output_path))
        self.assertEqual(result['rows_exported'], 3)
        
        # Verify data integrity
        loaded_data = pd.read_parquet(output_path)
        pd.testing.assert_frame_equal(loaded_data, self.test_data)

    def test_export_with_compression(self):
        """Test exporting data with compression."""
        output_path = os.path.join(self.temp_dir, 'output.csv.gz')
        result = self.exporter.export(
            self.test_data, 
            output_path, 
            format='csv', 
            compression='gzip'
        )
        
        self.assertTrue(os.path.exists(output_path))
        self.assertEqual(result['rows_exported'], 3)
        
        # Verify data integrity
        loaded_data = pd.read_csv(output_path, compression='gzip')
        pd.testing.assert_frame_equal(loaded_data, self.test_data)

    def test_export_invalid_format(self):
        """Test handling of invalid export format."""
        output_path = os.path.join(self.temp_dir, 'output.xyz')
        with self.assertRaises(ValueError):
            self.exporter.export(self.test_data, output_path, format='xyz')

    def test_export_with_metadata(self):
        """Test exporting data with metadata."""
        output_path = os.path.join(self.temp_dir, 'output.json')
        metadata = {
            'created_at': '2024-03-20',
            'version': '1.0',
            'columns': {
                'id': {'type': 'integer', 'primary_key': True},
                'name': {'type': 'string'},
                'value': {'type': 'float'}
            }
        }
        
        result = self.exporter.export(
            self.test_data, 
            output_path, 
            format='json',
            metadata=metadata
        )
        
        self.assertTrue(os.path.exists(output_path))
        
        # Verify data and metadata
        with open(output_path, 'r') as f:
            loaded_data = json.load(f)
        self.assertIn('data', loaded_data)
        self.assertIn('metadata', loaded_data)
        self.assertEqual(loaded_data['metadata']['version'], '1.0')

if __name__ == '__main__':
    unittest.main()

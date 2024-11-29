import unittest
import pandas as pd
import os
import tempfile
from src.ingestion import DataIngestion
from werkzeug.datastructures import FileStorage

class TestDataIngestion(unittest.TestCase):
    def setUp(self):
        """Set up test cases."""
        self.ingestion = DataIngestion()
        
        # Create a temporary CSV file for testing
        self.test_data = pd.DataFrame({
            'id': [1, 2, 3],
            'name': ['Alice', 'Bob', 'Charlie'],
            'value': [10, 20, 30]
        })
        
        # Create temporary file
        self.temp_dir = tempfile.mkdtemp()
        self.csv_path = os.path.join(self.temp_dir, 'test.csv')
        self.test_data.to_csv(self.csv_path, index=False)
        
        # Create Excel file for testing
        self.xlsx_path = os.path.join(self.temp_dir, 'test.xlsx')
        self.test_data.to_excel(self.xlsx_path, index=False)

    def tearDown(self):
        """Clean up after tests."""
        # Remove temporary files
        for file in [self.csv_path, self.xlsx_path]:
            if os.path.exists(file):
                os.remove(file)
        if os.path.exists(self.temp_dir):
            os.rmdir(self.temp_dir)

    def test_load_csv_file(self):
        """Test loading a CSV file."""
        with open(self.csv_path, 'rb') as f:
            file = FileStorage(f)
            df = self.ingestion.load_file(file)
        
        self.assertIsInstance(df, pd.DataFrame)
        self.assertEqual(len(df), 3)
        self.assertListEqual(list(df.columns), ['id', 'name', 'value'])

    def test_load_excel_file(self):
        """Test loading an Excel file."""
        with open(self.xlsx_path, 'rb') as f:
            file = FileStorage(f)
            df = self.ingestion.load_file(file)
        
        self.assertIsInstance(df, pd.DataFrame)
        self.assertEqual(len(df), 3)
        self.assertListEqual(list(df.columns), ['id', 'name', 'value'])

    def test_load_invalid_file(self):
        """Test loading an invalid file type."""
        # Create a temporary text file
        txt_path = os.path.join(self.temp_dir, 'test.txt')
        with open(txt_path, 'w') as f:
            f.write('This is not a CSV file')

        with open(txt_path, 'rb') as f:
            file = FileStorage(f)
            with self.assertRaises(ValueError):
                self.ingestion.load_file(file)

        os.remove(txt_path)

    def test_save_processed_data(self):
        """Test saving processed data to CSV."""
        output_path = os.path.join(self.temp_dir, 'output.csv')
        
        try:
            self.ingestion.save_processed_data(self.test_data, output_path)
            
            # Verify the file was created and contains correct data
            self.assertTrue(os.path.exists(output_path))
            loaded_df = pd.read_csv(output_path)
            pd.testing.assert_frame_equal(loaded_df, self.test_data)
            
        finally:
            if os.path.exists(output_path):
                os.remove(output_path)

    def test_preprocess_data(self):
        """Test data preprocessing functionality."""
        # Create test data with missing values and duplicates
        data = pd.DataFrame({
            'id': [1, 2, 2, 3],
            'name': ['Alice', None, 'Bob', 'Charlie'],
            'value': [10, 20, 20, None]
        })
        
        processed_df = self.ingestion.preprocess_data(data)
        
        # Check if duplicates were removed
        self.assertEqual(len(processed_df), 3)
        
        # Check if missing values were handled
        self.assertFalse(processed_df['name'].isnull().any())
        self.assertFalse(processed_df['value'].isnull().any())

    def test_validate_schema(self):
        """Test schema validation."""
        # Test with valid schema
        valid_schema = {
            'id': 'integer',
            'name': 'string',
            'value': 'integer'
        }
        
        self.assertTrue(self.ingestion.validate_schema(self.test_data, valid_schema))
        
        # Test with invalid schema
        invalid_schema = {
            'id': 'string',  # Should be integer
            'name': 'string',
            'value': 'integer'
        }
        
        self.assertFalse(self.ingestion.validate_schema(self.test_data, invalid_schema))

    def test_get_data_summary(self):
        """Test data summary generation."""
        summary = self.ingestion.get_data_summary(self.test_data)
        
        self.assertIn('row_count', summary)
        self.assertIn('column_count', summary)
        self.assertIn('missing_values', summary)
        self.assertIn('data_types', summary)
        
        self.assertEqual(summary['row_count'], 3)
        self.assertEqual(summary['column_count'], 3)
        self.assertEqual(summary['missing_values'], 0)

if __name__ == '__main__':
    unittest.main()

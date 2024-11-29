import unittest
import pandas as pd
import os
from src.erd_generator import ERDGenerator

class TestERDGenerator(unittest.TestCase):
    def setUp(self):
        """Set up test cases."""
        self.erd_generator = ERDGenerator()
        
        # Create test data with various column types and relationships
        self.test_data = pd.DataFrame({
            'id': [1, 2, 3],
            'user_id': [101, 102, 103],
            'name': ['Alice', 'Bob', 'Charlie'],
            'age': [25, 30, 35],
            'department_id': [1, 2, 2]
        })

    def test_generate_erd(self):
        """Test ERD generation."""
        result = self.erd_generator.generate(self.test_data)
        
        # Check if ERD was generated and saved
        self.assertIn('erd_path', result)
        self.assertTrue(os.path.exists(result['erd_path']))
        
        # Clean up generated files
        try:
            os.remove(result['erd_path'])
        except FileNotFoundError:
            pass

    def test_detect_relationships(self):
        """Test relationship detection between columns."""
        # Create test data with clear relationships
        data = pd.DataFrame({
            'department_id': [1, 2, 3],
            'department_name': ['HR', 'IT', 'Finance'],
            'employee_dept_id': [1, 1, 2]  # References department_id
        })
        
        relationships = self.erd_generator.detect_relationships(data)
        
        # Check if the many-to-one relationship is detected
        found_relationship = False
        for rel in relationships:
            if (rel['from_column'] == 'employee_dept_id' and 
                rel['to_column'] == 'department_id' and 
                rel['type'] == 'many-to-one'):
                found_relationship = True
                break
        
        self.assertTrue(found_relationship)

    def test_empty_dataframe(self):
        """Test ERD generation with empty DataFrame."""
        empty_df = pd.DataFrame()
        
        result = self.erd_generator.generate(empty_df)
        self.assertIn('erd_path', result)
        
        # Clean up generated files
        try:
            os.remove(result['erd_path'])
        except FileNotFoundError:
            pass

    def test_single_column_dataframe(self):
        """Test ERD generation with single-column DataFrame."""
        single_col_df = pd.DataFrame({'id': [1, 2, 3]})
        
        result = self.erd_generator.generate(single_col_df)
        self.assertIn('erd_path', result)
        
        # Clean up generated files
        try:
            os.remove(result['erd_path'])
        except FileNotFoundError:
            pass

if __name__ == '__main__':
    unittest.main()

import unittest
import pandas as pd
import numpy as np
from src.validation import DataValidation

class TestDataValidation(unittest.TestCase):
    def setUp(self):
        """Set up test cases."""
        self.validation = DataValidation()
        
        # Create test data with various validation scenarios
        self.test_data = pd.DataFrame({
            'id': [1, 2, 3, 4, 5],
            'name': ['Alice', None, 'Charlie', 'David', 'Eve'],
            'value': [10, -20, 30, -40, 50],
            'score': [1.0, 2.0, 2.0, 3.0, 3.0]  # Contains duplicates
        })

    def test_check_missing_values(self):
        """Test missing values detection."""
        results = self.validation.check_missing_values(self.test_data)
        
        self.assertEqual(results['total_missing']['name'], 1)
        self.assertEqual(results['total_missing']['id'], 0)
        self.assertEqual(results['missing_percentages']['name'], 20.0)

    def test_check_negative_values(self):
        """Test negative values detection."""
        results = self.validation.check_negative_values(self.test_data)
        
        self.assertEqual(results['value'], 2)  # Two negative values in 'value' column
        self.assertNotIn('name', results)  # No negative values in non-numeric columns

    def test_check_duplicates(self):
        """Test duplicate detection."""
        # Add a duplicate row
        duplicate_data = pd.concat([self.test_data, self.test_data.iloc[[0]]])
        results = self.validation.check_duplicates(duplicate_data)
        
        self.assertEqual(results['total_duplicates'], 1)
        self.assertEqual(len(results['duplicate_rows']), 1)

    def test_get_data_types(self):
        """Test data type detection."""
        results = self.validation.get_data_types(self.test_data)
        
        self.assertEqual(results['id'], 'int64')
        self.assertEqual(results['name'], 'object')
        self.assertEqual(results['value'], 'int64')
        self.assertEqual(results['score'], 'float64')

    def test_suggest_imputation_method(self):
        """Test imputation method suggestion."""
        # Test for numeric column with normal distribution
        normal_data = pd.DataFrame({
            'normal': np.random.normal(0, 1, 1000)
        })
        self.assertEqual(
            self.validation.suggest_imputation_method(normal_data, 'normal'),
            'mean'
        )
        
        # Test for categorical column
        self.assertEqual(
            self.validation.suggest_imputation_method(self.test_data, 'name'),
            'mode'
        )

    def test_impute_missing_values(self):
        """Test missing value imputation."""
        # Create test data with missing values
        data = pd.DataFrame({
            'numeric': [1, 2, None, 4, 5],
            'categorical': ['A', None, 'B', 'B', 'A']
        })
        
        # Test auto imputation
        imputed_df = self.validation.impute_missing_values(data, method='auto')
        
        self.assertFalse(imputed_df['numeric'].isnull().any())
        self.assertFalse(imputed_df['categorical'].isnull().any())
        
        # Test specific methods
        numeric_mean = self.validation.impute_missing_values(
            data[['numeric']], method='mean'
        )
        self.assertEqual(numeric_mean['numeric'].iloc[2], 3.0)  # Mean of [1,2,4,5]

if __name__ == '__main__':
    unittest.main()

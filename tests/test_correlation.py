import unittest
import pandas as pd
import numpy as np
import os
from src.correlation import CorrelationAnalyzer

class TestCorrelationAnalyzer(unittest.TestCase):
    def setUp(self):
        """Set up test cases."""
        self.correlation = CorrelationAnalyzer()
        
        # Create test data with known correlations
        np.random.seed(42)  # For reproducibility
        x = np.linspace(0, 10, 100)
        
        self.test_data = pd.DataFrame({
            'x': x,
            'y': 2 * x + np.random.normal(0, 1, 100),  # Strong positive correlation
            'z': -0.5 * x + np.random.normal(0, 2, 100),  # Moderate negative correlation
            'random': np.random.normal(0, 1, 100),  # No correlation
            'categorical': ['A'] * 50 + ['B'] * 50  # Non-numeric column
        })

    def test_analyze_correlations(self):
        """Test correlation analysis."""
        results = self.correlation.analyze(self.test_data)
        
        # Check if correlation matrix was generated
        self.assertIn('correlations', results)
        self.assertIn('high_correlations', results)
        self.assertIn('correlation_matrix_path', results)
        
        # Verify correlation values
        correlations = pd.DataFrame(results['correlations'])
        
        # Check strong positive correlation between x and y
        self.assertGreater(correlations.loc['x', 'y'], 0.9)
        
        # Check moderate negative correlation between x and z
        self.assertLess(correlations.loc['x', 'z'], -0.3)
        
        # Clean up generated plot
        if results['correlation_matrix_path']:
            try:
                os.remove(results['correlation_matrix_path'])
            except FileNotFoundError:
                pass

    def test_high_correlations(self):
        """Test high correlation detection."""
        results = self.correlation.analyze(self.test_data)
        
        # There should be at least one high correlation (x and y)
        self.assertGreater(len(results['high_correlations']), 0)
        
        # Verify the strongest correlation is between x and y
        found_xy_correlation = False
        for corr in results['high_correlations']:
            if (corr['column1'] == 'x' and corr['column2'] == 'y') or \
               (corr['column1'] == 'y' and corr['column2'] == 'x'):
                found_xy_correlation = True
                self.assertGreater(abs(corr['correlation']), 0.9)
                break
        
        self.assertTrue(found_xy_correlation)

    def test_no_numeric_columns(self):
        """Test correlation analysis with no numeric columns."""
        categorical_data = pd.DataFrame({
            'cat1': ['A', 'B', 'C'],
            'cat2': ['X', 'Y', 'Z']
        })
        
        results = self.correlation.analyze(categorical_data)
        
        self.assertEqual(results['correlations'], {})
        self.assertEqual(results['high_correlations'], [])
        self.assertIsNone(results['correlation_matrix_path'])

    def test_feature_importance(self):
        """Test feature importance calculation."""
        results = self.correlation.get_feature_importance(self.test_data, 'y')
        
        # x should be the most important feature for y
        self.assertIn('feature_importance', results)
        self.assertIn('top_features', results)
        
        importance = pd.Series(results['feature_importance'])
        self.assertEqual(importance.idxmax(), 'y')  # Self-correlation
        
        # Remove self-correlation and check x is most important
        importance = importance.drop('y')
        self.assertEqual(importance.idxmax(), 'x')
        
        # Check number of top features
        self.assertLessEqual(len(results['top_features']), 5)

    def test_invalid_target_column(self):
        """Test feature importance with invalid target column."""
        with self.assertRaises(ValueError):
            self.correlation.get_feature_importance(self.test_data, 'non_existent')

    def test_correlation_matrix_generation(self):
        """Test that correlation matrix image is generated correctly."""
        results = self.correlation.analyze(self.test_data)
        
        # Check if matrix path exists
        self.assertIsNotNone(results['correlation_matrix_path'])
        self.assertTrue(os.path.exists(results['correlation_matrix_path']))
        
        # Check if it's a valid image file
        file_size = os.path.getsize(results['correlation_matrix_path'])
        self.assertGreater(file_size, 0)
        
        # Clean up
        os.remove(results['correlation_matrix_path'])

    def test_correlation_matrix_format(self):
        """Test the format of correlation matrix results."""
        results = self.correlation.analyze(self.test_data)
        
        # Check correlation matrix structure
        correlations = results['correlations']
        self.assertIsInstance(correlations, dict)
        
        # Convert to DataFrame for easier testing
        corr_df = pd.DataFrame(correlations)
        
        # Check if all numeric columns are included
        numeric_cols = self.test_data.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            self.assertIn(col, corr_df.columns)
        
        # Check correlation values are between -1 and 1
        for col in corr_df.columns:
            self.assertTrue((corr_df[col] >= -1).all())
            self.assertTrue((corr_df[col] <= 1).all())

    def test_high_correlations_format(self):
        """Test the format of high correlations results."""
        results = self.correlation.analyze(self.test_data)
        
        for corr in results['high_correlations']:
            # Check structure
            self.assertIn('column1', corr)
            self.assertIn('column2', corr)
            self.assertIn('correlation', corr)
            
            # Check value ranges
            self.assertGreaterEqual(abs(corr['correlation']), self.correlation.correlation_threshold)
            self.assertLessEqual(abs(corr['correlation']), 1.0)
            
            # Check column names are valid
            self.assertIn(corr['column1'], self.test_data.columns)
            self.assertIn(corr['column2'], self.test_data.columns)

if __name__ == '__main__':
    unittest.main()

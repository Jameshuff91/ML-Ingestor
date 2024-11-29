import unittest
import pandas as pd
import numpy as np
from src.data_processor import DataProcessor

class TestDataProcessor(unittest.TestCase):
    def setUp(self):
        """Set up test cases."""
        self.processor = DataProcessor()
        
        # Create test data with various validation scenarios
        self.test_data = pd.DataFrame({
            'id': range(1, 101),
            'normal_feature': np.random.normal(0, 1, 100),
            'correlated_feature': np.random.normal(0, 1, 100),
            'missing_feature': [None if i % 5 == 0 else i for i in range(100)],
            'outlier_feature': [i if i < 95 else 1000 for i in range(100)]
        })
        # Add correlation
        self.test_data['correlated_feature'] = (
            self.test_data['normal_feature'] * 0.9 + 
            np.random.normal(0, 0.1, 100)
        )

    def test_validate_data_structure(self):
        """Test the structure of validation results."""
        results = self.processor.validate_data(self.test_data)
        
        # Check main sections exist
        self.assertTrue('basic_validation' in results)
        self.assertTrue('enhanced_validation' in results)
        self.assertTrue('summary' in results)
        
        # Check basic validation components
        basic = results['basic_validation']
        self.assertTrue('missing_values' in basic)
        self.assertTrue('duplicates' in basic)
        self.assertTrue('numeric_stats' in basic)
        
        # Check enhanced validation components
        enhanced = results['enhanced_validation']
        self.assertTrue('outliers' in enhanced)
        self.assertTrue('data_quality' in enhanced)
        self.assertTrue('distributions' in enhanced)
        self.assertTrue('multicollinearity' in enhanced)
        
        # Check summary components
        summary = results['summary']
        self.assertTrue('quality_score' in summary)
        self.assertTrue('quality_grade' in summary)
        self.assertTrue('major_issues' in summary)

    def test_validate_data_missing_values(self):
        """Test missing value detection in validation results."""
        results = self.processor.validate_data(self.test_data)
        
        missing_stats = results['basic_validation']['missing_values']
        self.assertEqual(missing_stats['total_missing']['missing_feature'], 20)
        self.assertEqual(missing_stats['total_missing']['normal_feature'], 0)

    def test_validate_data_outliers(self):
        """Test outlier detection in validation results."""
        results = self.processor.validate_data(self.test_data)
        
        outliers = results['enhanced_validation']['outliers']
        self.assertTrue(outliers['outlier_feature']['count'] > 0)
        self.assertTrue(outliers['normal_feature']['count'] < 5)  # Few or no outliers expected

    def test_validate_data_quality_score(self):
        """Test data quality scoring in validation results."""
        results = self.processor.validate_data(self.test_data)
        
        quality = results['enhanced_validation']['data_quality']
        self.assertTrue(0 <= quality['overall_score'] <= 100)
        self.assertTrue(quality['grade'] in ['A', 'B', 'C', 'D', 'F'])
        
        # Check column scores
        column_scores = quality['column_scores']
        self.assertTrue(column_scores['normal_feature'] > column_scores['missing_feature'])

    def test_validate_data_multicollinearity(self):
        """Test multicollinearity detection in validation results."""
        results = self.processor.validate_data(self.test_data)
        
        multicollinearity = results['enhanced_validation']['multicollinearity']
        highly_correlated = multicollinearity['highly_correlated']
        
        # Should detect correlation between normal_feature and correlated_feature
        self.assertTrue(any('normal_feature' in pair and 'correlated_feature' in pair 
                          for pair in highly_correlated.keys()))

    def test_major_issues_summary(self):
        """Test the major issues summary generation."""
        results = self.processor.validate_data(self.test_data)
        
        issues = results['summary']['major_issues']
        self.assertTrue(isinstance(issues, list))
        
        # Should detect missing values in missing_feature
        self.assertTrue(any('missing_feature' in issue for issue in issues))
        
        # Should detect outliers in outlier_feature
        self.assertTrue(any('outlier_feature' in issue for issue in issues))
        
        # Should detect correlation
        self.assertTrue(any('correlation' in issue.lower() for issue in issues))

if __name__ == '__main__':
    unittest.main()

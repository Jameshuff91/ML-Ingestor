import unittest
import os
import yaml
from src.config import ConfigManager

class TestConfigManager(unittest.TestCase):
    def setUp(self):
        """Set up test cases."""
        self.test_config = {
            'validation': {
                'correlation_threshold': 0.8,
                'missing_value_threshold': 0.5,
                'imputation_methods': ['mean', 'median', 'mode']
            },
            'ingestion': {
                'allowed_file_types': ['.csv', '.xlsx', '.json'],
                'max_file_size_mb': 100,
                'batch_size': 1000
            },
            'export': {
                'output_formats': ['csv', 'json', 'parquet'],
                'default_format': 'csv',
                'compression': True
            },
            'logging': {
                'level': 'INFO',
                'file_path': 'logs/app.log',
                'max_file_size_mb': 10
            }
        }
        
        # Create a temporary config file
        self.config_path = 'test_config.yaml'
        with open(self.config_path, 'w') as f:
            yaml.dump(self.test_config, f)
        
        self.config_manager = ConfigManager(self.config_path)

    def tearDown(self):
        """Clean up after tests."""
        if os.path.exists(self.config_path):
            os.remove(self.config_path)

    def test_load_config(self):
        """Test loading configuration from file."""
        config = self.config_manager.load_config()
        self.assertEqual(config['validation']['correlation_threshold'], 0.8)
        self.assertEqual(config['ingestion']['max_file_size_mb'], 100)
        self.assertEqual(config['export']['default_format'], 'csv')

    def test_update_config(self):
        """Test updating configuration values."""
        updates = {
            'validation': {
                'correlation_threshold': 0.9
            }
        }
        self.config_manager.update_config(updates)
        config = self.config_manager.load_config()
        self.assertEqual(config['validation']['correlation_threshold'], 0.9)

    def test_validate_config(self):
        """Test configuration validation."""
        # Test with invalid correlation threshold
        invalid_config = self.test_config.copy()
        invalid_config['validation']['correlation_threshold'] = 1.5
        
        with self.assertRaises(ValueError):
            self.config_manager.validate_config(invalid_config)

    def test_get_setting(self):
        """Test retrieving specific settings."""
        value = self.config_manager.get_setting('validation.correlation_threshold')
        self.assertEqual(value, 0.8)
        
        # Test nested setting
        value = self.config_manager.get_setting('export.output_formats')
        self.assertEqual(value, ['csv', 'json', 'parquet'])

    def test_invalid_config_path(self):
        """Test handling of invalid config file path."""
        with self.assertRaises(FileNotFoundError):
            ConfigManager('nonexistent.yaml').load_config()

if __name__ == '__main__':
    unittest.main()

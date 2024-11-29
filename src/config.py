import yaml
import os
from typing import Any, Dict, Union
from src.logger import setup_logger

logger = setup_logger()

class ConfigManager:
    """Configuration management for ML Ingestor."""
    
    def __init__(self, config_path: str):
        """Initialize ConfigManager with path to config file.
        
        Args:
            config_path: Path to the YAML configuration file
        """
        self.config_path = config_path
        self.logger = logger
        self._config = None
        
        # Load config on initialization
        self.load_config()

    def load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file.
        
        Returns:
            Dict containing configuration settings
        
        Raises:
            FileNotFoundError: If config file doesn't exist
            yaml.YAMLError: If config file is invalid YAML
        """
        try:
            if not os.path.exists(self.config_path):
                raise FileNotFoundError(f"Config file not found: {self.config_path}")
                
            with open(self.config_path, 'r') as f:
                self._config = yaml.safe_load(f)
                
            # Validate the loaded configuration
            self.validate_config(self._config)
            
            self.logger.info(f"Successfully loaded configuration from {self.config_path}")
            return self._config
            
        except yaml.YAMLError as e:
            self.logger.error(f"Error parsing config file: {str(e)}")
            raise
        except Exception as e:
            self.logger.error(f"Error loading config: {str(e)}")
            raise

    def validate_config(self, config: Dict[str, Any]) -> bool:
        """Validate configuration values.
        
        Args:
            config: Configuration dictionary to validate
        
        Returns:
            True if configuration is valid
            
        Raises:
            ValueError: If configuration is invalid
        """
        try:
            # Validate app settings
            if 'app' in config:
                if not isinstance(config['app'].get('port', 8000), int):
                    raise ValueError("App port must be an integer")
                    
            # Validate logging settings
            if 'logging' in config:
                valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
                if config['logging'].get('level') not in valid_levels:
                    raise ValueError(f"Invalid logging level. Must be one of {valid_levels}")
                    
            # Validate data settings
            if 'data' in config:
                max_size = config['data'].get('max_file_size_mb', 200)
                if not isinstance(max_size, (int, float)) or max_size <= 0:
                    raise ValueError("Max file size must be a positive number")
                    
            # Validate validation settings
            if 'validation' in config:
                missing_threshold = config['validation'].get('missing_threshold', 0.2)
                correlation_threshold = config['validation'].get('correlation_threshold', 0.8)
                
                if not 0 <= missing_threshold <= 1:
                    raise ValueError("Missing threshold must be between 0 and 1")
                if not 0 <= correlation_threshold <= 1:
                    raise ValueError("Correlation threshold must be between 0 and 1")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Configuration validation failed: {str(e)}")
            raise

    def update_config(self, updates: Dict[str, Any]) -> None:
        """Update configuration with new values.
        
        Args:
            updates: Dictionary containing configuration updates
            
        Raises:
            ValueError: If updates are invalid
        """
        try:
            # Create a copy of current config
            new_config = self._config.copy()
            
            # Update the copy with new values
            self._deep_update(new_config, updates)
            
            # Validate the new configuration
            self.validate_config(new_config)
            
            # Write the new configuration to file
            with open(self.config_path, 'w') as f:
                yaml.dump(new_config, f, default_flow_style=False)
            
            # Update the in-memory config
            self._config = new_config
            
            self.logger.info("Configuration updated successfully")
            
        except Exception as e:
            self.logger.error(f"Error updating config: {str(e)}")
            raise

    def get_setting(self, path: str) -> Any:
        """Get a configuration setting using dot notation.
        
        Args:
            path: Configuration path (e.g., 'validation.correlation_threshold')
            
        Returns:
            Configuration value
            
        Raises:
            KeyError: If setting doesn't exist
        """
        try:
            value = self._config
            for key in path.split('.'):
                value = value[key]
            return value
            
        except KeyError:
            self.logger.error(f"Configuration setting not found: {path}")
            raise
        except Exception as e:
            self.logger.error(f"Error retrieving setting {path}: {str(e)}")
            raise

    def _deep_update(self, d: Dict[str, Any], u: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively update a dictionary.
        
        Args:
            d: Dictionary to update
            u: Dictionary containing updates
            
        Returns:
            Updated dictionary
        """
        for k, v in u.items():
            if isinstance(v, dict) and k in d and isinstance(d[k], dict):
                self._deep_update(d[k], v)
            else:
                d[k] = v
        return d

    @property
    def config(self) -> Dict[str, Any]:
        """Get the current configuration.
        
        Returns:
            Current configuration dictionary
        """
        return self._config.copy()

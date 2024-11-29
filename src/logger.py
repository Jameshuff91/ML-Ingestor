import logging
import os
import yaml

def setup_logger():
    # Load config
    with open('config.yaml', 'r') as f:
        config = yaml.safe_load(f)
    
    # Create logs directory if it doesn't exist
    os.makedirs(os.path.dirname(config['logging']['file']), exist_ok=True)
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, config['logging']['level']),
        format=config['logging']['format'],
        handlers=[
            logging.FileHandler(config['logging']['file']),
            logging.StreamHandler()
        ]
    )
    
    return logging.getLogger(__name__)

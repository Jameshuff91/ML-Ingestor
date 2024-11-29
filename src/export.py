import pandas as pd
import json
import os
from typing import Dict, Any, Optional
from src.logger import setup_logger
from src.config import ConfigManager

logger = setup_logger()

class DataExporter:
    """Handles data export in various formats with optional compression."""
    
    def __init__(self, config_path: str = 'config.yaml'):
        """Initialize DataExporter.
        
        Args:
            config_path: Path to configuration file
        """
        self.config = ConfigManager(config_path)
        self.logger = logger

    def export(self, 
               data: pd.DataFrame, 
               output_path: str, 
               format: str = 'csv',
               compression: Optional[str] = None,
               metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Export data to specified format.
        
        Args:
            data: DataFrame to export
            output_path: Path to save exported data
            format: Export format ('csv', 'json', or 'parquet')
            compression: Compression method (e.g., 'gzip', 'bz2', 'zip')
            metadata: Optional metadata to include with export
            
        Returns:
            Dict containing export results
            
        Raises:
            ValueError: If format is invalid or export fails
        """
        try:
            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Validate format
            format = format.lower()
            if format not in ['csv', 'json', 'parquet']:
                raise ValueError(f"Unsupported format: {format}")
            
            # Export based on format
            if format == 'csv':
                self._export_csv(data, output_path, compression)
            elif format == 'json':
                self._export_json(data, output_path, metadata)
            else:  # parquet
                self._export_parquet(data, output_path, compression)
            
            # Return export results
            return {
                'path': output_path,
                'rows_exported': len(data),
                'format': format,
                'compression': compression,
                'has_metadata': metadata is not None
            }
            
        except Exception as e:
            self.logger.error(f"Export failed: {str(e)}")
            raise

    def _export_csv(self, 
                   data: pd.DataFrame, 
                   output_path: str,
                   compression: Optional[str]) -> None:
        """Export data to CSV format.
        
        Args:
            data: DataFrame to export
            output_path: Output file path
            compression: Compression method
        """
        try:
            data.to_csv(
                output_path,
                index=False,
                compression=compression
            )
            self.logger.info(f"Successfully exported CSV to {output_path}")
            
        except Exception as e:
            self.logger.error(f"CSV export failed: {str(e)}")
            raise

    def _export_json(self, 
                    data: pd.DataFrame, 
                    output_path: str,
                    metadata: Optional[Dict[str, Any]]) -> None:
        """Export data to JSON format with optional metadata.
        
        Args:
            data: DataFrame to export
            output_path: Output file path
            metadata: Optional metadata to include
        """
        try:
            # Convert DataFrame to dict
            data_dict = data.to_dict(orient='records')
            
            # Combine with metadata if provided
            if metadata:
                output_data = {
                    'metadata': metadata,
                    'data': data_dict
                }
            else:
                output_data = data_dict
            
            # Write to file
            with open(output_path, 'w') as f:
                json.dump(output_data, f, indent=2)
                
            self.logger.info(f"Successfully exported JSON to {output_path}")
            
        except Exception as e:
            self.logger.error(f"JSON export failed: {str(e)}")
            raise

    def _export_parquet(self, 
                       data: pd.DataFrame, 
                       output_path: str,
                       compression: Optional[str] = 'snappy') -> None:
        """Export data to Parquet format.
        
        Args:
            data: DataFrame to export
            output_path: Output file path
            compression: Compression method (default: 'snappy')
        """
        try:
            data.to_parquet(
                output_path,
                compression=compression or 'snappy'  # Parquet default compression
            )
            self.logger.info(f"Successfully exported Parquet to {output_path}")
            
        except Exception as e:
            self.logger.error(f"Parquet export failed: {str(e)}")
            raise

    def validate_export_settings(self, 
                               format: str,
                               compression: Optional[str] = None) -> bool:
        """Validate export format and compression settings.
        
        Args:
            format: Export format
            compression: Compression method
            
        Returns:
            True if settings are valid
            
        Raises:
            ValueError: If settings are invalid
        """
        # Validate format
        valid_formats = ['csv', 'json', 'parquet']
        if format.lower() not in valid_formats:
            raise ValueError(f"Invalid format. Must be one of {valid_formats}")
        
        # Validate compression if specified
        if compression:
            valid_compression = {
                'csv': ['gzip', 'bz2', 'zip', 'xz'],
                'parquet': ['snappy', 'gzip', 'brotli']
            }
            
            if format in valid_compression:
                if compression not in valid_compression[format]:
                    raise ValueError(
                        f"Invalid compression for {format}. "
                        f"Must be one of {valid_compression[format]}"
                    )
            else:
                raise ValueError(f"Compression not supported for {format} format")
        
        return True

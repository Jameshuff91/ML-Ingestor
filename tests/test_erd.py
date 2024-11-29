import unittest
import pandas as pd
import os
from src.erd import ERDGenerator

class TestERDGenerator(unittest.TestCase):
    def setUp(self):
        """Set up test cases."""
        self.erd_generator = ERDGenerator()
        self.test_data = pd.DataFrame({
            'id': [1, 2, 3],
            'name': ['test1', 'test2', 'test3'],
            'value': [10.0, 20.0, 30.0]
        })
        self.test_filename = 'test_data.csv'

    def test_generate_erd_lr(self):
        """Test ERD generation with left-to-right orientation."""
        erd_path = self.erd_generator.generate_erd(
            self.test_data, 
            self.test_filename,
            orientation='LR'
        )
        self.assertTrue(os.path.exists(os.path.join('static', 'plots', f'erd_{os.path.splitext(self.test_filename)[0]}.png')))
        self.assertEqual(erd_path, os.path.join('static', 'plots', f'erd_{os.path.splitext(self.test_filename)[0]}.png'))

    def test_generate_erd_tb(self):
        """Test ERD generation with top-to-bottom orientation."""
        erd_path = self.erd_generator.generate_erd(
            self.test_data, 
            self.test_filename,
            orientation='TB'
        )
        self.assertTrue(os.path.exists(os.path.join('static', 'plots', f'erd_{os.path.splitext(self.test_filename)[0]}.png')))
        self.assertEqual(erd_path, os.path.join('static', 'plots', f'erd_{os.path.splitext(self.test_filename)[0]}.png'))

    def test_generate_erd_default_orientation(self):
        """Test ERD generation with default orientation."""
        erd_path = self.erd_generator.generate_erd(
            self.test_data, 
            self.test_filename
        )
        self.assertTrue(os.path.exists(os.path.join('static', 'plots', f'erd_{os.path.splitext(self.test_filename)[0]}.png')))
        self.assertEqual(erd_path, os.path.join('static', 'plots', f'erd_{os.path.splitext(self.test_filename)[0]}.png'))

    def tearDown(self):
        """Clean up test files."""
        test_file = os.path.join('static', 'plots', f'erd_{os.path.splitext(self.test_filename)[0]}.png')
        if os.path.exists(test_file):
            os.remove(test_file)

if __name__ == '__main__':
    unittest.main()

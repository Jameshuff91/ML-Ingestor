import unittest
from unittest.mock import patch, MagicMock
import os
import anthropic
from src.llm import call_claude_api

class TestLLM(unittest.TestCase):
    """Test cases for LLM functionality."""

    def setUp(self):
        """Set up test environment."""
        # Ensure environment variable is set for testing
        os.environ["ANTHROPIC_API_KEY"] = "test_key"

    @patch('anthropic.Anthropic')
    def test_call_claude_api_success(self, mock_anthropic):
        """Test successful API call to Claude."""
        # Mock response
        mock_content = MagicMock()
        mock_content.text = "Test response"
        mock_response = MagicMock()
        mock_response.content = [mock_content]
        mock_response.model_dump.return_value = {"response": "test"}
        
        # Set up mock client
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        # Test API call
        result = call_claude_api("Test prompt")
        
        # Verify the call was made with correct parameters
        mock_client.messages.create.assert_called_once_with(
            model="claude-3-5-sonnet-20240620",
            max_tokens=8192,
            messages=[{"role": "user", "content": "Test prompt"}],
            system="",
            extra_headers={"anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"}
        )
        
        self.assertEqual(result, "Test response")

    @patch('anthropic.Anthropic')
    def test_call_claude_api_timeout(self, mock_anthropic):
        """Test API timeout handling."""
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = anthropic.APITimeoutError("Request timed out.")
        mock_anthropic.return_value = mock_client

        result = call_claude_api("Test prompt")
        self.assertEqual(result, "Error calling Claude API: Request timed out.")

    @patch('anthropic.Anthropic')
    def test_call_claude_api_error(self, mock_anthropic):
        """Test API error handling."""
        mock_client = MagicMock()
        mock_request = MagicMock()
        mock_client.messages.create.side_effect = anthropic.APIError(
            message="API Error",
            request=mock_request,
            body={"error": {"message": "API Error"}}
        )
        mock_anthropic.return_value = mock_client

        result = call_claude_api("Test prompt")
        self.assertEqual(result, "Error calling Claude API: API Error")

    @patch('anthropic.Anthropic')
    def test_long_prompt_truncation(self, mock_anthropic):
        """Test that long prompts are truncated."""
        # Mock the API client
        mock_content = MagicMock()
        mock_content.text = "Test response"
        mock_response = MagicMock()
        mock_response.content = [mock_content]
        mock_response.model_dump.return_value = {"response": "test"}
        
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        # Test with a long prompt
        long_prompt = "x" * 200000
        result = call_claude_api(long_prompt)
        
        # Verify the result
        self.assertEqual(result, "Test response")
        
        # Verify that the prompt was truncated
        actual_call = mock_client.messages.create.call_args
        self.assertLess(
            len(actual_call[1]['messages'][0]['content']), 
            200000
        )

if __name__ == '__main__':
    unittest.main()

import os
import json
import logging
import anthropic
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type((anthropic.APITimeoutError, anthropic.APIError))
)
def call_claude_api(prompt: str, system_content: str = "") -> str:
    """
    Calls the Anthropic Claude API with the given prompt and returns the response as a string.
    """
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        logging.info("Anthropic client initialized successfully.")

        # Limit the prompt to 190000 tokens to stay within the maximum allowed
        MAX_TOKENS = 190000
        if len(prompt) > MAX_TOKENS:
            prompt = prompt[:MAX_TOKENS]
            logging.warning("Prompt truncated to fit the token limit.")

        messages = [{"role": "user", "content": prompt}]

        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=8192,
            messages=messages,
            system=system_content if system_content else "",
        )
        logging.info("Received response from Anthropic Claude API.")
        
        # Log the entire response object as JSON
        logging.debug(f"Raw API response: {json.dumps(response.model_dump(), indent=2)}")
        
        if response.content:
            message_content = response.content[0].text
            if isinstance(message_content, list):
                message_content = '\n'.join(message_content)
            return message_content
        else:
            logging.warning("Received empty content from Claude API")
            return ""

    except anthropic.APITimeoutError as e:
        logging.error(f"Request timed out: {str(e)}", exc_info=True)
        return f"Error calling Claude API: {e}"
    except anthropic.APIError as e:
        logging.error(f"API Error: {str(e)}", exc_info=True)
        return f"Error calling Claude API: {e}"
    except Exception as e:
        logging.error(f"Unexpected Error in call_claude_api: {str(e)}", exc_info=True)
        return f"Error: {e}"

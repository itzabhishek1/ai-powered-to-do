import google.generativeai as genai
import json
import os
import logging
from datetime import datetime
from django.conf import settings

logger = logging.getLogger('todo_app')

_gemini_initialized = False

# Initialize the Gemini API client
def init_gemini_api():
    global _gemini_initialized
    if _gemini_initialized:
        return True
    api_key = os.environ.get('GEMINI_API_KEY')
    logger.debug(f"init_gemini_api: GEMINI_API_KEY={api_key}")
    if not api_key:
        logger.warning("GEMINI_API_KEY not found in environment variables")
        return False
    
    genai.configure(api_key=api_key)
    _gemini_initialized = True
    return True

# Process the voice input with Gemini
def process_with_gemini(voice_input):
    logger.debug(f"process_with_gemini called with voice_input={voice_input}")
    # Check API initialization
    if not init_gemini_api():
        logger.warning("GEMINI_API_KEY missing, using fallback for process_with_gemini")
        return {
            "success": True,
            "task_data": {"title": voice_input, "description": "", "deadline": ""},
            "original_input": voice_input
        }
    try:
        # Define the prompt for Gemini
        prompt = f"""
        Extract task information from this voice input and return a valid JSON with the following fields:
        - title: A concise title for the task
        - description: More detailed description of the task
        - deadline: A date and time in ISO format (YYYY-MM-DDThh:mm) if specified, or null if not provided
        
        Voice input: "{voice_input}"
        
        Example response format:
        {{
            "title": "Complete project report",
            "description": "Finish writing the executive summary and conclusions",
            "deadline": "2023-12-25T15:30"
        }}
        
        Return ONLY the JSON object with no additional text.
        """
        
        logger.debug(f"process_with_gemini: prompt={prompt}")
        
        # Configure the model
        generation_config = {
            "temperature": 0.2,
            "top_p": 0.95,
            "top_k": 64
        }
        
        # Get the Gemini model
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            generation_config=generation_config
        )
        
        # Generate the response
        response = model.generate_content(prompt)
        # Retrieve text from response
        raw_text = None
        if hasattr(response, 'text') and response.text:
            raw_text = response.text
        elif hasattr(response, 'generated_text'):
            raw_text = response.generated_text
        else:
            raw_text = str(response)
        
        try:
            # First try direct parsing of raw_text
            task_data = json.loads(raw_text)
        except json.JSONDecodeError:
            # Fallback: extract JSON inside markdown or text
            import re
            pattern = r'```json\s*([\s\S]*?)\s*```|```\s*([\s\S]*?)\s*```|(\{[\s\S]*?\})'
            match = re.search(pattern, raw_text)
            if match:
                json_str = next(g for g in match.groups() if g)
                task_data = json.loads(json_str)
            else:
                raise ValueError("Could not extract valid JSON from Gemini response")
                
        # Validate the structure
        if not isinstance(task_data, dict):
            raise ValueError("Response is not a dictionary")
        
        required_keys = ['title', 'description']
        for key in required_keys:
            if key not in task_data:
                task_data[key] = ""
        
        if 'deadline' in task_data and task_data['deadline']:
            try:
                parsed_date = datetime.fromisoformat(task_data['deadline'].replace('Z', '+00:00'))
                task_data['deadline'] = parsed_date.strftime('%Y-%m-%dT%H:%M')
            except ValueError:
                task_data['deadline'] = ""
        else:
            task_data['deadline'] = ""
        
        return {
            "success": True,
            "task_data": task_data,
            "original_input": voice_input
        }
        
    except Exception as e:
        logger.error(f"Error processing with Gemini: {str(e)}", exc_info=True)
        # Fallback: return the raw voice input as title if Gemini fails
        return {
            "success": True,
            "task_data": {"title": voice_input, "description": "", "deadline": ""},
            "original_input": voice_input
        }

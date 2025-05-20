from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json
import logging

from .gemini_integration import process_with_gemini

logger = logging.getLogger('todo_app')

@csrf_exempt
@require_http_methods(["POST"])
def smart_voice_process_api(request):
    """Process voice input using Gemini API to structure task data"""
    try:
        data = json.loads(request.body)
        voice_text = data.get('voiceText', '')
        
        if not voice_text:
            return JsonResponse({'success': False, 'error': 'Voice text is required'}, status=400)
        
        # Process the voice input with Gemini
        gemini_result = process_with_gemini(voice_text)
        
        if not gemini_result['success']:
            return JsonResponse({
                'success': False, 
                'error': gemini_result.get('error', 'Failed to process with Gemini'),
                'original_input': voice_text
            }, status=500)
            
        # Return the structured task data
        return JsonResponse({
            'success': True,
            'task_data': gemini_result['task_data'],
            'original_input': voice_text
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f"Error in smart_voice_process_api: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

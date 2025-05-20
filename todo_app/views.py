from django.shortcuts import render, get_object_or_404, redirect, redirect
from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt # For simplicity in API, consider CSRF for web forms
from django.utils import timezone
from dateutil import parser # For robust ISO date string parsing
import json
import os
import logging # Import the logging module
import datetime # Import the datetime module
from django.conf import settings

from .models import Task
from .ai_features import (
    calculate_task_complexity,
    estimate_task_duration,
    calculate_completion_probability,
    parse_voice_command,
    analyze_user_patterns
)
from .gemini_integration import process_with_gemini

# Get an instance of a logger
logger = logging.getLogger('todo_app') # Explicitly use the 'todo_app' logger

# Serve static index.html
def index(request):
    # Redirect to the Next.js frontend
    return redirect(settings.FRONTEND_URL)
    
    # For production, consider serving a built static HTML instead of redirecting

@csrf_exempt # Use with caution, ensure proper auth/auth for production APIs
@require_http_methods(["GET", "POST"])
def task_list_create_api(request):
    if request.method == 'GET':
        # Auto-transition any expired ongoing tasks to ‘failure’ before fetching
        Task.objects.filter(deadline__lt=timezone.now(), status='ongoing').update(status='failure')
        tasks = Task.objects.all()
        ongoing_tasks = [task.to_dict() for task in tasks if task.status == 'ongoing']
        success_tasks = [task.to_dict() for task in tasks if task.status == 'success']
        failure_tasks = [task.to_dict() for task in tasks if task.status == 'failure']
        
        return JsonResponse({
            'ongoing': ongoing_tasks,
            'success': success_tasks,
            'failure': failure_tasks
        })

    elif request.method == 'POST':
        try:
            logger.debug(f"Received POST request to /api/tasks. Request body: {request.body}")
            data = json.loads(request.body)
            logger.debug(f"Parsed JSON data: {data}")
            
            raw_deadline = data.get('deadline')
            if not raw_deadline:
                return JsonResponse({'error': 'Deadline is required'}, status=400)
            
            # Use dateutil.parser for robust ISO format parsing
            try:
                deadline_dt = parser.isoparse(raw_deadline)
            except ValueError:
                return JsonResponse({'error': 'Invalid deadline format. Use ISO 8601.'}, status=400)

            # Ensure deadline is timezone-aware (Django default) or convert to naive if your model expects that
            # Our model's deadline is DateTimeField, which stores as UTC if USE_TZ=True
            if deadline_dt.tzinfo is None: # If naive, assume UTC as per Flask app's datetime.utcnow()
                 deadline_dt = timezone.make_aware(deadline_dt, datetime.timezone.utc) # Use datetime.timezone.utc
            else: # If aware, convert to UTC
                 deadline_dt = deadline_dt.astimezone(datetime.timezone.utc) # Use datetime.timezone.utc


            title = data.get('title')
            description = data.get('description', '')

            if not title:
                return JsonResponse({'error': 'Title is required'}, status=400)

            complexity = calculate_task_complexity(title, description)
            duration = estimate_task_duration(title, description, complexity)
            
            task = Task(
                title=title,
                description=description,
                deadline=deadline_dt,
                complexity_score=complexity,
                estimated_duration=duration
            )
            
            user_history_qs = Task.objects.filter(status__in=['success', 'failure'])
            task.risk_score = calculate_completion_probability(task, user_history_qs)
            
            task.save() # This will also set created_at and updated_at
            
            return JsonResponse(task.to_dict(), status=201)
        except json.JSONDecodeError as e:
            logger.error(f"JSONDecodeError in create_task: {e}. Request body: {request.body}")
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error(f"Exception in create_task: {e}", exc_info=True) # exc_info=True will log the full traceback
            return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt # Use with caution
@require_http_methods(["GET", "PUT", "DELETE"]) # GET for completeness, though not in Flask
def task_detail_api(request, task_id):
    task = get_object_or_404(Task, id=task_id)

    if request.method == 'GET':
        return JsonResponse(task.to_dict())

    elif request.method == 'PUT':
        try:
            data = json.loads(request.body)
            
            if 'title' in data:
                task.title = data['title']
            if 'description' in data:
                task.description = data['description']
            if 'deadline' in data:
                raw_deadline = data['deadline']
                try:
                    deadline_dt = parser.isoparse(raw_deadline)
                    if deadline_dt.tzinfo is None:
                         deadline_dt = timezone.make_aware(deadline_dt, datetime.timezone.utc) # Use datetime.timezone.utc
                    else:
                         deadline_dt = deadline_dt.astimezone(datetime.timezone.utc) # Use datetime.timezone.utc
                    task.deadline = deadline_dt
                except ValueError:
                    return JsonResponse({'error': 'Invalid deadline format. Use ISO 8601.'}, status=400)

            if 'status' in data:
                task.status = data['status']
            
            # updated_at is handled by auto_now=True in the model
            task.save()
            # Recalculate risk score on update if relevant fields changed
            user_history_qs = Task.objects.filter(status__in=['success', 'failure'])
            task.risk_score = calculate_completion_probability(task, user_history_qs)
            task.save() # Save again to store updated risk score

            return JsonResponse(task.to_dict())
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    elif request.method == 'DELETE':
        task.delete()
        return HttpResponse(status=204)


@csrf_exempt # Use with caution
@require_http_methods(["POST"])
def process_voice_command_api(request):
    try:
        data = json.loads(request.body)
        command = data.get('command', '')
        if not command:
            return JsonResponse({'success': False, 'error': 'Command is required'}, status=400)

        parsed_task_data = parse_voice_command(command) # Returns timezone-aware deadline
        
        complexity = calculate_task_complexity(parsed_task_data['title'], parsed_task_data.get('description', ''))
        duration = estimate_task_duration(parsed_task_data['title'], parsed_task_data.get('description', ''), complexity)
        
        task = Task(
            title=parsed_task_data['title'],
            description=parsed_task_data.get('description', ''),
            deadline=parsed_task_data['deadline'], # Already timezone-aware from parse_voice_command
            complexity_score=complexity,
            estimated_duration=duration
        )
        
        user_history_qs = Task.objects.filter(status__in=['success', 'failure'])
        task.risk_score = calculate_completion_probability(task, user_history_qs)
        
        task.save()
        
        return JsonResponse({
            'success': True,
            'task': task.to_dict(),
            'parsed_command': parsed_task_data, # Send back what was parsed
            'original_command': command
        }, status=201)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        # Log the exception e for debugging
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

@require_http_methods(["GET"])
def get_analytics_api(request):
    try:
        patterns = analyze_user_patterns()
        
        high_risk_tasks_qs = Task.objects.filter(
            status='ongoing',
            risk_score__gte=0.7 # Django ORM syntax for >=
        )
        
        analytics = {
            'user_patterns': patterns,
            'high_risk_tasks': [task.to_dict() for task in high_risk_tasks_qs],
            'total_high_risk': high_risk_tasks_qs.count(),
            'risk_distribution': {
                'high': Task.objects.filter(status='ongoing', risk_score__gte=0.7).count(),
                'medium': Task.objects.filter(status='ongoing', risk_score__gte=0.4, risk_score__lt=0.7).count(),
                'low': Task.objects.filter(status='ongoing', risk_score__lt=0.4).count()
            }
        }
        return JsonResponse(analytics)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt # Use with caution
@require_http_methods(["POST"]) # Changed to POST as it modifies data
def complete_task_api(request, task_id):
    task = get_object_or_404(Task, id=task_id)
    
    if task.status == 'ongoing':
        now = timezone.now()
        if task.deadline > now:
            task.status = 'success'
        else:
            task.status = 'failure'
        
        # updated_at is handled by auto_now=True
        task.save()
    
    return JsonResponse(task.to_dict())

@csrf_exempt
@require_http_methods(["POST"])
def smart_voice_process_api(request):
    """Process voice input using Gemini API to structure task data"""
    try:
        data = json.loads(request.body)
        voice_text = data.get('voiceText', '')
        logger.debug(f"smart_voice_process_api called with voiceText={voice_text}")
        
        if not voice_text:
            return JsonResponse({'success': False, 'error': 'Voice text is required'}, status=400)
        
        # Process the voice input with Gemini
        gemini_result = process_with_gemini(voice_text)
        logger.debug(f"Gemini result: {gemini_result}")
        
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
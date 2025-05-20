from datetime import datetime, timedelta
from django.utils import timezone 
from .models import Task 
import re

# AI Features for Risk Assessment
def calculate_task_complexity(title, description):
    """Calculate task complexity score based on content analysis"""
    complexity_keywords = {
        'high': ['urgent', 'critical', 'important', 'asap', 'immediately', 'complex', 'difficult'],
        'medium': ['meeting', 'review', 'prepare', 'organize', 'plan'],
        'low': ['simple', 'easy', 'quick', 'basic']
    }
    
    text = f"{title} {description}".lower() if description else title.lower()
    score = 50  # baseline
    
    for keyword in complexity_keywords['high']:
        if keyword in text:
            score += 15
    
    for keyword in complexity_keywords['medium']:
        if keyword in text:
            score += 10
    
    for keyword in complexity_keywords['low']:
        if keyword in text:
            score -= 10
    
    # Consider task length
    if description and len(description) > 100:
        score += 10
    
    return min(max(score, 0), 100)

def estimate_task_duration(title, description, complexity_score):
    """Estimate task duration based on content and complexity"""
    text = f"{title} {description}".lower() if description else title.lower()
    
    # Base duration mapping
    duration_keywords = {
        'quick': 15,
        'simple': 30,
        'meeting': 60,
        'review': 45,
        'complex': 120,
        'project': 180
    }
    
    duration = 60  # default 1 hour
    
    for keyword, mins in duration_keywords.items():
        if keyword in text:
            duration = mins
            break
    
    # Adjust based on complexity
    if complexity_score > 80:
        duration *= 1.5
    elif complexity_score < 30:
        duration *= 0.7
    
    return int(duration)

def calculate_completion_probability(task, user_history_qs=None):
    """Calculate probability of completing task on time using AI analysis"""
    now = timezone.now() 
    if not task.deadline: # Handle case where deadline might not be set
        return 0.5 # Default risk if no deadline

    time_until_deadline = (task.deadline - now).total_seconds() / 3600  # hours
    
    # Base probability factors
    risk_factors = []
    
    # Time pressure factor
    if time_until_deadline < 0: # Deadline has passed
        risk_factors.append(0.5) # High risk if already past deadline
    elif time_until_deadline < 2:  # Less than 2 hours
        risk_factors.append(0.3)
    elif time_until_deadline < 24:  # Less than 1 day
        risk_factors.append(0.2)
    elif time_until_deadline < 72:  # Less than 3 days
        risk_factors.append(0.1)
    else:
        risk_factors.append(0.0)
    
    # Complexity factor
    complexity_risk = (task.complexity_score / 100) * 0.3
    risk_factors.append(complexity_risk)
    
    # Duration vs time available factor
    hours_available = max(0, time_until_deadline) # Can't be negative
    hours_needed = task.estimated_duration / 60
    
    if hours_needed > hours_available and hours_available > 0: # if time available is 0, it's already very risky
        risk_factors.append(0.4)  # Very risky
    elif hours_needed > hours_available * 0.8 and hours_available > 0:
        risk_factors.append(0.2)  # Somewhat risky
    elif hours_available <= 0 and hours_needed > 0: # No time available but task needs time
        risk_factors.append(0.4)
    else:
        risk_factors.append(0.0)  # Good buffer or task needs no time
    
    # Historical performance 
    if user_history_qs and user_history_qs.exists():
        completed_tasks_count = user_history_qs.count()
        successful_tasks_count = user_history_qs.filter(status='success').count()
        if completed_tasks_count > 0:
            completion_rate = successful_tasks_count / completed_tasks_count
            historical_risk = (1 - completion_rate) * 0.2 # Weighted less
            risk_factors.append(historical_risk)
    
    # Calculate final risk score
    total_risk = min(sum(risk_factors), 1.0) # Cap at 1.0
    return round(total_risk, 3)


def analyze_user_patterns():
    """Analyze user task completion patterns"""
    all_tasks = Task.objects.all()
    if all_tasks.count() < 3:
        return {"message": "Need more task history for analysis", "success_rate": None, "avg_completion_time": None, "risk_profile": None}
    
    completed_tasks_qs = Task.objects.filter(status__in=['success', 'failure'])
    
    if not completed_tasks_qs.exists():
        return {"message": "No completed tasks for analysis", "success_rate": None, "avg_completion_time": None, "risk_profile": None}

    successful_tasks_qs = completed_tasks_qs.filter(status='success')
    success_rate = successful_tasks_qs.count() / completed_tasks_qs.count() if completed_tasks_qs.count() > 0 else 0
    
    avg_completion_time_seconds = 0
    if successful_tasks_qs.exists():
        total_completion_seconds = sum(
            [(t.updated_at - t.created_at).total_seconds() for t in successful_tasks_qs]
        )
        avg_completion_time_seconds = total_completion_seconds / successful_tasks_qs.count()
    
    avg_completion_hours = avg_completion_time_seconds / 3600
    
    return {
        "total_tasks": all_tasks.count(),
        "success_rate": round(success_rate * 100, 1),
        "avg_completion_time_hours": round(avg_completion_hours, 1), # Changed key name for clarity
        "risk_profile": "low" if success_rate > 0.8 else "medium" if success_rate > 0.6 else "high"
    }

# Voice Command Parser
def parse_voice_command(command):
    """Parse natural language voice commands into task data"""
    command = command.lower().strip()
    
    task_data = {
        'title': '',
        'description': '',
        'deadline': None 
    }
    
    prefixes = ['create task', 'add task', 'new task', 'remind me to', 'i need to']
    for prefix in prefixes:
        if command.startswith(prefix):
            command = command[len(prefix):].strip()
            break
            
    now = timezone.now()

    # Adjusted deadline patterns for Django's timezone.now()
    deadline_patterns = [
        (r'by (\d{1,2})(am|pm)', lambda m: now.replace(hour=int(m.group(1)) % 12 + (12 if m.group(2) == 'pm' else 0), minute=0, second=0, microsecond=0)),
        (r'tomorrow at (\d{1,2})(am|pm)', lambda m: (now + timedelta(days=1)).replace(hour=int(m.group(1)) % 12 + (12 if m.group(2) == 'pm' else 0), minute=0, second=0, microsecond=0)),
        (r'tomorrow', lambda m: (now + timedelta(days=1)).replace(hour=23, minute=59, second=59)), # Default end of tomorrow
        (r'today at (\d{1,2})(am|pm)', lambda m: now.replace(hour=int(m.group(1)) % 12 + (12 if m.group(2) == 'pm' else 0), minute=0, second=0, microsecond=0)),
        (r'today', lambda m: now.replace(hour=23, minute=59, second=59)), # Default end of today
        (r'next week', lambda m: (now + timedelta(weeks=1)).replace(hour=23, minute=59, second=59)),
        (r'in (\d+) hours?', lambda m: now + timedelta(hours=int(m.group(1)))),
        (r'in (\d+) days?', lambda m: now + timedelta(days=int(m.group(1)))),
        # More specific day matching:
        (r'(next )?monday', lambda m: get_next_weekday(now, 0, bool(m.group(1)))),
        (r'(next )?tuesday', lambda m: get_next_weekday(now, 1, bool(m.group(1)))),
        (r'(next )?wednesday', lambda m: get_next_weekday(now, 2, bool(m.group(1)))),
        (r'(next )?thursday', lambda m: get_next_weekday(now, 3, bool(m.group(1)))),
        (r'(next )?friday', lambda m: get_next_weekday(now, 4, bool(m.group(1)))),
        (r'(next )?saturday', lambda m: get_next_weekday(now, 5, bool(m.group(1)))),
        (r'(next )?sunday', lambda m: get_next_weekday(now, 6, bool(m.group(1)))),
    ]
    

    matched_pattern = None
    for pattern_regex, deadline_func in deadline_patterns:
        match = re.search(pattern_regex, command)
        if match:
            current_match_span = match.span()
            is_sub_match = False
            if matched_pattern:
                pass 

            task_data['deadline'] = deadline_func(match)
            command = command[:match.start()].strip() + " " + command[match.end():].strip()
            command = command.strip()
            matched_pattern = pattern_regex 
            break 
            
    if not task_data['deadline']:
        task_data['deadline'] = (now + timedelta(days=1)).replace(hour=23, minute=59, second=59) # Default to end of tomorrow
    
    # Extract title and description
    if ' about ' in command:
        parts = command.split(' about ', 1)
        task_data['title'] = parts[0].strip()
        task_data['description'] = parts[1].strip()
    elif ' for ' in command: # 'for' might be part of a time phrase like 'for 2 hours'
        # Ensure 'for' is not part of a time phrase that was already parsed
        if not (matched_pattern and 'for' in matched_pattern):
            parts = command.split(' for ', 1)
            task_data['title'] = parts[0].strip()
            task_data['description'] = parts[1].strip()
        else:
            task_data['title'] = command.strip() # Use whole command if 'for' was part of deadline
    else:
        task_data['title'] = command.strip()
    
    task_data['title'] = task_data['title'].strip(' .,!?')
    if not task_data['title']:
        task_data['title'] = "Voice command task"
    
    return task_data

def get_next_weekday(start_date, weekday_to_find, is_next_week_specified):
    """
    Finds the next occurrence of a specific weekday.
    weekday_to_find: 0=Monday, 1=Tuesday, ..., 6=Sunday
    is_next_week_specified: True if "next" (e.g., "next monday") was used.
    """
    days_ahead = weekday_to_find - start_date.weekday()
    if days_ahead <= 0 or (days_ahead == 0 and not is_next_week_specified and start_date.time() > datetime.min.time()):
        # If it's today but past the "default" time, or it's a past day of this week,
        # or "next" was specified for today.
        days_ahead += 7
    if is_next_week_specified and days_ahead <= 7 and start_date.weekday() == weekday_to_find : # e.g. "next monday" when today is monday
         days_ahead +=7


    target_date = start_date + timedelta(days=days_ahead)
    return target_date.replace(hour=23, minute=59, second=59) # Default to end of day
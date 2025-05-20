from django.utils import timezone
from .models import Task
from .ai_features import calculate_completion_probability
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.models import DjangoJobExecution
from apscheduler.schedulers.background import BackgroundScheduler
import logging

from .metrics import JOB_SUCCESS_COUNTER, JOB_FAILURE_COUNTER, JOB_DURATION_HISTOGRAM

# Get an instance of a logger
logger = logging.getLogger(__name__)

def update_task_statuses_job():
    """
    Background job to update statuses of expired tasks and recalculate risk scores, with Prometheus monitoring.
    """
    job_id = 'update_task_statuses_job'
    with JOB_DURATION_HISTOGRAM.labels(job_id).time():
        try:
            now = timezone.now()
            updated_expired_count = 0
            updated_risk_score_count = 0

            # Update expired tasks
            expired_tasks = Task.objects.filter(deadline__lt=now, status='ongoing')
            for task in expired_tasks:
                task.status = 'failure'
                task.save()
                updated_expired_count += 1

            # Update risk scores for ongoing tasks
            ongoing_tasks = Task.objects.filter(status='ongoing')
            user_history_qs = Task.objects.filter(status__in=['success', 'failure'])
            for task in ongoing_tasks:
                new_risk_score = calculate_completion_probability(task, user_history_qs)
                if task.risk_score != new_risk_score:
                    task.risk_score = new_risk_score
                    task.save()
                    updated_risk_score_count += 1

            if updated_expired_count > 0 or updated_risk_score_count > 0:
                logger.info(f"Background job: Updated {updated_expired_count} expired tasks and risk scores for {updated_risk_score_count} ongoing tasks.")
            else:
                logger.info("Background job: No tasks required status or risk score updates.")

            JOB_SUCCESS_COUNTER.labels(job_id).inc()
        except Exception as e:
            JOB_FAILURE_COUNTER.labels(job_id).inc()
            logger.error(f"Scheduler job {job_id} failed: {e}", exc_info=True)
            raise
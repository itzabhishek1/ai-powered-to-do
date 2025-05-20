from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.jobstores import DjangoJobStore, register_events
import logging

logger = logging.getLogger(__name__)

from django.utils import timezone

from .jobs import update_task_statuses_job
from .metrics import start_metrics_server
from django.conf import settings


def start():
    # Start Prometheus metrics server
    port = getattr(settings, 'METRICS_PORT', 8080)
    start_metrics_server(port)
    logger.info(f"Started Prometheus metrics server on port {port}.")

    """
    Initialize and start the APScheduler for updating task statuses.
    """
    scheduler = BackgroundScheduler()
    scheduler.add_jobstore(DjangoJobStore(), 'default')
    
    # Schedule status update job every minute
    scheduler.add_job(
        update_task_statuses_job,
        trigger='interval',
        minutes=1,
        id='update_task_statuses_job',
        replace_existing=True,
        max_instances=1
    )

    # Register APScheduler events for logging
    register_events(scheduler)

    try:
        scheduler.start()
        logger.info("APScheduler started: update_task_statuses_job scheduled every 1 minute.")
    except Exception as e:
        logger.error(f"Failed to start APScheduler: {e}")

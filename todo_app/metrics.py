from prometheus_client import Counter, Histogram, start_http_server
import logging
import errno

# Initialize logger and state tracking
logger = logging.getLogger(__name__)
# Track ports where the metrics server has been started
_started_ports = set()

# Define Prometheus metrics for scheduler jobs
JOB_SUCCESS_COUNTER = Counter(
    'scheduler_job_success_total',
    'Total number of successful scheduler job executions',
    ['job_id']
)
JOB_FAILURE_COUNTER = Counter(
    'scheduler_job_failure_total',
    'Total number of failed scheduler job executions',
    ['job_id']
)
JOB_DURATION_HISTOGRAM = Histogram(
    'scheduler_job_duration_seconds',
    'Duration of scheduler job executions in seconds',
    ['job_id']
)


def start_metrics_server(port: int = 9090):
    """
    Start Prometheus HTTP metrics server on given port.
    """
    global _started_ports
    # Avoid restarting on the same port
    if port in _started_ports:
        return
    try:
        start_http_server(port)
        _started_ports.add(port)
    except OSError as e:
        if e.errno == errno.EADDRINUSE:
            logger.warning(f"Metrics server already running on port {port}")
            _started_ports.add(port)
        else:
            raise

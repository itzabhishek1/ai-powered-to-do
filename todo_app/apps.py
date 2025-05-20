from django.apps import AppConfig

class TodoAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'todo_app'

    def ready(self):
        import os
        if os.environ.get('RUN_MAIN') != 'true':
            return
        # Start the APScheduler for auto-transitioning task statuses
        from .scheduler import start as start_scheduler
        start_scheduler()
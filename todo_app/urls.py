from django.urls import path
from . import views


urlpatterns = [
    path('', views.index, name='index'), 
    path('api/tasks', views.task_list_create_api, name='task-list-create-api'),
    path('api/tasks/<uuid:task_id>', views.task_detail_api, name='task-detail-api'),
    path('api/tasks/<uuid:task_id>/complete', views.complete_task_api, name='task-complete-api'), 
    path('api/voice-command', views.process_voice_command_api, name='voice-command-api'),
    path('api/smart-voice', views.smart_voice_process_api, name='smart-voice-api'),
    path('api/analytics', views.get_analytics_api, name='analytics-api'),
]
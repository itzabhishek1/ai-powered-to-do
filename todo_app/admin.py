from django.contrib import admin
from .models import Task

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'deadline', 'complexity_score', 'risk_score', 'created_at', 'updated_at')
    list_filter = ('status', 'deadline', 'complexity_score', 'risk_score')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('title', 'description', 'deadline', 'status')
        }),
        ('AI Features', {
            'fields': ('estimated_duration', 'complexity_score', 'risk_score'),
            'classes': ('collapse',) 
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        if obj: 
            return self.readonly_fields + ('id',)
        return self.readonly_fields
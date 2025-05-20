from django.db import models
from django.utils import timezone
from datetime import timedelta
import uuid

class Task(models.Model):
    STATUS_CHOICES = [
        ('ongoing', 'Ongoing'),
        ('success', 'Success'),
        ('failure', 'Failure'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    deadline = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ongoing')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True) # auto_now updates on every save
    
    estimated_duration = models.IntegerField(default=60)  # minutes
    complexity_score = models.IntegerField(default=50)  # 0-100
    risk_score = models.FloatField(default=0.5)  # 0-1 probability

    def __str__(self):
        return self.title

    def to_dict(self):
        return {
            'id': str(self.id),
            'title': self.title,
            'description': self.description,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'time_remaining': self.get_time_remaining(),
            'estimated_duration': self.estimated_duration,
            'complexity_score': self.complexity_score,
            'risk_score': self.risk_score,
            'risk_level': self.get_risk_level(),
            'completion_probability': round((1 - self.risk_score) * 100, 1) if self.risk_score is not None else None
        }

    def get_time_remaining(self):
        if not self.deadline:
            return "N/A"
        now = timezone.now() # Use timezone.now() for timezone-aware comparison
        if self.deadline > now:
            diff = self.deadline - now
            days = diff.days
            hours, remainder = divmod(diff.seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            
            if days > 0:
                return f"{days}d {hours}h {minutes}m"
            elif hours > 0:
                return f"{hours}h {minutes}m"
            else:
                return f"{minutes}m"
        else:
            return "Expired"

    def get_risk_level(self):
        if self.risk_score is None:
            return "N/A"
        if self.risk_score >= 0.8:
            return 'high'
        elif self.risk_score >= 0.5:
            return 'medium'
        else:
            return 'low'

    class Meta:
        ordering = ['deadline'] # Default ordering for tasks
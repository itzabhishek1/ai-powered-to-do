#!/bin/bash

# Clean frontend cache
echo "🧹 Cleaning frontend cache..."
rm -rf frontend/.next

# Set environment variables
export NEXT_PUBLIC_API_URL="http://localhost:8000/api"

# Start Django backend
echo "🚀 Starting Django backend..."
python manage.py runserver &
DJANGO_PID=$!

# Start Next.js frontend
echo "🚀 Starting Next.js frontend..."
cd frontend && npm run clean-dev

# Kill Django server on exit
trap "kill $DJANGO_PID" EXIT

wait

#!/bin/bash

# Start Django backend with virtual environment
echo "Starting Django backend..."

# Check if venv exists, if not create it
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
  if [ $? -ne 0 ]; then
    echo "Failed to create virtual environment. Please ensure python3 and venv are installed."
    exit 1
  fi
fi

source venv/bin/activate
echo "Installing/updating Django dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
  echo "Failed to install Django dependencies."
  exit 1
fi

# Kill any process that might be using port 8000
echo "Attempting to free up port 8000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || echo "Port 8000 was already free or no process to kill."

python3 manage.py runserver &
DJANGO_PID=$!

# Start Next.js frontend
echo "Starting Next.js frontend..."
cd front-end
echo "Installing/updating Next.js dependencies..."
npm install
if [ $? -ne 0 ]; then
  echo "Failed to install Next.js dependencies. Please ensure Node.js and npm are installed."
  cd .. # Go back to root before exiting if npm install fails
  exit 1
fi
# Set environment variables to help with hydration issues
export NEXT_PUBLIC_API_URL="http://localhost:8000/api"
export NODE_ENV="development"

# Kill any process that might be using port 3002
echo "Attempting to free up port 3002..."
lsof -ti:3002 | xargs kill -9 2>/dev/null || echo "Port 3002 was already free or no process to kill."

# Run Next.js frontend on a fixed port matching FRONTEND_URL with a clean start
env PORT=3002 npm run clean-dev -- -p 3002 &
NEXTJS_PID=$!
cd .. # Go back to the root directory so trap cleanup works correctly

# Function to kill processes on exit
function cleanup {
  echo "Shutting down servers..."
  kill $DJANGO_PID
  kill $NEXTJS_PID
  exit
}

# Register the cleanup function for when script is terminated
trap cleanup SIGINT SIGTERM

echo "Both servers are running. Press Ctrl+C to stop."

# Wait forever (until Ctrl+C)
wait

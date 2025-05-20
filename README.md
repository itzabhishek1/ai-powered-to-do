# Smart Todo List App

A powerful task management application with AI-powered features built with Django (backend) and Next.js (frontend).

## Features

* Task management with ongoing/completed/failed status tracking
* Smart voice commands with Gemini AI integration
* Analytics dashboard with task statistics
* Risk assessment of tasks
* Deadline tracking

## Tech Stack

* **Backend**: Django
* **Frontend**: Next.js with TypeScript & Tailwind CSS
* **AI Integration**: Google Gemini API

## Getting Started

### Prerequisites

* Python 3.8+
* Node.js 16+
* npm/yarn

### Installation

1. Clone this repository

2. Create a virtual environment (optional but recommended):

   ```bash
   rm -rf venv # Only if a venv folder already exist
   python3 -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. Install backend dependencies:

   ```bash
   pip install -r requirements.txt
   ```
4. Update Database section in settings.py file in django_todo_project folder

5. Apply database migrations:

   ```bash
   python3 manage.py migrate
   ```

6. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   ```

### Setup Environment Variables

1. Create a `.env` file in the root directory for Django:

   ```bash
   GEMINI_API_KEY=your_gemini_api_key
   DEBUG=True
   SECRET_KEY=your_secret_key
   FRONTEND_URL=http://localhost:3002
   ```

2. The Next.js frontend already has a `.env.local` file configured.

### Start Development Servers

You can start both the Django backend and Next.js frontend with one command:

```bash
./start-dev.sh
```

Or start them individually:

* Django backend:

  ```bash
  python3 manage.py runserver
  # Or, if port 8000 is in use:
  python3 manage.py runserver 8080
  ```

* Next.js frontend:

  ```bash
  cd frontend
  npm run dev
  ```

Then open [http://localhost:3002](http://localhost:3002) in your browser.

## API Endpoints

* `GET /api/tasks` - Get all tasks
* `POST /api/tasks` - Create a new task
* `PUT /api/tasks/<id>` - Update a task
* `DELETE /api/tasks/<id>` - Delete a task
* `POST /api/tasks/<id>/complete` - Mark a task as complete
* `GET /api/analytics` - Get analytics data
* `POST /api/smart-voice` - Process voice commands with Gemini AI

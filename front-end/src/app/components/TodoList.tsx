'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  FaTasks, FaClock, FaCheckCircle, 
  FaTimesCircle, FaMicrophone, FaStop,
  FaCircle, FaTrashAlt, FaEdit, 
  FaPlus, FaAlignLeft, FaCalendarAlt,
  FaChartBar, FaBrain, FaExclamationTriangle,
  FaLightbulb, FaSpinner, FaInbox, FaHeading
} from 'react-icons/fa';
import TaskEditModal from './TaskEditModal';
import { parseVoiceInput } from './voiceParser';

// Define base API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Task interface based on the Django model
interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  status: 'ongoing' | 'success' | 'failure';
  created_at: string;
  updated_at: string;
  time_remaining: string;
  estimated_duration: number;
  complexity_score: number;
  risk_score: number;
  risk_level: 'high' | 'medium' | 'low';
  completion_probability: number;
}

// Analytics interface
interface Analytics {
  user_patterns: {
    total_tasks: number;
    success_rate: number;
    risk_profile: string;
  };
  total_high_risk: number;
  high_risk_tasks: Task[];
}

export default function TodoList() {
  // State for tasks, forms, and UI
  const [tasks, setTasks] = useState<{
    ongoing: Task[];
    success: Task[];
    failure: Task[];
  }>({
    ongoing: [],
    success: [],
    failure: []
  });
  
  const [activeTab, setActiveTab] = useState<'ongoing' | 'success' | 'failure'>('ongoing');
  const [loading, setLoading] = useState<boolean>(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: ''
  });
  
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [recognition, setRecognition] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [currentEditTask, setCurrentEditTask] = useState<Task | null>(null);

  // Format date for datetime-local input
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Min date for the deadline input (current time)
  const minDate = formatDateForInput(new Date());

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics`);
      if (response.data) {
        // Ensure we have a valid analytics structure with all required fields
        const analyticsData = {
          user_patterns: {
            total_tasks: response.data.user_patterns?.total_tasks || 0,
            success_rate: response.data.user_patterns?.success_rate || 0,
            risk_profile: response.data.user_patterns?.risk_profile || 'Low'
          },
          total_high_risk: response.data.total_high_risk || 0,
          high_risk_tasks: Array.isArray(response.data.high_risk_tasks) ? response.data.high_risk_tasks : []
        };
        setAnalytics(analyticsData);
      } else {
        throw new Error('Invalid or empty analytics data');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Create fallback analytics if API fails
      const totalTasks = tasks.ongoing.length + tasks.success.length + tasks.failure.length;
      const completedTasks = tasks.success.length;
      const failedTasks = tasks.failure.length;
      const successRate = (completedTasks + failedTasks) > 0 
        ? Math.round((completedTasks / (completedTasks + failedTasks)) * 100) : 0;
      
      setAnalytics({
        user_patterns: {
          total_tasks: totalTasks,
          success_rate: successRate,
          risk_profile: 'Unavailable'
        },
        total_high_risk: 0,
        high_risk_tasks: []
      });
    }
  }, [tasks]);

  // Initialize voice recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      // @ts-ignore - SpeechRecognition is not in TypeScript's lib.dom.d.ts
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
        setVoiceStatus('Listening...');
        console.log('SpeechRecognition started');
      };

      
      recognitionInstance.onresult = async (event: any) => {
        const voiceText = event.results[0][0].transcript;
        console.log('SpeechRecognition result:', voiceText);
        setVoiceStatus('Processing voice command...');
        
        try {
          // First try client-side parsing with the voiceParser utility
          if (voiceText.toLowerCase().includes('description') || voiceText.toLowerCase().includes('title')) {
            const parsedResult = parseVoiceInput(voiceText);
            
            // If we have a title or description, use the parsed result
            if (parsedResult.title || parsedResult.description) {
              setFormData({
                title: parsedResult.title,
                description: parsedResult.description,
                deadline: formatDateForInput(new Date(Date.now() + 86400000)) // Default: tomorrow
              });
              
              setVoiceStatus(`Form filled with title "${parsedResult.title}" ${parsedResult.description ? `and description "${parsedResult.description}"` : ''}`);
              return; // Exit early after successful parsing
            }
          }
          
          // If client-side parsing didn't work, use API
          setVoiceStatus('Processing with Gemini AI...');
          const response = await axios.post(`${API_BASE_URL}/smart-voice`, { voiceText });
          if (response.data.success) {
            const { task_data } = response.data;
            
            // Get title and description from API response
            const title = task_data.title || '';
            const description = task_data.description || '';
            
            setFormData({
              title: title, 
              description: description,
              deadline: task_data.deadline || formatDateForInput(new Date(Date.now() + 86400000)) // Default: tomorrow
            });
            
            setVoiceStatus(`Form filled with title "${title}"${description ? ` and description "${description}"` : ''}`);
          } else {
            throw new Error(response.data.error || 'No task data received');
          }
        } catch (error: any) {
          console.error('Smart voice processing error:', error);
          setVoiceStatus(`Failed to process: ${error.message}`);
        }
      };
      
      recognitionInstance.onerror = (event: any) => {
        console.error('SpeechRecognition error:', event.error);
        setVoiceStatus('Voice recognition error');
        setIsListening(false);
        setTimeout(() => setVoiceStatus(''), 3000);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
        console.log('SpeechRecognition ended');
        setTimeout(() => setVoiceStatus(''), 3000);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  // Start voice recording
  const startVoiceRecording = () => {
    if (recognition && !isListening) {
      recognition.start();
    }
  };

  // Stop voice recording
  const stopVoiceRecording = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  // Fetch tasks from API
  const fetchTasks = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/tasks`);
      setTasks(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    }
  }, []);

  // Create new task
  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.deadline) return;

    try {
      const deadline = new Date(formData.deadline).toISOString();
      await axios.post(`${API_BASE_URL}/tasks`, {
        ...formData,
        deadline
      });
      setFormData({ title: '', description: '', deadline: '' });
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  // Mark task as complete
  const completeTask = async (taskId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/tasks/${taskId}/complete`);
      fetchTasks();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  // Delete task
  const deleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/tasks/${taskId}`);
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Edit task - opens modal
  const editTask = (task: Task) => {
    // Prepare deadline format for the input
    const taskDate = new Date(task.deadline);
    const formattedDeadline = formatDateForInput(taskDate);
    
    // Set the current task and open the modal
    setCurrentEditTask({
      ...task,
      deadline: formattedDeadline
    });
    setIsEditModalOpen(true);
  };
  
  // Handle task edit form submission
  const handleEditSubmit = async (formData: {
    title: string;
    description: string;
    deadline: string;
    status?: 'ongoing' | 'success' | 'failure';
  }) => {
    if (!currentEditTask) return;
    
    try {
      const deadlineISO = new Date(formData.deadline).toISOString();
      await axios.put(`${API_BASE_URL}/tasks/${currentEditTask.id}`, {
        title: formData.title,
        description: formData.description,
        deadline: deadlineISO,
        status: formData.status || currentEditTask.status
      });
      
      setIsEditModalOpen(false);
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  // Initialize and set up auto-refresh
  useEffect(() => {
    // Initial data fetch after component is mounted
    const initialFetch = setTimeout(() => {
      fetchTasks();
      fetchAnalytics();
    }, 100); // Short delay to ensure client-side hydration is complete
    
    const interval = setInterval(() => {
      fetchTasks();
      fetchAnalytics();
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchTasks, fetchAnalytics]);

  return (
    <div className="w-full max-w-4xl mx-auto my-12 bg-white rounded-3xl shadow-xl overflow-hidden transform transition-all hover:shadow-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-600 text-white py-8 px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full opacity-10 transform -translate-x-20 -translate-y-20"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full opacity-10 transform translate-x-10 translate-y-10"></div>
        </div>
        <h1 className="text-4xl mb-2 flex items-center justify-center gap-3 font-extrabold tracking-tight">
          <FaTasks className="text-white/90" /> Smart Todo List
        </h1>
        <p className="opacity-90 text-lg">Intelligent task management with automatic deadline tracking</p>
      </div>

      <div className="p-8 space-y-8">
        {/* AI Features Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-7 border border-gray-200 shadow-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-50"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full opacity-20 blur-xl transform translate-x-16 -translate-y-16"></div>
          
          <div className="relative">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-indigo-800">
              <FaBrain className="text-indigo-600" /> AI-Powered Features
            </h2>
            
            {/* Voice Controls */}
            <div className="flex gap-4 items-center mb-6 flex-wrap">
              <button
                className={`rounded-xl py-3 px-5 text-white font-medium flex items-center gap-2 transition-all duration-300 hover:translate-y-[-2px] shadow-lg ${
                  isListening 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:shadow-red-200' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-emerald-200'
                }`}
                onClick={isListening ? stopVoiceRecording : startVoiceRecording}
                disabled={!recognition}
              >
                <span className="relative">
                  {isListening ? <FaStop /> : <FaMicrophone />}
                  {isListening && (
                    <span className="absolute inset-0 rounded-full bg-white/30 animate-ping"></span>
                  )}
                </span>
                {isListening ? 'Stop Recording' : 'Voice Command'}
              </button>
              
              {voiceStatus && (
                <div className={`rounded-lg px-5 py-2 flex items-center gap-2 shadow-sm ${
                  isListening 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  <FaCircle className={`${isListening ? 'animate-pulse text-green-500' : 'text-blue-500'}`} />
                  <span className="font-medium">{voiceStatus}</span>
                </div>
              )}
              
              {!recognition && (
                <span className="text-gray-600 text-sm bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-100">
                  ⚠️ Voice commands not supported in this browser
                </span>
              )}
            </div>
          
            {/* Analytics Dashboard */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-md" suppressHydrationWarning>
                <h3 className="text-lg font-semibold mb-5 flex items-center gap-2 text-indigo-700">
                  <FaChartBar className="text-indigo-600" /> Performance Analytics
                </h3>
                
                {analytics ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="backdrop-blur-lg bg-white/90 shadow-lg rounded-xl px-4 py-5 text-center border border-indigo-100 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{analytics?.user_patterns?.total_tasks || 0}</div>
                    <div className="text-xs uppercase text-indigo-600 font-medium mt-1">Total Tasks</div>
                  </div>
                  <div className="backdrop-blur-lg bg-white/90 shadow-lg rounded-xl px-4 py-5 text-center border border-indigo-100 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{analytics?.user_patterns?.success_rate || 0}%</div>
                    <div className="text-xs uppercase text-indigo-600 font-medium mt-1">Success Rate</div>
                  </div>
                  <div className="backdrop-blur-lg bg-white/90 shadow-lg rounded-xl px-4 py-5 text-center border border-indigo-100 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{analytics?.total_high_risk || 0}</div>
                    <div className="text-xs uppercase text-indigo-600 font-medium mt-1">High Risk Tasks</div>
                  </div>
                  <div className="backdrop-blur-lg bg-white/90 shadow-lg rounded-xl px-4 py-5 text-center border border-indigo-100 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent capitalize">
                      {analytics?.user_patterns?.risk_profile || 'N/A'}
                    </div>
                    <div className="text-xs uppercase text-indigo-600 font-medium mt-1">Risk Profile</div>
                  </div>
                </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin mr-2 h-6 w-6 border-t-2 border-b-2 border-indigo-500 rounded-full"></div>
                    <p className="text-indigo-600">Loading analytics data...</p>
                  </div>
                )}
                
                {/* Risk Alerts */}
                {analytics?.high_risk_tasks && Array.isArray(analytics.high_risk_tasks) && analytics.high_risk_tasks.length > 0 && (
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-5 mb-6 shadow-sm">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-amber-800">
                      <div className="bg-amber-100 p-1.5 rounded-lg">
                        <FaExclamationTriangle className="text-amber-600" />
                      </div>
                      High Risk Tasks
                    </h4>
                    <div className="space-y-3">
                      {analytics.high_risk_tasks.slice(0, 3).map(task => (
                        <div key={task.id} className="flex items-start gap-3 bg-white/80 rounded-lg p-3 border border-yellow-100">
                          <div className="mt-0.5">
                            <FaExclamationTriangle className="text-red-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{task.title}</p>
                            <div className="flex items-center mt-1">
                              <div className="text-xs text-gray-500">Completion probability:</div>
                              <div className="w-full max-w-[8rem] h-1.5 bg-gray-200 rounded-full ml-2 overflow-hidden">
                                <div 
                                  className="h-full bg-red-500"
                                  style={{width: `${task.completion_probability}%`}}
                                ></div>
                              </div>
                              <div className="text-xs font-medium text-red-600 ml-1">{task.completion_probability}%</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                   {/* AI Insights */}
              {analytics?.user_patterns?.success_rate !== undefined && analytics.user_patterns.success_rate < 70 && (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl p-6 shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 overflow-hidden opacity-10">
                    <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full transform -translate-x-20 -translate-y-20"></div>
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-full transform translate-x-10 translate-y-10"></div>
                  </div>
                  <div className="relative">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                      <div className="bg-white/20 p-1.5 rounded-lg">
                        <FaLightbulb className="text-yellow-300" />
                      </div>
                      AI Recommendations
                    </h4>
                    <p className="text-white/90">Your success rate is below 70%. Consider:</p>
                    <ul className="list-disc ml-5 mt-3 space-y-1.5 text-white/90">
                      <li className="pl-1">Breaking large tasks into smaller ones</li>
                      <li className="pl-1">Setting more realistic deadlines</li>
                      <li className="pl-1">Focusing on high-priority tasks first</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Task Creation Form */}
        <form onSubmit={createTask} className="bg-gradient-to-br from-gray-50 to-indigo-50 rounded-2xl p-7 border border-gray-200 shadow-md relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-50 opacity-50"></div>
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full opacity-30 blur-xl transform translate-x-20 translate-y-20"></div>
          
          <div className="relative">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-indigo-800">
              <div className="bg-indigo-100 p-1 rounded-lg">
                <FaPlus className="text-indigo-600" />
              </div>
              Create New Task
            </h2>
            
            <div className="mb-5">
              <label htmlFor="title" className="font-semibold mb-2 flex items-center gap-1 text-gray-700">
                <FaHeading className="text-sm text-indigo-600" /> Task Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3.5 border-2 border-indigo-200 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 transition duration-200 text-black"
                placeholder="Enter task title..."
                required
              />
            </div>

            <div className="mb-5">
              <label htmlFor="description" className="font-semibold mb-2 flex items-center gap-1 text-gray-700">
                <FaAlignLeft className="text-sm text-indigo-600" /> Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                className="w-full p-3.5 border-2 border-indigo-200 rounded-xl min-h-[100px] focus:border-indigo-400 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 transition duration-200 text-black"
                placeholder="Enter task description..."
              />
            </div>

            <div className="mb-6">
              <label htmlFor="deadline" className="font-semibold mb-2 flex items-center gap-1 text-gray-700">
                <FaCalendarAlt className="text-sm text-indigo-600" /> Deadline *
              </label>
              <input
                type="datetime-local"
                id="deadline"
                value={formData.deadline}
              onChange={(e) => setFormData(prev => ({...prev, deadline: e.target.value}))}
              className="w-full p-3.5 border-2 border-indigo-200 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 transition duration-200 text-black"
              min={minDate}
              required
            />
            </div>

            <button 
              type="submit" 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 px-7 rounded-xl font-semibold shadow-md hover:shadow-lg hover:translate-y-[-2px] active:translate-y-0 transition-all duration-200 flex items-center gap-2"
            >
              <FaPlus className="text-white" /> Create Task
            </button>
          </div>
        </form>
        
        {/* Task Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden shadow p-1.5">
          <button
            className={`flex-1 py-4 px-3 font-semibold flex items-center justify-center gap-2 transition-all duration-300 rounded-lg ${
              activeTab === 'ongoing'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'hover:bg-indigo-50 text-gray-700'
            }`}
            onClick={() => setActiveTab('ongoing')}
          >
            <div className={activeTab === 'ongoing' ? 'animate-pulse' : ''}>
              <FaClock />
            </div>
            <span>Ongoing</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              activeTab === 'ongoing' 
                ? 'bg-white/25 text-white shadow-sm' 
                : 'bg-indigo-100 text-indigo-700'
            }`}>
              {tasks.ongoing.length}
            </span>
          </button>
          <button
            className={`flex-1 py-4 px-3 mx-1.5 font-semibold flex items-center justify-center gap-2 transition-all duration-300 rounded-lg ${
              activeTab === 'success'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                : 'hover:bg-green-50 text-gray-700'
            }`}
            onClick={() => setActiveTab('success')}
          >
            <div className={activeTab === 'success' ? 'animate-pulse' : ''}>
              <FaCheckCircle />
            </div>
            <span>Completed</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              activeTab === 'success' 
                ? 'bg-white/25 text-white shadow-sm' 
                : 'bg-green-100 text-green-700'
            }`}>
              {tasks.success.length}
            </span>
          </button>
          <button
            className={`flex-1 py-4 px-3 font-semibold flex items-center justify-center gap-2 transition-all duration-300 rounded-lg ${
              activeTab === 'failure'
                ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg'
                : 'hover:bg-red-50 text-gray-700'
            }`}
            onClick={() => setActiveTab('failure')}
          >
            <div className={activeTab === 'failure' ? 'animate-pulse' : ''}>
              <FaTimesCircle />
            </div>
            <span>Failed</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              activeTab === 'failure' 
                ? 'bg-white/25 text-white shadow-sm' 
                : 'bg-red-100 text-red-700'
            }`}>
              {tasks.failure.length}
            </span>
          </button>
        </div>
        
        {/* Task Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full text-center py-16 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-indigo-100 flex items-center justify-center">
                <FaSpinner className="animate-spin text-3xl text-indigo-600" />
              </div>
              <p className="font-medium text-lg text-indigo-800">Loading tasks...</p>
              <p className="text-gray-500 mt-2">Please wait while we fetch your tasks</p>
            </div>
          ) : tasks[activeTab].length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm">
              <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
                activeTab === 'ongoing' ? 'bg-indigo-100' :
                activeTab === 'success' ? 'bg-green-100' :
                'bg-red-100'
              }`}>
                <FaInbox className={`text-4xl ${
                  activeTab === 'ongoing' ? 'text-indigo-600' :
                  activeTab === 'success' ? 'text-green-600' :
                  'text-red-600'
                }`} />
              </div>
              <h3 className="text-xl font-bold mb-3">No {activeTab} tasks</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {activeTab === 'ongoing' && "You don't have any ongoing tasks at the moment. Create your first task to get started!"}
                {activeTab === 'success' && "You haven't completed any tasks yet. Complete some tasks to see them here."}
                {activeTab === 'failure' && "Good job! You don't have any failed tasks. Tasks that miss their deadline will appear here."}
              </p>
            </div>
          ) : (
            tasks[activeTab].map(task => (
              <div 
                key={task.id} 
                className={`bg-white rounded-xl p-6 pb-20 transition-all duration-300 relative overflow-hidden hover:translate-y-[-5px] hover:shadow-xl group ${
                  task.status === 'ongoing' ? 'border border-gray-200 hover:border-indigo-400 shadow-sm' :
                  task.status === 'success' ? 'border border-green-200 shadow-sm hover:shadow-green-100' :
                  'border border-red-200 shadow-sm hover:shadow-red-100'
                }`}
              >
                {/* Background gradient decoration */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${
                  task.status === 'ongoing' ? 'bg-gradient-to-br from-indigo-400 to-purple-400' :
                  task.status === 'success' ? 'bg-gradient-to-br from-green-400 to-emerald-400' :
                  'bg-gradient-to-br from-red-400 to-pink-400'
                }`}></div>
                
                {/* Status Indicator */}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold shadow-sm uppercase ${
                  task.status === 'ongoing' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                  task.status === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
                  'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {task.status === 'ongoing' ? '⏳ In Progress' : 
                   task.status === 'success' ? '✅ Completed' : 
                   '❌ Failed'}
                </div>
                
                {/* Risk Indicator */}
                {task.status === 'ongoing' && (
                  <div className={`absolute top-12 right-4 px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                    task.risk_level === 'high' ? 'bg-red-100 text-red-800 border border-red-200' :
                    task.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                    'bg-green-100 text-green-800 border border-green-200'
                  }`}>
                    {task.risk_level === 'high' ? '🔴' : 
                     task.risk_level === 'medium' ? '🟠' : 
                     '🟢'} {task.risk_level} risk
                  </div>
                )}
                
                <h3 className="font-bold text-xl mb-3 pr-24 group-hover:text-indigo-700 transition-colors">{task.title}</h3>
                
                {/* Description with stylized container if present */}
                {task.description && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-4">
                    <p className="text-gray-700">{task.description}</p>
                  </div>
                )}
                
                {/* AI Features Display */}
                {task.status === 'ongoing' && (
                  <div className="mb-4">
                    <div className="flex items-center mb-1 justify-between">
                      <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        <div className="bg-indigo-100 p-1 rounded">
                          <FaBrain className="text-indigo-600" />
                        </div>
                        AI Prediction
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        task.completion_probability >= 70 ? 'bg-green-100 text-green-800' :
                        task.completion_probability >= 40 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {task.completion_probability}% chance of completion
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full ${
                          task.completion_probability >= 70 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                          task.completion_probability >= 40 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 
                          'bg-gradient-to-r from-red-400 to-red-500'
                        }`}
                        style={{width: `${task.completion_probability}%`}}
                        suppressHydrationWarning
                      ></div>
                    </div>
                  </div>
                )}
                
                {/* Task metadata with visual improvements */}
                {task.estimated_duration && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 text-xs text-gray-700 flex items-center gap-1">
                      <FaClock className="text-indigo-500" /> 
                      <span>Estimated: <span className="font-semibold">{Math.round(task.estimated_duration / 60)}h</span></span>
                    </div>
                    
                    {task.complexity_score && (
                      <div className="bg-purple-50 px-3 py-2 rounded-lg border border-purple-100 text-xs text-gray-700 flex items-center gap-1">
                        <FaBrain className="text-purple-500" /> 
                        <span>Complexity: <span className="font-semibold">{task.complexity_score}/100</span></span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-3">
                  <div className={`text-sm font-medium flex items-center gap-1.5 ${
                    task.time_remaining === 'Expired' ? 'text-red-700' : 'text-indigo-700'
                  }`}>
                    <div className={`p-1 rounded-full ${
                      task.time_remaining === 'Expired' ? 'bg-red-100' : 'bg-indigo-100'
                    }`}>
                      <FaCalendarAlt className={
                        task.time_remaining === 'Expired' ? 'text-red-600' : 'text-indigo-600'
                      } />
                    </div>
                    {new Date(task.deadline).toLocaleString()}
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm ${
                    task.time_remaining === 'Expired' 
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white' 
                      : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                  }`}>
                    {task.time_remaining === 'Expired' ? '⏰ Expired' : `⌛ ${task.time_remaining} remaining`}
                  </div>
                </div>
                
                {/* Action buttons with improved styling */}
                <div className="absolute bottom-0 inset-x-0 px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap justify-end gap-2 rounded-b-xl">
                  <button
                    onClick={() => editTask(task)}
                    className="bg-white text-blue-700 border border-blue-300 py-1.5 px-2 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center gap-1 text-sm shadow-sm hover:translate-y-[-2px]"
                  >
                    <FaEdit /> <span className="whitespace-nowrap">Edit</span>
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="bg-white text-red-700 border border-red-300 py-1.5 px-2 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all flex items-center gap-1 text-sm shadow-sm hover:translate-y-[-2px]"
                  >
                    <FaTrashAlt /> <span className="whitespace-nowrap">Delete</span>
                  </button>
                  {task.status === 'ongoing' && (
                    <button
                      onClick={() => completeTask(task.id)}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-1.5 px-2 rounded-lg hover:shadow-md transition-all flex items-center gap-1 text-sm shadow-sm hover:translate-y-[-2px]"
                    >
                      <FaCheckCircle /> <span className="whitespace-nowrap">Complete</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Edit Modal */}
      {isEditModalOpen && currentEditTask && (
        <TaskEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleEditSubmit}
          initialData={{
            title: currentEditTask.title,
            description: currentEditTask.description || '',
            deadline: currentEditTask.deadline,
            status: currentEditTask.status
          }}
        />
      )}
    </div>
  );
}

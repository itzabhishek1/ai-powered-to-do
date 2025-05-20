'use client';

import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: {
    title: string;
    description: string;
    deadline: string;
    status?: 'ongoing' | 'success' | 'failure';
  }) => void;
  initialData: {
    title: string;
    description?: string;
    deadline: string;
    status?: 'ongoing' | 'success' | 'failure';
  };
}

export default function TaskEditModal({ isOpen, onClose, onSubmit, initialData }: EditModalProps) {
  const [formData, setFormData] = useState({
    title: initialData.title || '',
    description: initialData.description || '',
    deadline: initialData.deadline || '',
    status: initialData.status || 'ongoing'
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 animate-fadeIn shadow-2xl" suppressHydrationWarning onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Task</h2>
          <button 
            type="button" 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <FaTimes />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-gray-700">Title</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})} 
              className="w-full p-3 border-2 border-indigo-200 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-black"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-gray-700">Description</label>
            <textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full p-3 border-2 border-indigo-200 rounded-xl min-h-[100px] focus:border-indigo-400 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-black"
            />
          </div>
          
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-gray-700">Deadline</label>
            <input 
              type="datetime-local" 
              value={formData.deadline} 
              onChange={(e) => setFormData({...formData, deadline: e.target.value})}
              className="w-full p-3 border-2 border-indigo-200 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-black"
              required
            />
          </div>
          
          {initialData.status !== 'ongoing' && (
            <div className="mb-4">
              <label className="block font-semibold mb-1 text-gray-700">Status</label>
              <select 
                value={formData.status} 
                onChange={(e) => setFormData({...formData, status: e.target.value as 'ongoing' | 'success' | 'failure'})}
                className="w-full p-3 border-2 border-indigo-200 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-black"
              >
                <option value="ongoing">Ongoing</option>
                <option value="success">Completed</option>
                <option value="failure">Failed</option>
              </select>
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

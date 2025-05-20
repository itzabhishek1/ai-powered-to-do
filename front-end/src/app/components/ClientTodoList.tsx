'use client';

import { useState, useEffect } from 'react';
import dynamic from "next/dynamic";

// Use dynamic import to avoid SSR for components that rely on browser APIs
const TodoList = dynamic(() => import('./TodoList'), { 
  ssr: false,
  loading: () => (
    <div className="w-full max-w-4xl mx-auto my-12 bg-white rounded-3xl shadow-xl overflow-hidden p-8 text-center">
      <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
        <div className="w-8 h-8 border-t-2 border-b-2 border-indigo-600 rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 font-medium text-indigo-800">Loading Todo Application...</p>
    </div>
  )
});

export default function ClientTodoList() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Small delay to ensure browser APIs are fully available
    const timer = setTimeout(() => {
      setMounted(true);
    }, 10);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Return nothing during SSR and initial client-side render
  if (!mounted) {
    return (
      <div className="w-full max-w-4xl mx-auto my-12 bg-white rounded-3xl shadow-xl overflow-hidden p-8 text-center">
        <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
          <div className="w-8 h-8 border-t-2 border-b-2 border-indigo-600 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 font-medium text-indigo-800">Initializing Todo Application...</p>
      </div>
    );
  }
  
  // Only render TodoList after mounting on the client
  return <TodoList />;
}

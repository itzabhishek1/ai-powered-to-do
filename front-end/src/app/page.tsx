import ClientTodoList from './components/ClientTodoList';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-purple-800 py-16 px-4 sm:px-6 lg:px-8 relative">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform translate-x-1/3 translate-y-1/3"></div>
      </div>
      
      <div className="relative">
        {/* Render the TodoList component via client wrapper */}
        <ClientTodoList />
        
        {/* Footer */}
        <div className="mt-12 text-center text-white/80 text-sm">
          <p>Smart Todo List — Powered by Django & Next.js with Gemini AI</p>
        </div>
      </div>
    </div>
  );
}

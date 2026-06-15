import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Dashboard from './pages/Dashboard';
import CreateGroup from './pages/groups/CreateGroup';
import JoinGroup from './pages/groups/JoinGroup';
import GroupDashboard from './pages/groups/GroupDashboard';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen text-foreground">
            <header className="glass p-4 sticky top-0 z-50 flex justify-between items-center mb-6">
              <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500 hover:opacity-80 transition-opacity">
                SplitCalsi
              </Link>
            </header>
            <main className="container mx-auto px-4 max-w-4xl pb-20">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="/groups/create" element={
                  <ProtectedRoute>
                    <CreateGroup />
                  </ProtectedRoute>
                } />
                
                <Route path="/groups/join" element={
                  <ProtectedRoute>
                    <JoinGroup />
                  </ProtectedRoute>
                } />
                
                <Route path="/join/:groupId" element={
                  <ProtectedRoute>
                    <JoinGroup />
                  </ProtectedRoute>
                } />
                
                <Route path="/groups/:groupId" element={
                  <ProtectedRoute>
                    <GroupDashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

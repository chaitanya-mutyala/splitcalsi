import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="glass-card w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">Welcome Back</h2>
        
        {error && <div className="bg-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Email</label>
            <Input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Password</label>
            <Input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        
        <div className="mt-6 text-center text-sm opacity-80">
          Don't have an account? <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
        </div>
        
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-sm opacity-80 mb-3 text-center">Demo Credentials:</p>
          <div className="flex flex-col gap-2">
            <Button 
              type="button" 
              variant="secondary" 
              className="text-xs py-2"
              onClick={() => { setEmail('tea@gmail.com'); setPassword('9999999999'); }}
            >
              Fill User 1 (tea@gmail.com)
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              className="text-xs py-2"
              onClick={() => { setEmail('chai@gmail.com'); setPassword('9999999999'); }}
            >
              Fill User 2 (chai@gmail.com)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

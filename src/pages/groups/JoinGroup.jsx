import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function JoinGroup() {
  const { groupId: paramGroupId } = useParams();
  const [searchParams] = useSearchParams();
  
  // Either from route /join/:groupId or from input field
  const [groupIdInput, setGroupIdInput] = useState(paramGroupId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // If they arrived via a direct link /join/GRP-XXXXXX, we can automatically try to join or just pre-fill.
  // For safety, let's make them click "Join" to confirm.

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanId = groupIdInput.trim().toUpperCase();
    if (!cleanId) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: groupData, error: rpcError } = await supabase.rpc('join_group_by_id', {
        p_group_id: cleanId
      });

      if (rpcError) throw rpcError;

      setSuccess(`Successfully joined ${groupData.name}! Redirecting...`);
      setTimeout(() => {
        navigate(`/groups/${groupData.group_id}`);
      }, 1500);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to join group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="glass-card w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">Join a Group</h2>
        
        {error && <div className="bg-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-success/20 text-success p-3 rounded-lg mb-4 text-sm">{success}</div>}
        
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Group ID</label>
            <Input 
              type="text" 
              required 
              value={groupIdInput}
              onChange={(e) => setGroupIdInput(e.target.value)}
              placeholder="GRP-XXXXXX"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || success}>
            {loading ? 'Joining...' : 'Join Group'}
          </Button>
        </form>
      </div>
    </div>
  );
}

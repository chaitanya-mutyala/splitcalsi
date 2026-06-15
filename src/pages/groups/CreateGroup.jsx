import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function CreateGroup() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert([{ name, created_by: user.id }])
        .select()
        .single();

      if (groupError) throw groupError;

      // Add the creator as an admin member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert([{ group_id: groupData.id, user_id: user.id, role: 'admin' }]);

      if (memberError) throw memberError;

      navigate(`/groups/${groupData.group_id}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="glass-card w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">Create New Group</h2>
        
        {error && <div className="bg-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Group Name</label>
            <Input 
              type="text" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Goa Trip, Apartment Rent"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Group'}
          </Button>
        </form>
      </div>
    </div>
  );
}

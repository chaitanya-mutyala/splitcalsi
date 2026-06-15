import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { calculatePairwiseBalances, calculateUserTotals } from '../lib/balances';

export default function Dashboard() {
  const { profile, user, signOut } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalBalance, setGlobalBalance] = useState({ totalOwe: 0, totalOwed: 0 });

  useEffect(() => {
    if (user) {
      fetchGroupsAndBalances();
    }
  }, [user]);

  const fetchGroupsAndBalances = async () => {
    try {
      // Fetch Groups
      const { data: memberData, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups ( id, name, group_id )
        `)
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      const userGroups = memberData.map(d => d.groups);
      setGroups(userGroups);

      if (userGroups.length === 0) {
        setLoading(false);
        return;
      }

      const groupIds = userGroups.map(g => g.id);

      // Fetch all expenses in these groups
      const { data: expenses } = await supabase.from('expenses').select('*').in('group_id', groupIds);
      // Fetch all splits
      const expenseIds = expenses?.map(e => e.id) || [];
      const { data: splits } = expenseIds.length > 0 
        ? await supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
        : { data: [] };
      const { data: settlements } = await supabase.from('settlements').select('*').in('group_id', groupIds);

      // Calculate global balance correctly per-group to avoid cross-group netting
      let globalOwe = 0;
      let globalOwed = 0;

      for (const gId of groupIds) {
        const groupExp = (expenses || []).filter(e => e.group_id === gId);
        const groupSetl = (settlements || []).filter(s => s.group_id === gId);
        const expIds = groupExp.map(e => e.id);
        const groupSplits = (splits || []).filter(s => expIds.includes(s.expense_id));

        const pairwise = calculatePairwiseBalances(groupExp, groupSplits, groupSetl);
        const totals = calculateUserTotals(user.id, pairwise);

        globalOwe += totals.totalOwe;
        globalOwed += totals.totalOwed;
      }

      setGlobalBalance({ totalOwe: globalOwe, totalOwed: globalOwed });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Welcome, {profile?.name || 'User'}!</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm opacity-80">User ID:</span>
            <span className="font-mono bg-white/10 px-2 py-1 rounded text-sm">{profile?.public_user_id}</span>
            <button 
              onClick={() => { navigator.clipboard.writeText(profile?.public_user_id); alert('ID Copied!'); }}
              className="text-xs text-primary hover:underline"
            >
              Copy
            </button>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={signOut}>Sign Out</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-sm opacity-80 mb-1">Total You Owe</p>
          <p className="text-2xl font-bold text-danger">
            ₹{globalBalance.totalOwe.toFixed(2)}
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm opacity-80 mb-1">Total You Are Owed</p>
          <p className="text-2xl font-bold text-success">
            ₹{globalBalance.totalOwed.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Your Groups</h3>
          <div className="flex gap-2">
            <Link to="/groups/join"><Button variant="secondary" size="sm">Join</Button></Link>
            <Link to="/groups/create"><Button variant="primary" size="sm">Create</Button></Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center opacity-70 py-4">Loading groups...</p>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 opacity-70">
            <p className="mb-4">You aren't in any groups yet.</p>
            <Link to="/groups/create" className="text-primary hover:underline">Create one</Link> or join an existing group.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.map(g => (
              <Link key={g.id} to={`/groups/${g.group_id}`} className="block group">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 transition-all duration-200 hover:bg-white/10 hover:border-primary/50">
                  <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">{g.name}</h4>
                  <p className="text-xs font-mono opacity-60 mt-2">{g.group_id}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

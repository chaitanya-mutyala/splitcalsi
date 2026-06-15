import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import AddExpenseModal from '../../components/groups/AddExpenseModal';
import SettleUpModal from '../../components/groups/SettleUpModal';
import { calculateGroupBalances } from '../../lib/balances';

export default function GroupDashboard() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [memberUserId, setMemberUserId] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Tabs: 'expenses', 'balances', 'settlements'
  const [activeTab, setActiveTab] = useState('expenses');

  useEffect(() => {
    if (!groupId) return;
    fetchGroupDetails();
  }, [groupId]);

  const fetchGroupDetails = async () => {
    setLoading(true);
    try {
      // Fetch Group info
      const { data: gData, error: gError } = await supabase
        .from('groups')
        .select('*')
        .eq('group_id', groupId)
        .single();
        
      if (gError) throw gError;
      setGroup(gData);

      // Fetch Members
      const { data: mData, error: mError } = await supabase
        .from('group_members')
        .select(`
          role,
          profiles ( id, name, public_user_id )
        `)
        .eq('group_id', gData.id);

      if (mError) throw mError;
      const mems = mData.map(m => ({ ...m.profiles, role: m.role }));
      setMembers(mems);

      // Fetch everything else
      await fetchFinancials(gData.id, mems);

    } catch (err) {
      console.error(err);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancials = async (dbGroupId, currentMembers = members) => {
    try {
      // Fetch Expenses
      const { data: eData } = await supabase
        .from('expenses')
        .select(`id, title, amount, created_at, paid_by_profile:profiles!expenses_paid_by_fkey ( id, name )`)
        .eq('group_id', dbGroupId)
        .order('created_at', { ascending: false });
        
      setExpenses(eData || []);

      // Fetch all Expenses raw for balance calculation
      const { data: rawExpenses } = await supabase.from('expenses').select('*').eq('group_id', dbGroupId);
      
      // Fetch Splits
      const { data: sData } = await supabase
        .from('expense_splits')
        .select('*')
        .in('expense_id', rawExpenses?.map(e => e.id) || []);

      // Fetch Settlements
      const { data: setlData } = await supabase
        .from('settlements')
        .select(`
          id, amount, note, settled_at,
          from:profiles!settlements_from_user_fkey(name),
          to:profiles!settlements_to_user_fkey(name)
        `)
        .eq('group_id', dbGroupId)
        .order('settled_at', { ascending: false });

      setSettlements(setlData || []);

      const rawSetl = await supabase.from('settlements').select('*').eq('group_id', dbGroupId);

      const calcBalances = calculateGroupBalances(currentMembers, rawExpenses || [], sData || [], rawSetl.data || []);
      setBalances(calcBalances);
    } catch (e) {
      console.error('Error fetching financials', e);
    }
  };

  const refreshFinancials = () => fetchFinancials(group.id);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const cleanId = memberUserId.trim().toUpperCase();
    if (!cleanId) return;

    setAddLoading(true);
    setAddError('');

    try {
      const { error } = await supabase.rpc('add_member_by_user_id', {
        p_group_id: group.id,
        p_public_user_id: cleanId
      });

      if (error) throw error;
      
      setMemberUserId('');
      setShowAddMember(false);
      fetchGroupDetails(); 
      alert('Member added successfully!');
    } catch (err) {
      console.error(err);
      setAddError(err.message || 'Failed to add member.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', group.id)
        .eq('user_id', targetUserId);
        
      if (error) throw error;
      fetchGroupDetails();
      alert('Member removed successfully');
    } catch (err) {
      console.error(err);
      alert('Failed to remove member: ' + err.message);
    }
  };

  if (loading) return <div className="text-center py-10">Loading group...</div>;
  if (!group) return null;

  const isAdmin = members.some(m => m.id === user.id && m.role === 'admin');

  // Find current user's balance
  const myBalance = balances.find(b => b.user.id === user.id);

  return (
    <div className="space-y-6 relative">
      {/* Modals */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-sm p-6 relative">
            <button onClick={() => setShowAddMember(false)} className="absolute top-4 right-4 opacity-60 hover:opacity-100">✕</button>
            <h3 className="text-lg font-bold mb-4">Add Member</h3>
            {addError && <p className="text-danger text-sm mb-3">{addError}</p>}
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">User ID</label>
                <Input placeholder="SF-XXXXXX" value={memberUserId} onChange={e => setMemberUserId(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={addLoading}>{addLoading ? 'Adding...' : 'Add to Group'}</Button>
            </form>
          </div>
        </div>
      )}

      {showAddExpense && (
        <AddExpenseModal group={group} members={members} onClose={() => setShowAddExpense(false)} onExpenseAdded={refreshFinancials} />
      )}

      {showSettleUp && (
        <SettleUpModal group={group} members={members} balances={balances} onClose={() => setShowSettleUp(false)} onSettled={refreshFinancials} />
      )}

      {/* Top Section */}
      <div className="glass-card p-6 relative overflow-hidden">
        <h2 className="text-3xl font-bold mb-2">{group.name}</h2>
        
        {myBalance && (
          <div className="flex gap-6 mt-4 mb-6 border-b border-white/10 pb-6">
            <div>
              <p className="text-sm opacity-70">You Owe</p>
              <p className="text-2xl font-bold text-danger">₹{myBalance.totalOwe.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm opacity-70">You are Owed</p>
              <p className="text-2xl font-bold text-success">₹{myBalance.totalOwed.toFixed(2)}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 text-sm">
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
            <span className="opacity-70">ID:</span>
            <span className="font-mono font-bold tracking-wider">{group.group_id}</span>
            <button onClick={() => copyToClipboard(group.group_id, 'Group ID')} className="text-primary hover:text-primary/80 ml-auto">Copy</button>
          </div>
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
            <span className="opacity-70">Link:</span>
            <span className="truncate max-w-[150px] opacity-80">{group.join_link}</span>
            <button onClick={() => copyToClipboard(group.join_link, 'Join Link')} className="text-primary hover:text-primary/80 ml-auto">Copy</button>
          </div>
        </div>
        
        <div className="mt-6 flex gap-3">
          <Button variant="primary" className="flex-1" onClick={() => setShowAddExpense(true)}>Add Expense</Button>
          <Button variant="secondary" className="flex-1" onClick={() => setShowSettleUp(true)}>Settle Up</Button>
        </div>
      </div>

      {/* Tabs / Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="flex border-b border-white/10 bg-white/5">
              <button 
                className={`flex-1 p-4 font-medium transition-colors ${activeTab === 'expenses' ? 'border-b-2 border-primary text-primary' : 'hover:bg-white/5 opacity-70'}`}
                onClick={() => setActiveTab('expenses')}
              >Expenses</button>
              <button 
                className={`flex-1 p-4 font-medium transition-colors ${activeTab === 'balances' ? 'border-b-2 border-primary text-primary' : 'hover:bg-white/5 opacity-70'}`}
                onClick={() => setActiveTab('balances')}
              >Balances</button>
              <button 
                className={`flex-1 p-4 font-medium transition-colors ${activeTab === 'settlements' ? 'border-b-2 border-primary text-primary' : 'hover:bg-white/5 opacity-70'}`}
                onClick={() => setActiveTab('settlements')}
              >Settlements</button>
            </div>
            
            <div className="p-6">
              {activeTab === 'expenses' && (
                <div>
                  {expenses.length === 0 ? (
                    <p className="text-sm opacity-70 text-center py-8">No expenses yet. Add one to get started!</p>
                  ) : (
                    <ul className="space-y-3">
                      {expenses.map(expense => (
                        <li key={expense.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center transition-all hover:bg-white/10">
                          <div>
                            <p className="font-semibold text-lg">{expense.title}</p>
                            <p className="text-sm opacity-70 mt-1">Paid by <span className="font-medium text-foreground">{expense.paid_by_profile.id === user.id ? 'You' : expense.paid_by_profile.name}</span></p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-lg font-bold text-primary">₹{expense.amount.toFixed(2)}</p>
                            <p className="text-xs opacity-60 mt-1">{new Date(expense.created_at).toLocaleDateString()}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === 'balances' && (
                <div>
                  <ul className="space-y-3">
                    {balances.map(b => (
                      <li key={b.user.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                            {b.user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold">{b.user.name} {b.user.id === user.id && '(You)'}</p>
                            <p className="text-xs opacity-70">
                              Owes: <span className="text-danger font-medium">₹{b.totalOwe.toFixed(2)}</span> • 
                              Owed: <span className="text-success font-medium">₹{b.totalOwed.toFixed(2)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {b.netBalance > 0 ? (
                            <p className="text-success font-semibold">Net: +₹{Math.abs(b.netBalance).toFixed(2)}</p>
                          ) : b.netBalance < 0 ? (
                            <p className="text-danger font-semibold">Net: -₹{Math.abs(b.netBalance).toFixed(2)}</p>
                          ) : (
                            <p className="opacity-60">Settled up</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === 'settlements' && (
                <div>
                  {settlements.length === 0 ? (
                    <p className="text-sm opacity-70 text-center py-8">No settlements yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {settlements.map(s => (
                        <li key={s.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-sm">
                              {s.from.name} paid {s.to.name}
                            </p>
                            {s.note && <p className="text-xs opacity-70 mt-1">"{s.note}"</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-lg font-bold text-success">₹{s.amount.toFixed(2)}</p>
                            <p className="text-xs opacity-60 mt-1">{new Date(s.settled_at).toLocaleDateString()}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Members ({members.length})</h3>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => setShowAddMember(true)}>
                  + Add
                </Button>
              )}
            </div>
            <ul className="space-y-3">
              {members.map(m => (
                <li key={m.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                  <div>
                    <p className="font-medium">{m.name} {m.id === user.id && '(You)'}</p>
                    <p className="text-xs opacity-60 font-mono mt-1">{m.public_user_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === 'admin' && <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Admin</span>}
                    {isAdmin && m.id !== user.id && (
                      <button onClick={() => handleRemoveMember(m.id)} className="text-xs text-danger hover:underline p-1">Remove</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

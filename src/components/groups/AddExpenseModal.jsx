import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export default function AddExpenseModal({ group, members, onClose, onExpenseAdded }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(user.id);
  const [splitType, setSplitType] = useState('EQUAL'); // 'EQUAL' or 'EXACT'
  
  // State for which members are included (checked)
  const [includedMembers, setIncludedMembers] = useState({});
  // State for exact amounts if splitType is 'EXACT'
  const [exactAmounts, setExactAmounts] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize all members as included
  useEffect(() => {
    const inc = {};
    const exact = {};
    members.forEach(m => {
      inc[m.id] = true;
      exact[m.id] = '';
    });
    setIncludedMembers(inc);
    setExactAmounts(exact);
  }, [members]);

  const handleToggleMember = (mId) => {
    setIncludedMembers(prev => ({ ...prev, [mId]: !prev[mId] }));
  };

  const handleExactChange = (mId, val) => {
    setExactAmounts(prev => ({ ...prev, [mId]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim() || isNaN(numAmount) || numAmount <= 0) return;

    // Validation
    const includedCount = Object.values(includedMembers).filter(Boolean).length;
    if (includedCount === 0) {
      setError('You must include at least one person in the split.');
      return;
    }

    let finalSplits = [];

    if (splitType === 'EQUAL') {
      const splitAmount = numAmount / includedCount;
      finalSplits = members
        .filter(m => includedMembers[m.id])
        .map(m => ({
          user_id: m.id,
          amount: splitAmount,
          payment_status: m.id === paidBy ? 'paid' : 'pending'
        }));
    } else {
      // EXACT
      let totalExact = 0;
      finalSplits = members
        .filter(m => includedMembers[m.id])
        .map(m => {
          const amt = parseFloat(exactAmounts[m.id]) || 0;
          totalExact += amt;
          return {
            user_id: m.id,
            amount: amt,
            payment_status: m.id === paidBy ? 'paid' : 'pending'
          };
        });

      // Allow a tiny margin of error for floating points
      if (Math.abs(totalExact - numAmount) > 0.05) {
        setError(`Exact amounts must add up to the total (₹${numAmount.toFixed(2)}). Current sum: ₹${totalExact.toFixed(2)}`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // 1. Insert Expense
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .insert([{
          group_id: group.id,
          title,
          amount: numAmount,
          paid_by: paidBy,
          created_by: user.id
        }])
        .select()
        .single();

      if (expenseError) throw expenseError;

      // 2. Attach expense_id
      const splitsToInsert = finalSplits.map(s => ({ ...s, expense_id: expenseData.id }));

      // 3. Insert Splits
      const { error: splitError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitError) throw splitError;

      onExpenseAdded();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to add expense.');
    } finally {
      setLoading(false);
    }
  };

  const includedCount = Object.values(includedMembers).filter(Boolean).length;
  const numAmount = parseFloat(amount) || 0;
  const equalAmount = includedCount > 0 ? (numAmount / includedCount).toFixed(2) : '0.00';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md p-6 relative max-h-[90vh] flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 opacity-60 hover:opacity-100 z-10"
        >✕</button>
        <h3 className="text-xl font-bold mb-4 shrink-0">Add Expense</h3>
        
        {error && <p className="text-danger text-sm mb-3 bg-danger/10 p-2 rounded shrink-0">{error}</p>}
        
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-2 space-y-4 pb-4">
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">What was it for?</label>
            <Input 
              placeholder="e.g. Dinner, Taxi" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Total Amount (₹)</label>
            <Input 
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00" 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Paid By</label>
            <select 
              className="glass-input flex h-11 w-full px-3 py-2 text-sm text-foreground bg-transparent"
              value={paidBy}
              onChange={e => setPaidBy(e.target.value)}
            >
              {members.map(m => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                  {m.name} {m.id === user.id ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-3 mt-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium opacity-80">Split Details</span>
              <select 
                className="bg-transparent border border-white/20 rounded p-1 text-xs outline-none"
                value={splitType}
                onChange={e => setSplitType(e.target.value)}
              >
                <option value="EQUAL" className="bg-slate-900 text-white">Equally</option>
                <option value="EXACT" className="bg-slate-900 text-white">Exact Amounts</option>
              </select>
            </div>
            
            <ul className="space-y-2">
              {members.map(m => (
                <li key={m.id} className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={includedMembers[m.id]} 
                    onChange={() => handleToggleMember(m.id)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className={`text-sm flex-1 ${!includedMembers[m.id] && 'opacity-50 line-through'}`}>
                    {m.name} {m.id === user.id && '(You)'}
                  </span>
                  
                  {splitType === 'EQUAL' && includedMembers[m.id] && (
                    <span className="font-mono text-sm opacity-80">₹{equalAmount}</span>
                  )}
                  
                  {splitType === 'EXACT' && includedMembers[m.id] && (
                    <div className="flex items-center gap-1 w-24">
                      <span className="text-sm opacity-60">₹</span>
                      <Input 
                        type="number" 
                        step="0.01" 
                        className="h-8 text-sm px-2 py-1"
                        placeholder="0.00"
                        value={exactAmounts[m.id]}
                        onChange={e => handleExactChange(m.id, e.target.value)}
                        required={splitType === 'EXACT' && includedMembers[m.id]}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <Button type="submit" className="w-full mt-6" disabled={loading}>
            {loading ? 'Adding...' : 'Save Expense'}
          </Button>
        </form>
      </div>
    </div>
  );
}

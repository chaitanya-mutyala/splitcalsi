import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export default function SettleUpModal({ group, members, balances, onClose, onSettled }) {
  const { user } = useAuth();
  
  // Default 'from' is current user, 'to' is someone who is owed money
  const [fromUser, setFromUser] = useState(user.id);
  const [toUser, setToUser] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-suggest amount if "from" owes "to"
  // This requires debt simplification, but for MVP we can just let them enter it.
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!fromUser || !toUser || isNaN(numAmount) || numAmount <= 0) return;
    if (fromUser === toUser) {
      setError("Cannot settle with yourself.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: settleError } = await supabase
        .from('settlements')
        .insert([{
          group_id: group.id,
          from_user: fromUser,
          to_user: toUser,
          amount: numAmount,
          note
        }]);

      if (settleError) throw settleError;

      onSettled();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to record settlement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 opacity-60 hover:opacity-100"
        >✕</button>
        <h3 className="text-xl font-bold mb-4">Record Settlement</h3>
        
        {error && <p className="text-danger text-sm mb-3 bg-danger/10 p-2 rounded">{error}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 opacity-80">Who paid?</label>
              <select 
                className="glass-input flex h-11 w-full px-3 py-2 text-sm text-foreground bg-transparent"
                value={fromUser}
                onChange={e => setFromUser(e.target.value)}
                required
              >
                <option value="" disabled className="bg-slate-900 text-white opacity-50">Select User</option>
                {members.map(m => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.name} {m.id === user.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 opacity-80">Who received?</label>
              <select 
                className="glass-input flex h-11 w-full px-3 py-2 text-sm text-foreground bg-transparent"
                value={toUser}
                onChange={e => setToUser(e.target.value)}
                required
              >
                <option value="" disabled className="bg-slate-900 text-white opacity-50">Select User</option>
                {members.map(m => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.name} {m.id === user.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Amount (₹)</label>
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
            <label className="block text-sm font-medium mb-1 opacity-80">Note (Optional)</label>
            <Input 
              placeholder="e.g. For dinner, UPI transfer" 
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full mt-4" disabled={loading}>
            {loading ? 'Saving...' : 'Save Settlement'}
          </Button>
        </form>
      </div>
    </div>
  );
}

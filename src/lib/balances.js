// Calculate pairwise balances: Who owes whom how much?
export function calculatePairwiseBalances(expenses, splits, settlements) {
  // balances[userA][userB] = amount User A owes User B
  const balances = {};

  const ensureUser = (u) => {
    if (!balances[u]) balances[u] = {};
  };

  const addDebt = (debtor, creditor, amount) => {
    if (debtor === creditor) return;
    ensureUser(debtor);
    ensureUser(creditor);
    
    balances[debtor][creditor] = (balances[debtor][creditor] || 0) + Number(amount);
  };

  // For every expense, the people in the split owe the person who paid
  splits.forEach(s => {
    const expense = expenses.find(e => e.id === s.expense_id);
    if (expense) {
      addDebt(s.user_id, expense.paid_by, s.amount);
    }
  });

  // Settlements reduce the debt
  // If A pays B, it reduces what A owes B
  settlements.forEach(s => {
    addDebt(s.to_user, s.from_user, s.amount); // Treat it as B owing A, which nets out later
  });

  // Net out the balances
  const netBalances = {};
  
  Object.keys(balances).forEach(userA => {
    Object.keys(balances[userA]).forEach(userB => {
      const aOwesB = balances[userA]?.[userB] || 0;
      const bOwesA = balances[userB]?.[userA] || 0;
      
      const net = aOwesB - bOwesA;
      
      if (net > 0) {
        if (!netBalances[userA]) netBalances[userA] = {};
        netBalances[userA][userB] = net;
      }
    });
  });

  return netBalances;
}

export function calculateUserTotals(userId, pairwiseBalances) {
  let totalOwe = 0;
  let totalOwed = 0;

  // How much I owe others
  if (pairwiseBalances[userId]) {
    Object.values(pairwiseBalances[userId]).forEach(amt => {
      totalOwe += amt;
    });
  }

  // How much others owe me
  Object.keys(pairwiseBalances).forEach(otherUser => {
    if (pairwiseBalances[otherUser]?.[userId]) {
      totalOwed += pairwiseBalances[otherUser][userId];
    }
  });

  return { totalOwe, totalOwed };
}

// Original group balance calculation
export function calculateGroupBalances(members, expenses, splits, settlements) {
  const pairwise = calculatePairwiseBalances(expenses, splits, settlements);
  
  return members.map(m => {
    const totals = calculateUserTotals(m.id, pairwise);
    return {
      user: m,
      totalOwe: totals.totalOwe,
      totalOwed: totals.totalOwed,
      netBalance: totals.totalOwed - totals.totalOwe
    };
  });
}

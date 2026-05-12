import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Bus, Bed, Utensils, Activity, MoreHorizontal, DollarSign, Users, CheckSquare, ArrowRightLeft, UserPlus } from 'lucide-react';
import { TripExpense, ExpenseCategory } from '../types';
import { addTripExpense, deleteTripExpense } from '../services/db';

interface TripExpensesProps {
  tripId: string;
  isManager: boolean;
  expenses: TripExpense[];
  setExpenses: React.Dispatch<React.SetStateAction<TripExpense[]>>;
  members: string[];
  updateMembers: (newMembers: string[]) => Promise<void>;
}

const CATEGORY_COLORS = {
  transport: 'bg-blue-100 text-blue-700',
  accommodation: 'bg-orange-100 text-orange-700',
  food: 'bg-rose-100 text-rose-700',
  activity: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-700',
};

const CATEGORY_ICONS = {
  transport: Bus,
  accommodation: Bed,
  food: Utensils,
  activity: Activity,
  other: MoreHorizontal,
};

export default function TripExpenses({ tripId, isManager, expenses, setExpenses, members, updateMembers }: TripExpensesProps) {
  const [isAdding, setIsAdding] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payerName, setPayerName] = useState(members[0] || 'You');
  const [splitBetween, setSplitBetween] = useState<string[]>(members);
  
  const [newMemberName, setNewMemberName] = useState('');
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'members'>('expenses');

  useEffect(() => {
    if (members.length > 0 && !splitBetween.length) {
      setSplitBetween(members);
      setPayerName(members[0]);
    }
  }, [members]);

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    if (members.includes(newMemberName.trim())) return;
    const updated = [...members, newMemberName.trim()];
    await updateMembers(updated);
    setNewMemberName('');
    setSplitBetween(updated);
  };

  const handleRemoveMember = async (name: string) => {
    const updated = members.filter(m => m !== name);
    await updateMembers(updated);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amountStr || splitBetween.length === 0) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const newExpenseData: Omit<TripExpense, 'id'> = {
        title,
        amount,
        category,
        date,
        payerName,
        splitBetween
      };
      
      const id = await addTripExpense(tripId, newExpenseData);
      setExpenses([...expenses, { ...newExpenseData, id } as TripExpense]);
      
      setTitle('');
      setAmountStr('');
      setIsAdding(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTripExpense(tripId, id);
      setExpenses(expenses.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by category for summary
  const categorySummary = expenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = 0;
    acc[e.category] += e.amount;
    return acc;
  }, {} as Record<string, number>);

  // Who Owes Who Logic
  const calculateBalances = () => {
    const balances: Record<string, number> = {};
    members.forEach(m => balances[m] = 0);

    expenses.forEach(exp => {
      const share = exp.amount / (exp.splitBetween?.length || 1);
      
      // Payer gets credit for the full amount
      if (balances[exp.payerName] !== undefined) {
        balances[exp.payerName] += exp.amount;
      }

      // Everyone in split owes their share
      exp.splitBetween?.forEach(member => {
        if (balances[member] !== undefined) {
          balances[member] -= share;
        }
      });
    });

    return balances;
  };

  const balances = calculateBalances();

  return (
    <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl border-4 border-slate-100">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4 text-emerald-600 font-black text-2xl uppercase tracking-tight">
          <div className="bg-emerald-100 p-3 rounded-2xl shadow-sm transform rotate-3">
            <DollarSign className="w-6 h-6" />
          </div>
          Trip Budget
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-200">
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'expenses' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <DollarSign className="w-3.5 h-3.5" /> Expenses
          </button>
          <button 
            onClick={() => setActiveTab('settlements')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'settlements' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> Who Owes Who
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'members' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users className="w-3.5 h-3.5" /> Members
          </button>
        </div>

        <div className="text-center sm:text-right">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Expenses</div>
          <div className="text-3xl font-black text-slate-900">${totalAmount.toFixed(2)}</div>
        </div>
      </div>

      {activeTab === 'expenses' && (
        <>
      {expenses.length > 0 && (
        <div className="mb-12">
          <div className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Spending by Category</div>
          <div className="flex w-full h-4 rounded-full overflow-hidden bg-slate-100 mb-4">
             {Object.entries(categorySummary).map(([cat, amount]) => {
                const amt = amount as number;
                const perc = (amt / totalAmount) * 100;
                // pick a bg color dynamically
                let bg = 'bg-slate-300';
                if (cat === 'transport') bg = 'bg-blue-500';
                if (cat === 'accommodation') bg = 'bg-orange-500';
                if (cat === 'food') bg = 'bg-rose-500';
                if (cat === 'activity') bg = 'bg-purple-500';
                
                return <div key={cat} className={`${bg} h-full transition-all`} style={{ width: `${perc}%` }} title={`${cat}: $${amt.toFixed(2)}`} />
             })}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(categorySummary).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([cat, amount]) => {
              const amt = amount as number;
              return (
              <div key={cat} className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 uppercase">
                <span className={`w-2.5 h-2.5 rounded-full ${cat === 'transport' ? 'bg-blue-500' : cat === 'accommodation' ? 'bg-orange-500' : cat === 'food' ? 'bg-rose-500' : cat === 'activity' ? 'bg-purple-500' : 'bg-slate-400'}`}></span>
                {cat}: <span className="text-slate-900">${amt.toFixed(2)}</span>
              </div>
            )})}
          </div>
        </div>
      )}

      {isManager && (
        <div className="mb-8 border-b-2 border-slate-100 pb-8">
           {!isAdding ? (
             <button 
               onClick={() => setIsAdding(true)}
               className="w-full bg-slate-50 border-2 border-dashed border-slate-300 text-slate-600 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
             >
               <Plus className="w-4 h-4" /> Add Expense
             </button>
           ) : (
             <form onSubmit={handleAdd} className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-200">
               <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm mb-6 flex justify-between items-center">
                 New Expense
                 <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
               </h3>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
                    <input required placeholder="e.g. Dinner at Luigi's" className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors" value={title} onChange={e => setTitle(e.target.value)} />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Amount ($)</label>
                    <input required type="number" step="0.01" min="0.01" placeholder="0.00" className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors" value={amountStr} onChange={e => setAmountStr(e.target.value)} />
                 </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Category</label>
                    <select className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors" value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
                      <option value="accommodation">Accommodation</option>
                      <option value="transport">Transport</option>
                      <option value="food">Food</option>
                      <option value="activity">Activity</option>
                      <option value="other">Other</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Date</label>
                    <input required type="date" className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors" value={date} onChange={e => setDate(e.target.value)} />
                 </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                 <div>
                   <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Who Paid?</label>
                   <select 
                     className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors" 
                     value={payerName} 
                     onChange={e => setPayerName(e.target.value)}
                   >
                     {members.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Split Between</label>
                   <div className="flex flex-wrap gap-2 pt-1">
                     {members.map(m => (
                       <button 
                         key={m}
                         type="button"
                         onClick={() => {
                           if (splitBetween.includes(m)) setSplitBetween(splitBetween.filter(x => x !== m));
                           else setSplitBetween([...splitBetween, m]);
                         }}
                         className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border-2 ${splitBetween.includes(m) ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                       >
                         {m}
                       </button>
                     ))}
                   </div>
                 </div>
               </div>
               
               <button type="submit" className="w-full bg-emerald-600 text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-md flex items-center justify-center gap-2">
                 <Plus className="w-4 h-4" /> Save Expense
               </button>
             </form>
           )}
        </div>
      )}

      <div className="space-y-3">
        {expenses.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-slate-100 border-dashed">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No expenses tracked yet.</p>
          </div>
        ) : (
          [...expenses]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map(expense => {
            const Icon = CATEGORY_ICONS[expense.category] || MoreHorizontal;
            const colors = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.other;

            return (
              <div key={expense.id} className="flex items-center justify-between p-3 sm:p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-200 bg-white transition-all group">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${colors}`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-slate-800 tracking-tight leading-tight mb-0.5 sm:mb-1 truncate">{expense.title}</div>
                    <div className="flex flex-wrap gap-2 items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{expense.payerName} paid</span>
                       <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                       <span>{format(parseISO(expense.date), 'MMM do')}</span>
                       <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                       <span>Split: {expense.splitBetween?.length || 0} people</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-black text-lg text-slate-900">${expense.amount.toFixed(2)}</div>
                    <div className="text-[9px] font-black uppercase text-slate-400">${(expense.amount / (expense.splitBetween?.length || 1)).toFixed(2)} each</div>
                  </div>
                  {isManager && (
                    <button 
                      onClick={() => handleDelete(expense.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {activeTab === 'settlements' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(balances).map(([name, bal]) => (
              <div key={name} className={`p-6 rounded-3xl border-2 transition-all ${bal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Net Balance</div>
                <div className="flex justify-between items-end">
                  <div className="font-black text-xl text-slate-900">{name}</div>
                  <div className={`text-2xl font-black ${bal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {bal >= 0 ? '+' : ''}{bal.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm mb-6 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" /> Suggested Settlements
            </h3>
            <div className="space-y-4">
              {(() => {
                // Simplified settlement algorithm
                const pos = Object.entries(balances).filter(([_, b]) => b > 0.01).sort((a,b) => b[1] - a[1]);
                const neg = Object.entries(balances).filter(([_, b]) => b < -0.01).sort((a,b) => a[1] - b[1]);
                
                const settlements: string[] = [];
                let i = 0, j = 0;
                while(i < pos.length && j < neg.length) {
                  const amount = Math.min(pos[i][1], Math.abs(neg[j][1]));
                  settlements.push(`${neg[j][0]} owes ${pos[i][0]} $${amount.toFixed(2)}`);
                  pos[i][1] -= amount;
                  neg[j][1] += amount;
                  if (pos[i][1] < 0.01) i++;
                  if (neg[j][1] > -0.01) j++;
                }

                if (settlements.length === 0) return <p className="text-xs font-bold text-slate-400 uppercase text-center py-4">All settled up!</p>;
                
                return settlements.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="font-black text-slate-700 tracking-tight">{s}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <input 
                placeholder="Friend's Name..." 
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 transition-colors"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddMember()}
              />
              <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            </div>
            <button 
              onClick={handleAddMember}
              className="bg-emerald-600 text-white font-black uppercase text-xs tracking-widest px-8 py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-md"
            >
              Add Member
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {members.map(member => (
              <div key={member} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 font-black border-2 border-slate-100">
                    {member.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-black text-slate-700">{member}</span>
                </div>
                {member !== 'You' && (
                  <button 
                    onClick={() => handleRemoveMember(member)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Bus, Bed, Utensils, Activity, MoreHorizontal, DollarSign } from 'lucide-react';
import { TripExpense, ExpenseCategory } from '../types';
import { addTripExpense, deleteTripExpense } from '../services/db';

interface TripExpensesProps {
  tripId: string;
  isManager: boolean;
  expenses: TripExpense[];
  setExpenses: React.Dispatch<React.SetStateAction<TripExpense[]>>;
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

export default function TripExpenses({ tripId, isManager, expenses, setExpenses }: TripExpensesProps) {
  const [isAdding, setIsAdding] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const newExpense = {
        title,
        amount,
        category,
        date,
      };
      
      const id = await addTripExpense(tripId, newExpense);
      setExpenses([...expenses, { ...newExpense, id } as TripExpense]);
      
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
  const summary = expenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = 0;
    acc[e.category] += e.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl border-4 border-slate-100">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4 text-emerald-600 font-black text-2xl uppercase tracking-tight">
          <div className="bg-emerald-100 p-3 rounded-2xl shadow-sm transform rotate-3">
            <DollarSign className="w-6 h-6" />
          </div>
          Trip Budget
        </div>
        
        <div className="text-center sm:text-right">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Expenses</div>
          <div className="text-3xl font-black text-slate-900">${totalAmount.toFixed(2)}</div>
        </div>
      </div>

      {expenses.length > 0 && (
        <div className="mb-12">
          <div className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Spending by Category</div>
          <div className="flex w-full h-4 rounded-full overflow-hidden bg-slate-100 mb-4">
             {Object.entries(summary).map(([cat, amount]) => {
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
            {Object.entries(summary).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([cat, amount]) => {
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
              <div key={expense.id} className="flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-200 bg-white transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${colors}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-slate-800 tracking-tight leading-tight mb-1">{expense.title}</div>
                    <div className="flex gap-2 items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <span>{format(parseISO(expense.date), 'MMM do')}</span>
                       <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                       <span>{expense.category}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="font-black text-lg text-slate-900">
                    ${expense.amount.toFixed(2)}
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
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Check, Plus, Trash2, Package } from 'lucide-react';
import { PackingItem } from '../types';
import { getPackingItems, addPackingItem, updatePackingItem, deletePackingItem } from '../services/db';

import { auth } from '../firebase';

interface PackingListProps {
  tripId: string;
  isManager: boolean;
}

export default function PackingList({ tripId, isManager }: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [isNewItemShared, setIsNewItemShared] = useState(false);

  useEffect(() => {
    getPackingItems(tripId).then(data => {
      setItems(data || []);
      setLoading(false);
    });
  }, [tripId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      alert("Please enter an item name.");
      return;
    }

    try {
      // Only managers can create shared items. Others always create personal items.
      const shouldShare = isManager && isNewItemShared;
      const id = await addPackingItem(tripId, { name: newItemName.trim(), isShared: shouldShare });
      if (id) {
        setItems([...items, { id, name: newItemName.trim(), isPacked: false, isShared: shouldShare, ownerId: auth.currentUser?.uid || '' } as PackingItem]);
        setNewItemName('');
        // keep isNewItemShared as is, so they can add multiple shared items easily.
      } else {
        throw new Error("No ID returned from Firestore - check console for errors.");
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || String(err);
      try { const parsed = JSON.parse(msg); msg = parsed.error || msg; } catch {}
      alert(`Could not add item: ${msg}`);
    }
  };

  const handleToggle = async (item: PackingItem) => {
    // Optimistic
    setItems(items.map(i => i.id === item.id ? { ...i, isPacked: !i.isPacked } : i));
    try {
      await updatePackingItem(tripId, item.id, { isPacked: !item.isPacked });
    } catch (err: any) {
      console.error(err);
      // Revert
      setItems(items.map(i => i.id === item.id ? { ...i, isPacked: item.isPacked } : i));
      let msg = err.message || String(err);
      try { const parsed = JSON.parse(msg); msg = parsed.error || msg; } catch {}
      alert(`Could not update item: ${msg}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePackingItem(tripId, id);
      setItems(items.filter(i => i.id !== id));
    } catch (err: any) {
      console.error(err);
      let msg = err.message || String(err);
      try { const parsed = JSON.parse(msg); msg = parsed.error || msg; } catch {}
      alert(`Could not delete item: ${msg}`);
    }
  };

  if (loading) return <div className="text-center py-8 text-slate-500 font-bold uppercase tracking-widest text-xs">Loading packing list...</div>;

  const packedCount = items.filter(i => i.isPacked).length;
  const progress = items.length === 0 ? 0 : (packedCount / items.length) * 100;

  return (
    <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl border-4 border-slate-100">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4 text-amber-600 font-black text-2xl uppercase tracking-tight">
          <div className="bg-amber-100 p-3 rounded-2xl shadow-sm transform -rotate-3">
            <Package className="w-6 h-6" />
          </div>
          Packing List
        </div>
        
        <div className="text-center sm:text-right">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Packed Items</div>
          <div className="text-3xl font-black text-slate-900">{packedCount} <span className="text-xl text-slate-400">/ {items.length}</span></div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mb-8">
          <div className="flex w-full h-4 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <form onSubmit={handleAdd} className="mb-8 flex flex-col gap-3">
        <div className="flex gap-2 sm:gap-3">
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Add item..."
            className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-400 transition-colors"
          />
          <button type="submit" className="bg-amber-500 text-white p-3 rounded-xl hover:bg-amber-600 transition-colors shrink-0">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        {isManager && (
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer self-start ml-2">
            <input 
              type="checkbox" 
              checked={isNewItemShared}
              onChange={(e) => setIsNewItemShared(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Share with all members
          </label>
        )}
      </form>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-slate-100 border-dashed">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No items needed yet.</p>
          </div>
        ) : (
          [...items].sort((a, b) => Number(a.isPacked) - Number(b.isPacked)).map((item) => (
            <div 
              key={item.id} 
              onClick={() => handleToggle(item)}
              className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all group ${item.isPacked ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 hover:border-amber-300'}`}
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-colors shrink-0 ${item.isPacked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}>
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`font-bold text-sm truncate ${item.isPacked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {item.name}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                    {item.isShared ? 'All Members' : 'Personal'}
                  </span>
                </div>
              </div>
              
              {(isManager || item.ownerId === auth.currentUser?.uid) && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Delete item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

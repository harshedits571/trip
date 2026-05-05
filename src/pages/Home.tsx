import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { getTrip, getTripEvents, addTripEvent, updateTripEvent, deleteTripEvent, createTrip, getTripExpenses, addTripExpense } from '../services/db';
import { getTripSuggestions, SuggestedEvent } from '../services/ai';
import { Trip, TripEvent, EventType, TripExpense, ExpenseCategory } from '../types';
import { signInWithGoogle, signOut } from '../firebase';
import { format, parseISO, compareAsc, eachDayOfInterval } from 'date-fns';
import { Navigation, Calendar, MapPin, Clock, Train, Utensils, Bed, Activity, CheckCircle, Circle, Plus, LogIn, LogOut, ArrowRight, Trash2, Sparkles, Loader2, List, DollarSign, Package } from 'lucide-react';
import TripCalendar from '../components/TripCalendar';
import TripExpenses from '../components/TripExpenses';
import PackingList from '../components/PackingList';

const GLOBAL_TRIP_ID = 'default-trip';

export default function Home() {
  const { user } = useAuth();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar' | 'expenses' | 'packing'>('timeline');

  // Form State for new events
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [prefilledData, setPrefilledData] = useState<Partial<TripEvent> | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  
  // State for inline event expense modal
  const [expenseEventId, setExpenseEventId] = useState<string | null>(null);

  // Form State for new trip
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const tripData = await getTrip(GLOBAL_TRIP_ID);
      if (tripData) {
        setTrip(tripData);
        const eventData = await getTripEvents(GLOBAL_TRIP_ID);
        setEvents(eventData || []);
        const expenseData = await getTripExpenses(GLOBAL_TRIP_ID);
        setExpenses(expenseData || []);
      } else {
        setTrip(null);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    setLoading(true);
    const id = await createTrip({
      title: newTitle,
      description: newDesc,
      startDate: '',
      endDate: ''
    }, GLOBAL_TRIP_ID);
    
    if (id) {
      await loadData();
    }
  };

  const isManager = user && trip && user.uid === trip.managerId;

  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    if ((event.type === 'travel' || event.type === 'accommodation') && event.endDate && event.endDate !== event.date) {
      try {
        const dates = eachDayOfInterval({ start: parseISO(event.date), end: parseISO(event.endDate) });
        dates.forEach((d, index) => {
          const dateStr = format(d, 'yyyy-MM-dd');
          if (!acc[dateStr]) acc[dateStr] = [];
          
          let part: 'start' | 'middle' | 'end' = 'middle';
          if (index === 0) part = 'start';
          else if (index === dates.length - 1) part = 'end';
          
          acc[dateStr].push({ event, part });
        });
      } catch (e) {
        // Fallback if dates are invalid
        if (!acc[event.date]) acc[event.date] = [];
        acc[event.date].push({ event, part: 'single' });
      }
    } else {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push({ event, part: 'single' });
    }
    return acc;
  }, {} as Record<string, { event: TripEvent, part: 'start' | 'middle' | 'end' | 'single' }[]>);

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort((a, b) => compareAsc(parseISO(a), parseISO(b)));
  
  // Sort events within each date by startTime
  sortedDates.forEach(date => {
    eventsByDate[date].sort((a, b) => {
      // Put "middle" parts at the top since they take the whole day
      if (a.part === 'middle' && b.part !== 'middle') return -1;
      if (b.part === 'middle' && a.part !== 'middle') return 1;
      
      const timeA = a.part === 'end' ? (a.event.endTime || '23:59') : a.event.startTime;
      const timeB = b.part === 'end' ? (b.event.endTime || '23:59') : b.event.startTime;
      return timeA.localeCompare(timeB);
    });
  });

  const tripStartDate = sortedDates.length > 0 ? sortedDates[0] : null;
  const today = format(new Date(), 'yyyy-MM-dd');
  const tripHasStarted = tripStartDate ? tripStartDate <= today : false;

  const handleToggleStatus = async (e: React.MouseEvent, event: TripEvent) => {
    e.stopPropagation();
    if (!isManager) return;
    const newStatus = event.status === 'completed' ? 'pending' : 'completed';
    // Optimistic update
    setEvents(events.map(ev => ev.id === event.id ? { ...ev, status: newStatus } : ev));
    await updateTripEvent(GLOBAL_TRIP_ID, event.id, { status: newStatus });
  };

  const handleDeleteEvent = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    if (!isManager) return;
    
    setEvents(events.filter(ev => ev.id !== eventId));
    await deleteTripEvent(GLOBAL_TRIP_ID, eventId);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-bold uppercase">Loading Dashboard...</div>;
  
  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="flex items-center gap-4 text-indigo-600 font-black text-2xl tracking-tight uppercase mb-12">
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg transform -rotate-3">
            <Navigation className="w-6 h-6" />
          </div>
          <span className="text-slate-900 title-font hidden sm:inline">WanderPlan</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 mb-6 uppercase text-center max-w-2xl">
          Plan the perfect trip,<br/>together.
        </h1>
        
        {!user ? (
          <div className="text-center w-full max-w-md">
            <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-12">
              The manager hasn't set up the trip itinerary yet, or you need to sign in to create it.
            </p>
            <button 
              onClick={signInWithGoogle}
              className="bg-slate-900 text-white px-8 py-4 rounded-full font-black shadow-xl hover:bg-slate-800 transition-colors uppercase w-full flex items-center justify-center gap-3"
            >
              <LogIn className="w-5 h-5" /> Sign in as Manager
            </button>
          </div>
        ) : (
          <form className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl w-full max-w-lg border-4 border-slate-100" onSubmit={handleCreateTrip}>
             <h2 className="text-lg font-black mb-6 uppercase text-slate-900">Set Up Trip Dashboard</h2>
             <div className="mb-6">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Trip Title</label>
                <input required placeholder="e.g. Summer Euro Trip" className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 font-bold text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
             </div>
             <div className="mb-8">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
                <textarea placeholder="Friends trip to Spain and Italy..." className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 font-bold text-sm h-32 resize-none focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
             </div>
             <button type="submit" className="bg-slate-900 text-white px-8 py-4 w-full rounded-full font-black uppercase text-sm shadow-md hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                Create Itinerary <ArrowRight className="w-5 h-5" />
             </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4 text-indigo-600 font-black text-2xl tracking-tight uppercase">
            <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg transform -rotate-3 hover:translate-y-0.5 hover:rotate-0 transition-transform">
              <Navigation className="w-6 h-6" />
            </div>
            <span className="text-slate-900 title-font hidden sm:inline tracking-widest">WanderPlan</span>
          </div>

          <div>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-500 hidden sm:inline border-2 border-slate-200 bg-white px-3 py-1.5 rounded-full">{user.email}</span>
                <button 
                  onClick={signOut}
                  className="bg-white border-2 border-slate-200 text-slate-600 hover:text-slate-900 px-4 py-2 rounded-full text-xs font-black uppercase flex items-center gap-2 transition-colors hover:border-slate-300 shadow-sm"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-full text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-colors"
              >
                <LogIn className="w-4 h-4" /> Manager Login
              </button>
            )}
          </div>
        </header>
        
        <div className="bg-indigo-600 p-8 sm:p-12 rounded-[2.5rem] shadow-xl mb-12 relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/50 rounded-full blur-3xl translate-x-12 -translate-y-12"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/40 rounded-full blur-3xl -translate-x-12 translate-y-12"></div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
              <h2 className="text-xs font-black text-indigo-200 uppercase tracking-[0.2em]">Trip Itinerary</h2>
              {events.length > 0 && (() => {
                const completed = events.filter(e => e.status === 'completed').length;
                const progress = Math.round((completed / events.length) * 100);
                return (
                  <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
                    <span className="text-xs font-black text-indigo-100 uppercase tracking-widest">{progress}% Completed</span>
                    <div className="w-full sm:w-32 h-2.5 bg-indigo-900/40 rounded-full mt-1.5 overflow-hidden border border-indigo-500/50">
                      <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white mb-6 uppercase tracking-tight">{trip.title}</h1>
            <p className="text-indigo-100 font-bold mb-8 whitespace-pre-wrap text-lg leading-relaxed max-w-3xl">{trip.description}</p>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-6 border-t border-indigo-500/30">
              <div className="flex flex-wrap items-center gap-4 text-xs font-black uppercase">
                {!isManager && (
                  <div className="flex items-center gap-2 bg-indigo-500/30 px-4 py-2.5 rounded-full border border-indigo-400 text-indigo-50 backdrop-blur-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Visitor View
                  </div>
                )}
                {isManager && (
                  <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full shadow-md text-indigo-700">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                    Manager Mode Active
                  </div>
                )}
              </div>

              <div className="flex bg-indigo-900/30 p-1.5 rounded-full border border-indigo-500/30 w-fit backdrop-blur-md shadow-inner">
                <button 
                  onClick={() => setViewMode('timeline')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase transition-all ${viewMode === 'timeline' ? 'bg-white text-indigo-900 shadow-md transform scale-105' : 'text-indigo-200 hover:text-white hover:bg-white/10'}`}
                >
                  <List className="w-4 h-4" /> Timeline
                </button>
                <button 
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-white text-indigo-900 shadow-md transform scale-105' : 'text-indigo-200 hover:text-white hover:bg-white/10'}`}
                >
                  <Calendar className="w-4 h-4" /> Calendar
                </button>
                <button 
                  onClick={() => setViewMode('expenses')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase transition-all ${viewMode === 'expenses' ? 'bg-white text-indigo-900 shadow-md transform scale-105' : 'text-indigo-200 hover:text-white hover:bg-white/10'}`}
                >
                  <DollarSign className="w-4 h-4" /> Expenses
                </button>
                {!tripHasStarted && (
                  <button 
                    onClick={() => setViewMode('packing')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase transition-all ${viewMode === 'packing' ? 'bg-white text-indigo-900 shadow-md transform scale-105' : 'text-indigo-200 hover:text-white hover:bg-white/10'}`}
                  >
                    <Package className="w-4 h-4" /> Packing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
          {viewMode === 'packing' && !tripHasStarted ? (
            <div className="mb-12">
              <PackingList tripId={GLOBAL_TRIP_ID} isManager={isManager} />
            </div>
          ) : viewMode === 'expenses' ? (
            <div className="mb-12">
              <TripExpenses tripId={GLOBAL_TRIP_ID} isManager={isManager} expenses={expenses} setExpenses={setExpenses} />
            </div>
          ) : viewMode === 'calendar' ? (
            <div className="mb-12">
              <TripCalendar events={events} />
            </div>
          ) : (
            <div className="space-y-12">
          {sortedDates.length === 0 ? (
            <div className="text-center py-20 bg-white border-4 border-slate-100 border-dashed rounded-3xl shadow-sm">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-900 mb-1 uppercase">No Schedule Yet</h3>
              <p className="text-sm font-bold text-slate-500 uppercase">
                {isManager ? "Start adding events to build the itinerary." : "The manager hasn't added any events yet."}
              </p>
            </div>
          ) : (
            sortedDates.map(date => (
              <div key={date} className="relative flex flex-col md:flex-row gap-4 md:gap-8 mb-12">
                <div className="md:w-48 shrink-0 relative z-20">
                  <div className="sticky top-8 bg-slate-900 border-4 border-slate-800 text-white p-6 rounded-[2rem] shadow-xl flex flex-col transform hover:scale-[1.02] transition-transform">
                     <span className="font-black uppercase text-indigo-300 tracking-widest text-xs mb-1">{format(parseISO(date), 'EEEE')}</span>
                     <span className="text-3xl font-black tracking-tight">{format(parseISO(date), 'MMM do')}</span>
                     {(() => {
                        const dayEvents = eventsByDate[date];
                        const completedDayEvents = dayEvents.filter(e => e.event.status === 'completed').length;
                        const dayProgress = Math.round((completedDayEvents / dayEvents.length) * 100);
                        return (
                          <div className="mt-6 flex flex-col gap-2" title={`${completedDayEvents} of ${dayEvents.length} completed`}>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Progress</span>
                              <span className="text-xs font-black text-indigo-300">{dayProgress}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                              <div className="bg-indigo-500 h-full rounded-full transition-all duration-500 relative overflow-hidden" style={{ width: `${dayProgress}%` }}>
                                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                              </div>
                            </div>
                          </div>
                        );
                     })()}
                  </div>
                </div>

                <div className="flex-1 space-y-6 relative">
                  {/* Timeline Line */}
                  <div className="absolute top-0 bottom-0 left-[27px] sm:left-[59px] w-1 bg-indigo-100 rounded-full -z-10 hidden md:block"></div>
                  
                  {eventsByDate[date].map(item => (
                    <EventCard 
                      key={`${item.event.id}-${item.part}`} 
                      event={item.event} 
                      part={item.part}
                      isManager={!!isManager}
                      expenses={expenses.filter(e => e.eventId === item.event.id)}
                      onToggle={handleToggleStatus}
                      onDelete={handleDeleteEvent}
                      onAddExpense={(e, ev) => {
                         e.stopPropagation();
                         setExpenseEventId(ev.id);
                      }}
                      onDeleteExpense={async (e, id) => {
                         e.stopPropagation();
                         try {
                           await deleteTripExpense(GLOBAL_TRIP_ID, id);
                           setExpenses(expenses.filter(ex => ex.id !== id));
                         } catch (err) {
                           console.error(err);
                         }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        )}
      </div>

      {isManager && (
          <div className="mt-12 pt-8 border-t-4 border-indigo-100 flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={() => {
                setPrefilledData(null);
                setIsAddingEvent(true);
              }}
              className="bg-slate-900 text-white shadow-xl px-8 py-4 rounded-full font-black uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" /> Add New Event
            </button>
            <button 
              onClick={() => setShowAiModal(true)}
              className="bg-purple-600 text-white shadow-xl px-8 py-4 rounded-full font-black uppercase tracking-wider hover:bg-purple-700 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-5 h-5" /> Get AI Ideas
            </button>
          </div>
        )}

        {isAddingEvent && (
          <EventModal 
            tripId={GLOBAL_TRIP_ID} 
            initialData={prefilledData}
            onClose={() => {
              setIsAddingEvent(false);
              setPrefilledData(null);
            }} 
            onAdded={(newEvent) => {
              setEvents([...events, newEvent]);
              setIsAddingEvent(false);
              setPrefilledData(null);
            }} 
          />
        )}

        {showAiModal && trip && (
          <AiSuggestionsModal 
            trip={trip}
            existingEvents={events}
            onClose={() => setShowAiModal(false)}
            onSelect={(suggestion) => {
              setShowAiModal(false);
              setPrefilledData({
                title: suggestion.title,
                type: suggestion.type,
                notes: suggestion.notes,
              });
              setIsAddingEvent(true);
            }}
          />
        )}

        {expenseEventId && (
          <EventExpenseModal
            tripId={GLOBAL_TRIP_ID}
            eventId={expenseEventId}
            onClose={() => setExpenseEventId(null)}
            onAdded={(newExpense) => {
               setExpenses([...expenses, newExpense]);
               setExpenseEventId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function EventCard({ event, part, isManager, expenses, onToggle, onDelete, onAddExpense, onDeleteExpense }: { 
  key?: string | number,
  event: TripEvent, 
  part: 'start' | 'middle' | 'end' | 'single',
  isManager: boolean, 
  expenses: TripExpense[],
  onToggle: (e: React.MouseEvent, ev: TripEvent) => Promise<void> | void,
  onDelete: (e: React.MouseEvent, id: string) => Promise<void> | void,
  onAddExpense: (e: React.MouseEvent, ev: TripEvent) => void,
  onDeleteExpense?: (e: React.MouseEvent, id: string) => Promise<void> | void
}) {
  const isDone = event.status === 'completed';
  const Icon = getIconForType(event.type);

  // Set colors based on type
  let colorClass = 'border-slate-100 bg-white text-slate-900 border-4 shadow-sm';
  let headerColor = 'text-slate-900';
  let iconTheme = 'bg-slate-100 text-slate-700';

  if (event.type === 'travel') {
    colorClass = 'border-4 border-blue-100 bg-white shadow-sm';
    headerColor = 'text-blue-600';
    iconTheme = 'bg-blue-500 text-white shadow-md';
  } else if (event.type === 'food') {
    colorClass = 'border-4 border-rose-100 bg-white shadow-sm';
    headerColor = 'text-rose-500';
    iconTheme = 'bg-rose-500 text-white shadow-md';
  } else if (event.type === 'activity') {
    colorClass = 'border-4 border-purple-100 bg-white shadow-sm';
    headerColor = 'text-purple-600';
    iconTheme = 'bg-purple-600 text-white shadow-md';
  } else if (event.type === 'accommodation') {
    colorClass = 'border-4 border-orange-100 bg-white shadow-sm';
    headerColor = 'text-orange-600';
    iconTheme = 'bg-orange-500 text-white shadow-md';
  }
  
  if (isDone) {
    colorClass = 'border-4 border-emerald-100 bg-emerald-50 opacity-80';
    headerColor = 'text-emerald-700 decoration-emerald-400 line-through';
    iconTheme = 'bg-emerald-500 text-white';
  }

  return (
    <div className={`relative p-6 rounded-3xl transition-all ${colorClass}`}>
      {/* Timeline Dot */}
      <div className={`absolute -left-[22px] sm:-left-[38px] top-8 w-4 h-4 rounded-full shadow-sm border-2 md:block hidden ${isDone ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-indigo-300'}`}></div>

      <div className="flex gap-4 items-start">
        <div className={`p-3 rounded-2xl shrink-0 ${iconTheme}`}>
          <Icon className="w-6 h-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
            <div>
              {part === 'middle' && (
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {event.type === 'travel' ? 'In Transit' : 'Staying At'}
                </div>
              )}
              {part === 'end' && (
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {event.type === 'travel' ? 'Arrival Day' : 'Check-out Day'}
                </div>
              )}
              <h3 className={`font-black text-xl uppercase truncate ${headerColor}`}>
                {event.title}
              </h3>
            </div>
            
              <div className="flex items-center gap-3 shrink-0 mt-1 sm:mt-0">
              {!(event.type === 'travel' || event.type === 'accommodation') && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border-2 border-slate-100 uppercase">
                  <Clock className="w-3.5 h-3.5" />
                  {event.startTime} {event.endTime && `- ${event.endTime}`}
                </div>
              )}
              
              {isManager && (
                <div className="flex items-center gap-1 ml-2 border-l-2 pl-3 border-slate-200">
                   <button 
                     onClick={(e) => onToggle(e, event)}
                     className={`p-1.5 rounded-full transition-colors ${isDone ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                     title={isDone ? "Mark as pending" : "Mark as completed"}
                   >
                     {isDone ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                   </button>
                   {part === 'single' || part === 'start' ? (
                     <button 
                       onClick={(e) => onDelete(e, event.id)}
                       className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                       title="Delete Event"
                     >
                       <Trash2 className="w-5 h-5" />
                     </button>
                   ) : null}
                </div>
              )}
            </div>
          </div>
          
          {(event.type === 'travel' || event.type === 'accommodation') ? (
            <div className={`mt-4 mb-4 p-4 rounded-2xl border-2 ${isDone ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'} flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8`}>
              {part === 'start' || part === 'single' ? (
                <div className="flex-1">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {event.type === 'travel' ? 'Departure' : 'Check-in'}
                  </div>
                  <div className={`text-lg font-black ${headerColor}`}>{event.startTime}</div>
                  {event.date && <div className="text-xs font-bold text-slate-500 uppercase">{format(parseISO(event.date), 'MMM do, yyyy')}</div>}
                  
                  {event.locationName && (
                    <div className="mt-2">
                      {event.locationUrl ? (
                        <a href={event.locationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-blue-600 hover:underline">
                          <MapPin className="w-3 h-3" /> {event.locationName}
                        </a>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                          <MapPin className="w-3 h-3" /> {event.locationName}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
              
              {part === 'single' && (
                <div className="hidden sm:flex flex-col items-center justify-center text-slate-300">
                  <div className="w-1 h-1 rounded-full bg-slate-300 mb-1"></div>
                  <div className="w-1 h-1 rounded-full bg-slate-300 mb-1"></div>
                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                </div>
              )}
              
              {part === 'end' || part === 'single' ? (
                <div className="flex-1">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {event.type === 'travel' ? 'Arrival' : 'Check-out'}
                  </div>
                  <div className={`text-lg font-black ${headerColor}`}>{event.endTime || '??:??'}</div>
                  {event.endDate ? (
                    <div className="text-xs font-bold text-slate-500 uppercase">{format(parseISO(event.endDate), 'MMM do, yyyy')}</div>
                  ) : (
                     <div className="text-xs font-bold text-slate-500 uppercase">Same day</div>
                  )}

                  {event.destinationName && (
                    <div className="mt-2">
                      {event.destinationUrl ? (
                        <a href={event.destinationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-blue-600 hover:underline">
                          <MapPin className="w-3 h-3" /> {event.destinationName}
                        </a>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                          <MapPin className="w-3 h-3" /> {event.destinationName}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {part === 'middle' && (
                <div className="flex-1 text-center py-2">
                   <div className="text-xs font-black uppercase text-slate-500 tracking-widest">
                     {event.type === 'travel' ? 'Traveling all day' : 'Staying all day'}
                   </div>
                </div>
              )}
            </div>
          ) : (
            event.locationName && (
              <div className="mt-3">
                {event.locationUrl ? (
                  <a 
                    href={event.locationUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border-2 border-blue-200 transition-colors active:scale-95"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{event.locationName}</span>
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border-2 border-slate-200">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{event.locationName}</span>
                  </div>
                )}
              </div>
            )
          )}
          
          {event.notes && (
            <div className={`mt-4 p-4 rounded-2xl border-2 ${isDone ? 'bg-emerald-100/50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`text-sm font-bold ${isDone ? 'text-emerald-800' : 'text-slate-600'}`}>
                {event.notes}
              </p>
            </div>
          )}

          {expenses.length > 0 && (
            <div className="mt-4 pt-4 border-t-2 border-slate-100/50 flex flex-col gap-2">
               <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between">
                  <span>Event Expenses</span>
                  <span className="text-slate-600">${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
               </div>
               {expenses.map(exp => (
                  <div key={exp.id} className="flex justify-between items-center text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 group">
                     <span>{exp.title}</span>
                     <div className="flex items-center gap-3">
                       <span className="text-slate-900">${exp.amount.toFixed(2)}</span>
                       {isManager && onDeleteExpense && (
                         <button 
                           onClick={(e) => onDeleteExpense(e, exp.id)}
                           className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1"
                           title="Delete expense"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       )}
                     </div>
                  </div>
               ))}
            </div>
          )}

          {(part === 'single' || part === 'start') && isManager && (
            <div className="mt-4 flex">
              <button 
                onClick={(e) => onAddExpense(e, event)}
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
              >
                <Plus className="w-3.5 h-3.5" /> Add Expense
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getIconForType(type: EventType) {
  switch (type) {
    case 'travel': return Train;
    case 'food': return Utensils;
    case 'accommodation': return Bed;
    case 'activity':
    default: return Activity;
  }
}

function EventExpenseModal({ tripId, eventId, onClose, onAdded }: { tripId: string, eventId: string, onClose: () => void, onAdded: (e: TripExpense) => void }) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amountStr || loading) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    setLoading(true);
    
    try {
      const newExpense = {
        title,
        amount,
        category,
        date,
        eventId,
      };
      
      const id = await addTripExpense(tripId, newExpense);
      onAdded({ ...newExpense, id } as TripExpense);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Add Expense</h2>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
                <input required placeholder="e.g. Uber to Airport" className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-300 font-bold text-sm transition-all text-slate-900" value={title} onChange={e => setTitle(e.target.value)} />
             </div>
             <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Amount ($)</label>
                <input required type="number" step="0.01" min="0.01" placeholder="0.00" className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-300 font-bold text-sm transition-all text-slate-900" value={amountStr} onChange={e => setAmountStr(e.target.value)} />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Category</label>
                  <select className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-300 font-bold text-sm transition-all text-slate-900" value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
                    <option value="accommodation">Accommodation</option>
                    <option value="transport">Transport</option>
                    <option value="food">Food</option>
                    <option value="activity">Activity</option>
                    <option value="other">Other</option>
                  </select>
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Date</label>
                  <input required type="date" className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-300 font-bold text-sm transition-all text-slate-900" value={date} onChange={e => setDate(e.target.value)} />
               </div>
             </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-[2] bg-indigo-600 text-white py-4 font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:translate-y-px transition-all disabled:opacity-50">
                {loading ? 'Saving...' : 'Add Expense'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EventModal({ tripId, initialData, onClose, onAdded }: { tripId: string, initialData: Partial<TripEvent> | null, onClose: () => void, onAdded: (e: TripEvent) => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    type: initialData?.type || 'activity' as EventType,
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '',
    endDate: '',
    locationName: initialData?.locationName || '',
    locationUrl: initialData?.locationUrl || '',
    destinationName: initialData?.destinationName || '',
    destinationUrl: initialData?.destinationUrl || '',
    notes: initialData?.notes || ''
  });

  const isTravel = formData.type === 'travel';
  const isAccommodation = formData.type === 'accommodation';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.startTime || loading) return;
    setLoading(true);
    
    // Clean up data based on type
    const newEventData = {
      ...formData,
      status: 'pending' as const
    };

    if (!isTravel && !isAccommodation) {
      delete (newEventData as any).endDate;
      delete (newEventData as any).destinationName;
      delete (newEventData as any).destinationUrl;
    }
    
    const id = await addTripEvent(tripId, newEventData);
    if (id) {
      onAdded({ id, ...newEventData, createdAt: new Date(), updatedAt: new Date() } as unknown as TripEvent);
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-4 border-slate-100">
        <div className="px-8 py-6 border-b-4 border-slate-100 flex justify-between items-center bg-white shrink-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Add Schedule Item</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 space-y-6">
          <div>
             <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
               {isAccommodation ? "Where are we staying?" : isTravel ? "What are we taking?" : "What are we doing?"}
             </label>
             <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
               className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-orange-300 transition-all font-bold text-sm"
               placeholder={isAccommodation ? "Hotel Name" : isTravel ? "e.g. Train to Paris, Flight BA123" : "e.g. Dinner at Louie's"}
             />
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Type</label>
            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as EventType})}
              className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
            >
              <option value="activity">Activity</option>
              <option value="travel">Travel/Transit</option>
              <option value="food">Food & Dining</option>
              <option value="accommodation">Accommodation</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                {isAccommodation ? "Check-in Date" : isTravel ? "Departure Date" : "Date"}
              </label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                {isAccommodation ? "Check-in Time" : isTravel ? "Departure Time" : "Start Time"}
              </label>
              <input required type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})}
                className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
              />
            </div>
          </div>

          {(isTravel || isAccommodation) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                  {isAccommodation ? "Check-out Date (Optional)" : "Arrival Date (Optional)"}
                </label>
                <input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})}
                  className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                  {isAccommodation ? "Check-out Time" : "Arrival Time"}
                </label>
                <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})}
                  className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
                />
              </div>
            </div>
          )}

          {(!isTravel && !isAccommodation) && (
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">End Time (Optional)</label>
              <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})}
                className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
              />
            </div>
          )}

          <div className="pt-4 border-t-4 border-slate-100">
             <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                {isTravel ? "From (Station/Airport)" : isAccommodation ? "Hotel Address/Location Name" : "Location Name"}
             </label>
             <input type="text" value={formData.locationName} onChange={e => setFormData({...formData, locationName: e.target.value})}
               className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 mb-4 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
               placeholder={isTravel ? "e.g. Gare du Nord" : "e.g. Place du Tertre"}
             />
             
             <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Google Maps Link</label>
             <input type="url" value={formData.locationUrl} onChange={e => setFormData({...formData, locationUrl: e.target.value})}
               className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
               placeholder="https://maps.google.com/..."
             />
          </div>

          {isTravel && (
            <div className="pt-4 border-t-4 border-slate-100">
               <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                  To (Station/Airport)
               </label>
               <input type="text" value={formData.destinationName} onChange={e => setFormData({...formData, destinationName: e.target.value})}
                 className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 mb-4 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
                 placeholder="e.g. Victoria Station"
               />
               
               <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Destination Maps Link</label>
               <input type="url" value={formData.destinationUrl} onChange={e => setFormData({...formData, destinationUrl: e.target.value})}
                 className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
                 placeholder="https://maps.google.com/..."
               />
            </div>
          )}

          <div>
             <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Details / Notes</label>
             <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
               className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 h-24 resize-none focus:outline-none focus:border-orange-300 font-bold text-sm transition-all"
               placeholder={isTravel ? "Seat numbers, booking ref..." : "Reservation under 'John', Confirmation #123456"}
             />
          </div>

          <div className="pt-4 flex shrink-0 gap-3 justify-end border-t-4 border-slate-100 mt-4">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-6 py-3 font-black text-slate-600 hover:bg-slate-100 rounded-full text-sm uppercase transition-colors"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-3 font-black bg-slate-900 text-white hover:bg-slate-800 rounded-full uppercase text-sm transition-colors shadow-md disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add to Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AiSuggestionsModal({ trip, existingEvents, onClose, onSelect }: { trip: Trip, existingEvents: TripEvent[], onClose: () => void, onSelect: (s: SuggestedEvent) => void }) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestedEvent[]>([]);

  useEffect(() => {
    getTripSuggestions(trip, existingEvents).then(res => {
      setSuggestions(res);
      setLoading(false);
    });
  }, [trip, existingEvents]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-4 border-purple-100">
        <div className="px-8 py-6 border-b-4 border-slate-100 flex justify-between items-center bg-purple-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 text-white p-2 rounded-xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-purple-900 uppercase">AI Suggestions</h2>
          </div>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-purple-600">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">Generating Ideas...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-bold text-slate-500">No suggestions found. Try adding more description to your trip!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {suggestions.map((s, i) => {
                const Icon = getIconForType(s.type);
                return (
                  <div key={i} className="group border-2 border-slate-100 hover:border-purple-200 rounded-2xl p-4 transition-all hover:shadow-lg bg-white relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex gap-4 items-start flex-1">
                      <div className="bg-purple-100 text-purple-600 p-3 rounded-xl shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-lg uppercase leading-tight mb-1">{s.title}</h4>
                        <div className="text-xs font-black uppercase text-purple-600 tracking-widest mb-2">{s.type}</div>
                        <p className="text-sm font-bold text-slate-500 leading-snug">{s.notes}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onSelect(s)}
                      className="shrink-0 w-full sm:w-auto bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add This
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-4 pb-6 px-8 flex shrink-0 justify-end border-t-4 border-slate-100">
          <button type="button" onClick={onClose}
            className="px-6 py-3 font-black text-slate-600 hover:bg-slate-100 rounded-full text-sm uppercase transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

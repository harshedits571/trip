import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  isSameDay, 
  parseISO 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Activity, Utensils, Bed, Train, Calendar as CalendarIcon, Map } from 'lucide-react';
import { TripEvent } from '../types';

interface TripCalendarProps {
  events: TripEvent[];
}

const getEventStyles = (type: string, isDone: boolean) => {
  if (isDone) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  switch (type) {
    case 'travel': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'food': return 'bg-rose-100 text-rose-700 border border-rose-200';
    case 'accommodation': return 'bg-orange-100 text-orange-700 border border-orange-200';
    case 'activity':
    default: return 'bg-purple-100 text-purple-700 border border-purple-200';
  }
};

export default function TripCalendar({ events }: TripCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getEventsForDate = (date: Date) => {
    // Collect events that span this date. Similar to timeline grouping.
    const dayEvents: TripEvent[] = [];
    events.forEach(event => {
      const start = parseISO(event.date);
      if (isSameDay(start, date)) {
        dayEvents.push(event);
      } else if ((event.type === 'travel' || event.type === 'accommodation') && event.endDate) {
        const end = parseISO(event.endDate);
        if (date >= start && date <= end) {
          dayEvents.push(event);
        }
      }
    });
    return dayEvents;
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-xl border-4 border-slate-100">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-600 p-3 rounded-2xl transform -rotate-6">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black uppercase text-slate-900 tracking-wider">
            {format(currentMonth, dateFormat)}
          </h2>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-100">
          <button 
            onClick={prevMonth}
            className="p-3 hover:bg-white hover:text-indigo-600 hover:shadow-sm text-slate-500 rounded-xl transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={goToToday}
            className="px-4 py-2 font-black text-xs uppercase text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Today
          </button>
          <button 
            onClick={nextMonth}
            className="p-3 hover:bg-white hover:text-indigo-600 hover:shadow-sm text-slate-500 rounded-xl transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="min-w-[600px] sm:min-w-0">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center font-black text-[10px] sm:text-xs uppercase text-slate-400 tracking-widest py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-4">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDate = isToday(day);

          return (
            <div 
              key={idx} 
              className={`min-h-[100px] sm:min-h-[140px] p-2 sm:p-3 rounded-2xl sm:rounded-3xl border-2 transition-all group ${
                !isCurrentMonth ? 'bg-slate-50/50 opacity-40 border-transparent' 
                : isTodayDate ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                : dayEvents.length > 0 ? 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md' 
                : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={`text-xs sm:text-sm font-black w-7 h-7 flex items-center justify-center rounded-full ${!isCurrentMonth ? 'text-slate-400' : isTodayDate ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700 group-hover:text-indigo-600'}`}>
                  {format(day, 'd')}
                </div>
                {dayEvents.length > 0 && (
                  <div className="hidden sm:flex text-[10px] font-black uppercase text-slate-400">
                    {dayEvents.length}
                  </div>
                )}
              </div>
              
              <div className="space-y-1.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event, i) => (
                  <div key={i} className={`flex items-center gap-1.5 text-[10px] font-bold p-1.5 sm:px-2 sm:py-1.5 rounded-lg truncate pointer-events-none transition-transform hover:scale-[1.02] ${getEventStyles(event.type, event.status === 'completed')}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 hidden sm:block"></span>
                    <span className="truncate flex-1 tracking-tight">{event.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] font-black text-slate-400 text-left pl-1 uppercase tracking-widest mt-2">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
          </div>
        </div>
      </div>
    </div>
  );
}

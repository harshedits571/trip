export interface Trip {
  id: string;
  title: string;
  description: string;
  managerId: string;
  startDate: string;
  endDate: string;
  members: string[]; // List of member names for the trip
  createdAt: any;
  updatedAt: any;
}

export type EventType = 'travel' | 'activity' | 'food' | 'accommodation';
export type EventStatus = 'pending' | 'completed';
export type ExpenseCategory = 'transport' | 'accommodation' | 'food' | 'activity' | 'other';

export interface TripExpense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  payerName: string; // Name of the person who paid
  splitBetween: string[]; // List of names sharing this expense
  eventId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface PackingItem {
  id: string;
  name: string;
  isPacked: boolean;
  isShared: boolean;
  ownerId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface TripEvent {
  id: string;
  title: string;
  type: EventType;
  startTime: string;
  endTime: string;
  locationName: string;
  locationUrl: string;
  notes: string;
  status: EventStatus;
  date: string;
  endDate?: string;
  destinationName?: string;
  destinationUrl?: string;
  createdAt: any;
  updatedAt: any;
}

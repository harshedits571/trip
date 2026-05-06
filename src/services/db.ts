import { collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where, or } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Trip, TripEvent } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestoreErrors';

export async function createTrip(data: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'managerId'>, tripId?: string): Promise<string> {
  const tripRef = tripId ? doc(db, 'trips', tripId) : doc(collection(db, 'trips'));
  const managerId = auth.currentUser?.uid;
  if (!managerId) throw new Error('Must be signed in to create a trip');

  try {
    await setDoc(tripRef, {
      ...data,
      managerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return tripRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'trips');
  }
}

export async function getUserTrips(): Promise<Trip[]> {
  const managerId = auth.currentUser?.uid;
  if (!managerId) return [];

  try {
    const q = query(collection(db, 'trips'), where('managerId', '==', managerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'trips');
  }
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  try {
    const d = await getDoc(doc(db, 'trips', tripId));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() } as Trip;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `trips/${tripId}`);
  }
}

export async function getTripEvents(tripId: string): Promise<TripEvent[]> {
  try {
    const snapshot = await getDocs(collection(db, 'trips', tripId, 'events'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TripEvent));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `trips/${tripId}/events`);
  }
}

export async function addTripEvent(tripId: string, data: Omit<TripEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const eventRef = doc(collection(db, 'trips', tripId, 'events'));
  try {
    await setDoc(eventRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return eventRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `trips/${tripId}/events`);
  }
}

export async function updateTripEvent(tripId: string, eventId: string, data: Partial<TripEvent>): Promise<void> {
  try {
    await updateDoc(doc(db, 'trips', tripId, 'events', eventId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `trips/${tripId}/events/${eventId}`);
  }
}

export async function deleteTripEvent(tripId: string, eventId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'trips', tripId, 'events', eventId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `trips/${tripId}/events/${eventId}`);
  }
}

export async function getTripExpenses(tripId: string) {
  try {
    const snapshot = await getDocs(collection(db, 'trips', tripId, 'expenses'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `trips/${tripId}/expenses`);
  }
}

export async function addTripExpense(tripId: string, data: any): Promise<string> {
  const ref = doc(collection(db, 'trips', tripId, 'expenses'));
  try {
    await setDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `trips/${tripId}/expenses`);
  }
}

export async function deleteTripExpense(tripId: string, expenseId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'trips', tripId, 'expenses', expenseId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `trips/${tripId}/expenses/${expenseId}`);
  }
}

export async function getPackingItems(tripId: string) {
  try {
    const q = query(
      collection(db, 'trips', tripId, 'packingItems'),
      or(
        where('isShared', '==', true),
        where('ownerId', '==', auth.currentUser?.uid || '')
      )
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `trips/${tripId}/packingItems`);
  }
}

export async function addPackingItem(tripId: string, data: any): Promise<string> {
  if (!auth.currentUser) throw new Error("Must be logged in to add packing items");
  const ref = doc(collection(db, 'trips', tripId, 'packingItems'));
  try {
    await setDoc(ref, {
      ...data,
      isPacked: false,
      ownerId: auth.currentUser.uid,
      // If the UI passes isShared, it will be included in data.
      // Otherwise, default to false.
      isShared: data.isShared || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `trips/${tripId}/packingItems`);
  }
}

export async function updatePackingItem(tripId: string, itemId: string, data: any): Promise<void> {
  try {
    const { id, createdAt, ...updateFields } = data;
    await updateDoc(doc(db, 'trips', tripId, 'packingItems', itemId), {
      ...updateFields,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `trips/${tripId}/packingItems/${itemId}`);
  }
}

export async function deletePackingItem(tripId: string, itemId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'trips', tripId, 'packingItems', itemId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `trips/${tripId}/packingItems/${itemId}`);
  }
}

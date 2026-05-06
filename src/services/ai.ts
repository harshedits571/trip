import { GoogleGenAI, Type } from "@google/genai";
import { Trip, TripEvent, EventType } from "../types";

export interface SuggestedEvent {
  title: string;
  type: EventType;
  notes: string;
}

export async function getTripSuggestions(trip: Trip, existingEvents: TripEvent[]): Promise<SuggestedEvent[]> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Create a context summary
    const existingTitles = existingEvents.map(e => e.title).join(", ");
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest 5 great activities, food, or places to visit for a trip titled "${trip.title}" with description "${trip.description}". 
      Here is what is already planned: ${existingTitles || "Nothing planned yet"}. 
      Do not suggest things already planned. Return diverse and interesting options.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "The name of the place, activity, or food place.",
              },
              type: {
                type: Type.STRING,
                description: "Must be one of: 'activity', 'food', 'travel', 'accommodation'. Usually 'activity' or 'food'.",
              },
              notes: {
                type: Type.STRING,
                description: "Why we should go here, or a short engaging description.",
              },
            },
            required: ["title", "type", "notes"],
          },
        },
      },
    });

    const jsonStr = response.text?.trim();
    if (jsonStr) {
      const suggestions = JSON.parse(jsonStr) as SuggestedEvent[];
      // Filter out invalid types just in case
      return suggestions.filter(s => ['activity', 'food', 'travel', 'accommodation'].includes(s.type));
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch AI suggestions:", error);
    return [];
  }
}

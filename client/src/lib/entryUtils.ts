import type { Entry } from "@shared/schema";

export function getRandomEntry(entries: Entry[], lastId?: number): Entry {
  if (entries.length === 0) {
    throw new Error("No entries available");
  }
  
  if (entries.length === 1) {
    return entries[0];
  }
  
  let pick: Entry;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops
  
  do {
    pick = entries[Math.floor(Math.random() * entries.length)];
    attempts++;
  } while (pick.id === lastId && attempts < maxAttempts);
  
  return pick;
}

export function validateEntry(entry: any): entry is Entry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof entry.id === 'number' &&
    typeof entry.title === 'string' &&
    typeof entry.imageUrl === 'string' &&
    typeof entry.externalLink === 'string' &&
    typeof entry.artist === 'string' &&
    Array.isArray(entry.tags) &&
    entry.tags.every((tag: any) => typeof tag === 'string')
  );
}

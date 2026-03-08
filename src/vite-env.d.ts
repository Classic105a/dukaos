/// <reference types="vite/client" />

// Fix Dexie TS1540 error in dexie.d.ts
declare global {
  // This is intentionally empty - the skipLibCheck should handle it
}
export {};

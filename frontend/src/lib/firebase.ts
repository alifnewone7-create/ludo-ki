import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app);

export interface MatchPlayer {
  name: string;
  isBot: boolean;
  order: number;
}

export interface DiceRoll {
  color: string;
  value: number;
  ts: number;
}

export interface MatchControl {
  rank1?: string;
  rank2?: string;
  force?: Record<string, number>;
}

export interface Match {
  code: string;
  status: "live" | "finished" | "abandoned";
  createdAt: number;
  finishedAt?: number;
  nop: number;
  gametype: number;
  players?: Record<string, MatchPlayer>;
  state?: {
    currentTurn?: string;
    lastRoll?: DiceRoll;
    recentRolls?: DiceRoll[];
    progress?: Record<string, number>;
  };
  winners?: Record<string, { color: string; name: string }>;
  control?: MatchControl;
}

export const GAME_TYPES: Record<number, string> = {
  1: "CLASSIC",
  2: "TEAM UP",
  3: "QUICK",
  4: "VS COMPUTER",
};

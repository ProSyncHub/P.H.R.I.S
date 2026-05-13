import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hoursFromMinutes(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

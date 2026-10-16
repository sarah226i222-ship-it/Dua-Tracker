export type Schedule =
  | { type: 'daily' }
  | { type: 'weekly'; days: number[] }
  | { type: 'everyN'; n: number; anchor: string };
export interface Dua { id: string; title: string; text: string; kind: 'required' | 'optional'; schedule: Schedule | null; order: number }
export type DuaInput = Omit<Dua, 'id'> & { id?: string };
export interface Rotation { activeIds: string[]; doneIds: string[]; cycle: number }
export interface Completion { duaId: string; dateKey: string }
export interface Prefs { largeText: boolean }

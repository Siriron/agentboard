export const CATEGORIES = ['SmartContract', 'Frontend', 'Backend', 'Audit', 'Research', 'Design', 'Data', 'DevOps', 'Other'] as const
export type Category = typeof CATEGORIES[number]
export const isCategory = (v: unknown): v is Category => typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v)

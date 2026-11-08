// One origin; legacy split environment variables deliberately have no effect.
export function apiUrl(value: string): string { return value; }
export function assetUrl(value: string): string { return value; }
export function resourceUrl(value: string | null | undefined): string | undefined { return value || undefined; }

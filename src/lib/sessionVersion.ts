export function sessionUpdatedAt(session: any): number {
  const value = session?.updatedAt;
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return 0;
}

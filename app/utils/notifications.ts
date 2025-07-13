// Formats notification time, ensuring Hive timestamps are parsed as UTC and displayed in local time
export function formatNotificationTime(date: string): string {
  if (!date) return '';
  // If already ends with Z, don't double append
  const isoDate = date.endsWith('Z') ? date : date + 'Z';
  return new Date(isoDate).toLocaleString();
}

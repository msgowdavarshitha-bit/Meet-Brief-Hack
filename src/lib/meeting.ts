export const purposes = ['Business Development', 'Sales Discussion', 'Partnership', 'Job Interview', 'Investor Meeting', 'Client Meeting', 'Consulting', 'General Business Meeting', 'Custom'] as const;

export function researchWindow(meetingDate: string, today: string) {
  const meeting = new Date(`${meetingDate}T00:00:00Z`);
  if (Number.isNaN(meeting.getTime())) throw new Error('Enter a valid meeting date.');
  const start = new Date(meeting);
  start.setUTCDate(start.getUTCDate() - 30);
  return { start: start.toISOString().slice(0, 10), end: meetingDate > today ? today : meetingDate, future: meetingDate > today, past: meetingDate < today, empty: start.toISOString().slice(0, 10) > today };
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function prettyDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
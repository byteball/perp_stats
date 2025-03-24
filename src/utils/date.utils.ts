export function getTimestamp30DaysAgo(): number {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return Math.floor(date.getTime() / 1000);
}

export function generateHoursByTimestampRange(from: number, to: number): number[] {
  const hourInSeconds = 3600;
  const roundedFrom = Math.ceil(from / hourInSeconds) * hourInSeconds;

  const hours: number[] = [];
  let currentHour = roundedFrom;

  while (currentHour <= to) {
    hours.push(currentHour);
    currentHour += hourInSeconds;
  }

  return hours;
}

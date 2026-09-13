import type { AttendanceStatus, AttendanceCalculationResult, DutyType } from '../types';

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatMinutesToHM(totalMinutes: number): string {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const h = Math.floor(absMinutes / 60);
  const m = Math.round(absMinutes % 60);
  const formatted = `${h}h ${m.toString().padStart(2, '0')}m`;
  return isNegative ? `-${formatted}` : formatted;
}

export function formatMinutesToDecimal(totalMinutes: number): string {
  const hours = (totalMinutes / 60).toFixed(1);
  return `${hours}h`;
}

export function formatTime12h(time24: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

export function calculateAttendance(
  dutyType: DutyType | { id: string; name: string; expected_duration_minutes: number; is_working_day: boolean },
  inTime: string,
  outTime: string
): AttendanceCalculationResult {
  const isDayOff = dutyType.id === 'day_off' || (!dutyType.is_working_day && dutyType.expected_duration_minutes === 0);

  if (isDayOff) {
    return {
      actual_duration_minutes: 0,
      expected_duration_minutes: 0,
      extra_duration_minutes: 0,
      short_duration_minutes: 0,
      difference_minutes: 0,
      status: 'day_off',
      formatted_actual: '0h 00m',
      formatted_expected: '0h 00m',
      formatted_diff: '0h 00m',
    };
  }

  const inMins = parseTimeToMinutes(inTime);
  const outMins = parseTimeToMinutes(outTime);

  if (inMins === null || outMins === null) {
    const expected = dutyType.expected_duration_minutes || 0;
    return {
      actual_duration_minutes: 0,
      expected_duration_minutes: expected,
      extra_duration_minutes: 0,
      short_duration_minutes: expected,
      difference_minutes: -expected,
      status: expected > 0 ? 'short' : 'normal',
      formatted_actual: '0h 00m',
      formatted_expected: formatMinutesToHM(expected),
      formatted_diff: formatMinutesToHM(-expected),
    };
  }

  // Handle midnight crossing:
  // If out time is less than in time, duty crossed midnight (e.g. 22:00 to 07:00)
  let actualDuration = outMins - inMins;
  if (actualDuration < 0) {
    actualDuration += 24 * 60; // add 1440 minutes for next day
  }

  const expectedDuration = dutyType.expected_duration_minutes || 0;
  const difference = actualDuration - expectedDuration;

  let extraDuration = 0;
  let shortDuration = 0;
  let status: AttendanceStatus = 'normal';

  if (difference > 0) {
    extraDuration = difference;
    status = 'extra';
  } else if (difference < 0) {
    shortDuration = Math.abs(difference);
    status = 'short';
  } else {
    status = 'normal';
  }

  return {
    actual_duration_minutes: actualDuration,
    expected_duration_minutes: expectedDuration,
    extra_duration_minutes: extraDuration,
    short_duration_minutes: shortDuration,
    difference_minutes: difference,
    status,
    formatted_actual: formatMinutesToHM(actualDuration),
    formatted_expected: formatMinutesToHM(expectedDuration),
    formatted_diff: (difference > 0 ? '+' : '') + formatMinutesToHM(difference),
  };
}

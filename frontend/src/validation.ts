export function validateCommon(eventDate: string, odometer?: string, liters?: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return 'Enter a valid date.';
  if (odometer !== undefined && (!/^\d+$/.test(odometer) || Number(odometer) > 9_999_999)) {
    return 'Enter an odometer value from 0 to 9,999,999.';
  }
  if (liters !== undefined && (!/^\d+(?:\.\d{1,3})?$/.test(liters) || Number(liters) <= 0)) {
    return 'Enter liters with up to three decimal places.';
  }
  return undefined;
}

export const isHuf = (value: string) => /^\d+$/.test(value);

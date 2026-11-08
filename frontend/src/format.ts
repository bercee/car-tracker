export const today = () => new Date().toLocaleDateString('en-CA');

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));

export const formatMoney = (value: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(value);

export const formatLiters = (value: number) => `${value.toFixed(3)} L`;

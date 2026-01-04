import currency from 'currency.js';
import { addSeconds } from 'date-fns';
// import * as currency from 'currency.js';

export function generateRandomNumber(size = 10) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < size; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

export function isNumber(value: number) {
  if (isNaN(value)) return false;
  return true;
}

export function bigIntToString(newvalue: any) {
  return JSON.stringify(
    newvalue,
    (key, value) => (typeof value === 'bigint' ? value.toString() : value), // return everything else unchanged
  );
}

export function convertExpiresInToUnixTime(expiresIn: string): number {
  const timeUnit = expiresIn.slice(-1).toLowerCase(); // Extract time unit (e.g., "d" for days)
  const timeValue = Number(expiresIn.slice(0, -1)); // Extract numeric value (e.g., 7 for 7 days)

  let time: Date;
  switch (timeUnit) {
    case 's':
      time = addSeconds(new Date(), timeValue * 1);
      break;
    case 'm':
      time = addSeconds(new Date(), timeValue * 60);
      break;
    case 'h':
      time = addSeconds(new Date(), timeValue * 60 * 60);
      break;
    case 'd':
      time = addSeconds(new Date(), timeValue * 60 * 60 * 24);
      break;
    default:
      throw new Error(`Invalid expiresIn time unit: ${timeUnit}`);
  }

  return time.getTime();
}

export function getCurrencySymbol(currency?: string, locale?: string) {
  // return new Intl.NumberFormat(locale, { style: 'currency', currency })
  //   .formatToParts(1)
  //   .find((x) => x.type === 'currency').value;

  return (0)
    .toLocaleString(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/\d/g, '')
    .trim();
}

// export function convertCreditToAmount(credit: number, baseCredit = 1) {
//   return currencyjs(credit).divide(baseCredit).value;
// }

export function convertCreditToAmount(credit: number, amountPerCredit = 0) {
  return currencyjs(amountPerCredit).multiply(credit).value;
}

// export function reverseAmountToCredit(amount: number, baseCredit = 1) {
//   return currencyjs(amount).multiply(baseCredit).value;
// }

export function reverseAmountToCredit(amount: number, amountPerCredit = 0) {
  return currencyjs(amount).divide(amountPerCredit).value;
}

export function exchangeAmount(amount: number, rate = 1) {
  return currencyjs(amount).multiply(rate).value;
}

export function reverseExchangeAmount(amount: number, rate = 1) {
  return currencyjs(amount).divide(rate).value;
}

export function formatAmount(amount: number, codeOrSymbol?: string) {
  return currencyjs(amount ?? 0, {
    symbol: getCurrencySymbol(codeOrSymbol) ?? codeOrSymbol,
  }).format();
}

export function currencyjs(value: currency.Any, opts?: currency.Options) {
  return currency(value, { precision: 3, ...opts });
}

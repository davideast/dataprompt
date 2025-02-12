import Handlebars from 'handlebars';
const { SafeString } = Handlebars;
import { addDays, addHours, addMinutes, addSeconds, format, subDays, subHours, subMinutes, subSeconds } from 'date-fns';

function dateFormatHelper(this: any, value: string, options: Handlebars.HelperOptions): Handlebars.SafeString {
  const now = new Date();
  const defaultFormat = 'yyyy-MM-dd';
  const formatStr = options.hash.format || defaultFormat;

  // Handle specific date commands
  switch (value) {
    case 'today':
      return new SafeString(format(now, formatStr));
    case 'yesterday':
      return new SafeString(format(subDays(now, 1), formatStr));
  }

  // Handle relative dates with multiple units
  const match = value.match(/^(-?\d+)\s*(days?|hours?|minutes?|seconds?)$/);
  if (match) {
    const amount = parseInt(match[1], 10);
    // Remove trailing 's'
    const unit = match[2].toLowerCase().replace(/s$/, '');
    let date = now;

    if (amount >= 0) {
      switch (unit) {
        case 'day':
          date = addDays(now, amount);
          break;
        case 'hour':
          date = addHours(now, amount);
          break;
        case 'minute':
          date = addMinutes(now, amount);
          break;
        case 'second':
          date = addSeconds(now, amount);
          break;
      }
    } else {
      const absAmount = Math.abs(amount);
      switch (unit) {
        case 'day':
          date = subDays(now, absAmount);
          break;
        case 'hour':
          date = subHours(now, absAmount);
          break;
        case 'minute':
          date = subMinutes(now, absAmount);
          break;
        case 'second':
          date = subSeconds(now, absAmount);
          break;
      }
    }

    return new SafeString(format(date, formatStr));
  }

  // Default to current date if no valid value
  return new SafeString(format(now, formatStr));
}

export const dateFormat = dateFormatHelper;

export function cast(str?: string) {
  return str === 'null'
    ? null
    : str === 'undefined'
      ? undefined
      : str === "'null'" || str === '"null"'
        ? 'null'
        : str === 'true'
          ? true
          : str === 'false'
            ? false
            : !isNaN(Number(str))
              ? Number(str)
              : str;
}

export function isJson(str?: string) {
  if (str && typeof str === 'string') {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {}
  }
  return false;
}

export function escapeRegExp(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function generateRandomPassword() {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).toUpperCase().slice(2)
  );
}

export function slugify(str: string) {
  return String(str)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-'); // remove consecutive hyphens
}

export const normalizeString = (value: string) => value?.trim().toLowerCase();

export function generateRadomKeys(length: number) {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export const isValidUrl = (urlString: string) => {
  try {
    return Boolean(new URL(urlString));
  } catch (e) {
    return false;
  }
};

export function extractNameAndEmail(emailFrom: string) {
  const regex = /([^<]+)\s*<([^>]+)>/;
  const match = emailFrom.match(regex);

  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim(),
    };
  } else {
    return null;
  }
}

export function extractStringInsideBrackets(str: string) {
  const regex = /\[([^\]]+)\]/; // Regular expression to match any character except a closing bracket inside brackets
  const match = str.match(regex);
  if (match) {
    return match[1]; // Return the first captured group (the string inside the brackets)
  } else {
    return null; // Return null if no match is found
  }
}

export function generateRandomWords(length: number) {
  const words = [
    'apple',
    'banana',
    'cherry',
    'date',
    'elderberry',
    'fig',
    'grape',
    'honeydew',
    'indigo',
    'jackfruit',
    'kiwi',
    'lemon',
    'mango',
    'nectarine',
    'orange',
    'pear',
    'quince',
    'raspberry',
    'strawberry',
    'tangelo',
    'ugli',
    'vanilla',
    'watermelon',
    'xigua',
    'yellowberry',
    'zucchini',
    'abyss',
    'azure',
    'bliss',
    'coral',
    'dawn',
    'emerald',
    'fuchsia',
    'golden',
    'helix',
    'indigo',
    'jade',
    'kiwi',
    'lavender',
    'mauve',
    'neon',
    'olive',
    'pearl',
    'quartz',
    'rose',
    'sapphire',
    'turquoise',
    'ultraviolet',
    'violet',
    'whisper',
    'xenon',
    'yellow',
    'zenith',
  ];

  const randomWords = [] as string[];
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    randomWords.push(words[randomIndex]);
  }

  return randomWords.join(' ');
}

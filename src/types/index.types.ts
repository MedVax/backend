import { isNumberString } from 'class-validator';

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export const getPaginationParams = (
  pageString: string,
  limitString: string,
) => {
  const page = isNumberString(pageString) ? Number(pageString) : 1;
  const limit = isNumberString(limitString) ? Number(limitString) : 20;

  const params = {
    take: limit,
    offset: page > 1 ? (page - 1) * limit : 0,
    page,
    limit,
  };

  return params;
};

export const getPageCount = (
  totalCount: number,
  itemsPerPage: number | string,
) => {
  return Math.ceil(totalCount / Number(itemsPerPage));
};

export type PaginationParams = {
  limit?: string;
  page?: string;
  search?: string;
};

export type PaginationResult<T = any> = {
  results: T[];
  count: number;
  currentPage?: number | string;
  pageCount?: number;
};

export const capitalizeSentence = (sentence: string) => {
  if (!sentence) {
    return sentence;
  }
  const words = sentence?.split(' ');

  return words
    .map((word) => {
      return word[0]?.toUpperCase() + word.substring(1);
    })
    .join(' ');
};

export function capitalizeSentences(text: string) {
  if (text === null || text === undefined || typeof text !== 'string') {
    return text;
  }

  const sentences = text.split(/\. |\? |\! /);

  const capitalizedSentences = sentences
    .filter((sentence) => sentence.trim() !== '') // Remove empty sentences
    .map((sentence) => {
      if (sentence === sentence.toUpperCase()) {
        return sentence;
      } else {
        return sentence.charAt(0).toUpperCase() + sentence.slice(1);
      }
    })
    .join('. ');

  return capitalizedSentences;
}

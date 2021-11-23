import parse from 'html-react-parser';

export const stringToSlug = (dataString: string, slugString = '') => {
  return dataString.toLowerCase().replace(/ /g, slugString);
};

/**
 * Convert a template string into HTML DOM nodes
 * Same as React.createElement(type, options, children)
 * @param  {String} str The template string
 * @return {Node}       The template HTML
 */
export const stringToHTML = function (
  strHTML: string
): string | JSX.Element | JSX.Element[] {
  return strHTML ? parse(strHTML) : strHTML;
};

/**
 * Convert a template string into rendered HTML DOM
 * @param  {String} str The template string
 * @return {BodyNode}   The rendered template HTML
 */
export const stringToDOMElement = function (strHTML: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(strHTML, 'text/html');

  return doc.body;
};

export const ordinalize = (num: number): string => {
  const mod10 = num % 10;
  const mod100 = num % 100;
  let ordinalSuffix: string;

  if (mod10 === 1 && mod100 !== 11) {
    ordinalSuffix = 'st';
  } else if (mod10 === 2 && mod100 !== 12) {
    ordinalSuffix = 'nd';
  } else if (mod10 === 3 && mod100 !== 13) {
    ordinalSuffix = 'rd';
  } else {
    ordinalSuffix = 'th';
  }

  return num + ordinalSuffix;
};

export const getJSONFromString = (data: string): string | null => {
  try {
    // Format string if possible and return valid JSON
    return JSON.parse(data);
  } catch (e) {
    // Invalid JSON, return null
    return null;
  }
};

export const isValidJSONString = (data?: string): boolean => {
  if (data) {
    return Boolean(getJSONFromString(data));
  }

  return false;
};

export const bytesToSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) {
    return `${bytes} ${sizes[0]}`;
  } else {
    const i = parseInt(
      Math.floor(Math.log(bytes) / Math.log(1024)).toString(),
      10
    );
    if (i === 0) {
      return `${bytes} ${sizes[i]}`;
    } else {
      return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
    }
  }
};

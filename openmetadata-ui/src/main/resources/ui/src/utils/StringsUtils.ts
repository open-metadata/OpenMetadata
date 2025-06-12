/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { AxiosError } from 'axios';
import parse from 'html-react-parser';
import { get, isString } from 'lodash';

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
  } else if (bytes < 0) {
    return `N/A`;
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

/**
 * Checks the value and return error text
 * @param value - The value to check
 * @param fallbackText
 * @returns Returns the error text
 */
export const getErrorText = (
  value: AxiosError | string,
  fallbackText: string
): string => {
  let errorText;
  if (isString(value)) {
    return value;
  } else if (value) {
    errorText = get(value, 'response.data.message', '');
    if (!errorText) {
      // if error text is undefined or null or empty, try responseMessage in data
      errorText = get(value, 'response.data.responseMessage', '');
    }
    if (!errorText) {
      errorText = get(value, 'response.data', '');
      errorText = typeof errorText === 'string' ? errorText : null;
    }
  }

  // if error text is still empty, return the fallback text
  return errorText || fallbackText;
};

/**
 *
 * @param fqn - Value to be encoded
 * @returns - Encoded text string as a valid component of a Uniform Resource Identifier (URI).
 */
export const getEncodedFqn = (fqn: string, spaceAsPlus = false) => {
  let uri = encodeURIComponent(fqn);

  if (spaceAsPlus) {
    uri = uri.replaceAll('%20', '+');
  }

  return uri;
};

/**
 *
 * @param fqn - Value to be encoded
 * @returns - Decode text string as a valid component of a Uniform Resource Identifier (URI).
 */
export const getDecodedFqn = (fqn: string, plusAsSpace = false) => {
  let uri = decodeURIComponent(fqn);

  if (plusAsSpace) {
    uri = uri.replaceAll('+', ' ');
  }

  return uri;
};

/**
 *
 * @param url - Url to be check
 * @returns - True if url is external otherwise false
 */
export const isExternalUrl = (url = '') => {
  return /^https?:\/\//.test(url);
};

/**
 *
 * @param a compare value one
 * @param b compare value two
 * @returns sorted array (A-Z) which will have custom value at last
 */
export const customServiceComparator = (a: string, b: string): number => {
  if (a.includes('Custom') || b.includes('Custom')) {
    return a.includes('Custom') ? 1 : -1;
  } else {
    return a.localeCompare(b);
  }
};

/**
 *
 * @param fqn - Value to be encoded
 * @returns - String text replacing + to valid component of a Uniform Resource Identifier (URI).
 */
export const replacePlus = (fqn: string) => fqn.replaceAll('+', ' ');

/**
 * @description Format JSON string to a readable format
 * if the JSON string is invalid, return the original JSON string
 * @param jsonString - JSON string to format
 * @param indent - Indentation string
 * @returns Formatted JSON string
 * @example formatJsonString('{"key1": "value1", "key2": "value2"}') => '[key1]: value1\n[key2]: value2\n'
 */
export const formatJsonString = (jsonString: string, indent = '') => {
  try {
    let formattedJson = '';
    const jsonObj = JSON.parse(jsonString);

    for (const [key, value] of Object.entries(jsonObj)) {
      if (typeof value === 'object' && value !== null) {
        formattedJson += `${indent}[${key}]:\n`;
        // Recursively format nested objects
        formattedJson += formatJsonString(JSON.stringify(value), indent + '  ');
      } else {
        formattedJson += `${indent}[${key}]: ${value}\n`;
      }
    }

    return formattedJson;
  } catch (error) {
    // Return the original JSON string if parsing fails
    return jsonString;
  }
};

export const replaceCallback = (character: string) => {
  // Generate a random number between 0 and 15
  const randomNumber = (Math.random() * 16) | 0;

  // If the character in the UUID template is 'x', use the random number.
  // Otherwise, use the random number ANDed with 0x3 (which gives a number between 0 and 3) ORed with 0x8
  // (which sets the high bit, ensuring a number between 8 and 11).
  const uuidCharacter =
    character === 'x' ? randomNumber : (randomNumber & 0x3) | 0x8;

  // Convert the number to a hexadecimal string and return it
  return uuidCharacter.toString(16);
};

/**
 * @description Generate a UUID (Universally Unique Identifier)
 * @returns A UUID string
 */
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    replaceCallback
  );
};

type JSONRecord = Record<string, string | number | boolean>;
type HeaderMap = {
  field: string;
  title: string;
};

export const jsonToCSV = <T extends JSONRecord>(
  jsonArray: T[],
  headers: HeaderMap[]
): string => {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
    return '';
  }

  // Check if headers array is empty
  if (headers.length === 0) {
    return '';
  }

  // Create the header row from headers mapping
  const headerRow = headers.map((h) => h.title);
  const csvRows: string[] = [headerRow.join(',')];

  // Convert each JSON object to a CSV row
  jsonArray.forEach((obj) => {
    const row = headers
      .map((header) => {
        const value = obj[header.field];
        if (!value) {
          return '""';
        }
        const escaped =
          typeof value === 'string'
            ? value.replace(/"/g, '\\"')
            : value.toString(); // handle quotes in content

        return `"${escaped}"`; // wrap each field in quotes
      })
      .join(',');
    csvRows.push(row);
  });

  // Combine all CSV rows and add newline character to form final CSV string
  return csvRows.join('\n');
};

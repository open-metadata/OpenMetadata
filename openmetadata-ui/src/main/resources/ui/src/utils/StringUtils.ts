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

import { VALIDATE_ESCAPE_START_END_REGEX } from '../constants/regex.constants';

export const pluralize = (count: number, noun: string, suffix = 's') => {
  const countString = count.toLocaleString();
  if (count !== 1 && count !== 0 && !noun.endsWith(suffix)) {
    return `${countString} ${noun}${suffix}`;
  } else {
    if (noun.endsWith(suffix)) {
      return `${countString} ${
        count > 1 ? noun : noun.slice(0, noun.length - 1)
      }`;
    } else {
      return `${countString} ${noun}${count > 1 ? suffix : ''}`;
    }
  }
};

export const replaceSpaceWith_ = (text: string) => {
  return text.replace(/\s/g, '_');
};

export const replaceAllSpacialCharWith_ = (text: string) => {
  return text.replaceAll(/[&/\\#, +()$~%.'":*?<>{}]/g, '_');
};

export const getTrimmedContent = (content: string, limit: number) => {
  const lines = content.split('\n');
  // Selecting the content in three lines
  const contentInThreeLines = lines.slice(0, 3).join('\n');

  const slicedContent = contentInThreeLines.slice(0, limit);

  // Logic for eliminating any broken words at the end
  // To avoid any URL being cut
  const words = slicedContent.split(' ');
  const wordsCount = words.length;

  if (wordsCount === 1) {
    // In case of only one word (possibly too long URL)
    // return the whole word instead of trimming
    return content.split(' ')[0];
  }

  // Eliminate word at the end to avoid using broken words
  const refinedContent = words.slice(0, wordsCount - 1);

  return refinedContent.join(' ');
};

export const removeOuterEscapes = (input: string) => {
  // Use regex to check if the string starts and ends with escape characters
  const match = input.match(VALIDATE_ESCAPE_START_END_REGEX);

  // Return the middle part without the outer escape characters or the original input if no match
  return match && match.length > 3 ? match[2] : input;
};

/**
 * @param text plain text
 * @returns base64 encoded text
 */
export const getBase64EncodedString = (text: string): string => btoa(text);

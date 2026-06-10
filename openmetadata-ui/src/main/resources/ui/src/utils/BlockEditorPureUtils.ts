/*
 *  Copyright 2026 Collate.
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

import { isEmpty } from 'lodash';

/**
 * Checks whether a block-editor HTML string represents empty content.
 * Treats null/undefined/empty strings, whitespace-only strings, and
 * single empty `<p>` tags as empty.
 */
export const isDescriptionContentEmpty = (content: string) => {
  if (isEmpty(content)) {
    return true;
  }

  const trimmedContent = content.trim();

  if (trimmedContent === '') {
    return true;
  }

  const emptyPRegex =
    /^[ \t\r\n]*<p(?:\s[^>]*)?>[ \t\r\n\u00A0]*<\/p>[ \t\r\n]*$/i;

  return emptyPRegex.test(trimmedContent);
};

/**
 * Strips all HTML tags from a string and returns plain text.
 */
export const getTextFromHtmlString = (description?: string): string => {
  if (!description) {
    return '';
  }

  return description.replace(/<[^>]{1,1000}>/g, '').trim();
};

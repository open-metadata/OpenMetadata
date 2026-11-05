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
import DOMPurify from 'dompurify';
import parse from 'html-react-parser';
import removeMarkdown from 'remove-markdown';

/**
 * Convert a template string into HTML DOM nodes.
 * Input is sanitized with DOMPurify before being parsed to prevent stored
 * XSS from stored user content (e.g. entity name/displayName) — see
 * GHSA-59gm-6h39-397f. DOMPurify's default profile preserves the benign
 * markup callers rely on (<span class>, <mark>, <em>, <ins>, <del>) while
 * stripping <iframe>, <script>, event handler attributes, and
 * javascript:/data: URLs.
 */
export const stringToHTML = function (
  strHTML: string
): string | JSX.Element | JSX.Element[] {
  return strHTML ? parse(DOMPurify.sanitize(strHTML)) : strHTML;
};

/**
 * Decode HTML entities (e.g. "&amp;", "&#98;") into their literal characters.
 * Uses DOMParser in text mode so embedded markup is never executed, only
 * read back as plain text.
 */
export function decodeHtmlEntities(text: string): string {
  const doc = new DOMParser().parseFromString(text, 'text/html');

  return doc.documentElement.textContent ?? text;
}

// Block editor descriptions are stored as HTML, and remove-markdown drops tags
// with nothing in their place - without this, `<p>a</p><p>b</p>` reads as "ab".
const HTML_BLOCK_BOUNDARY =
  /<\/?(?:p|div|li|ul|ol|h[1-6]|br|tr|td|th|blockquote|pre)\b[^>]*>/gi;

export function stripMarkdown(text: string): string {
  return decodeHtmlEntities(
    removeMarkdown(text.replace(HTML_BLOCK_BOUNDARY, ' '))
  )
    .replace(/\s+/g, ' ')
    .trim();
}

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
import { ENTITY_URL_MAP } from '../constants/Feeds.constants';
import {
  getEntityDetail,
  getHashTagList,
  getMentionList,
} from './FeedUtilsPure';
import { getSanitizeContent } from './sanitize.utils';

export const convertMarkdownFormatToHtmlString = (markdown: string) => {
  let updatedMessage = markdown;
  const urlEntries = Object.entries(ENTITY_URL_MAP);

  const mentionList = getMentionList(markdown) ?? [];
  const hashTagList = getHashTagList(markdown) ?? [];

  const mentionMap = new Map<string, RegExpMatchArray | null>(
    mentionList.map((mention) => [mention, getEntityDetail(mention)])
  );

  const hashTagMap = new Map<string, RegExpMatchArray | null>(
    hashTagList.map((hashTag) => [hashTag, getEntityDetail(hashTag)])
  );

  [...mentionMap.entries()]
    .sort(([leftKey], [rightKey]) => rightKey.length - leftKey.length)
    .forEach(([key, value]) => {
      if (value) {
        const [, href, rawEntityType, fqn] = value;
        const entityType = urlEntries.find((e) => e[1] === rawEntityType)?.[0];

        if (entityType) {
          const entityLink = `<a href="${href}/${rawEntityType}/${fqn}" data-type="mention" data-entityType="${entityType}" data-fqn="${fqn}" data-label="${fqn}">@${fqn}</a>`;
          updatedMessage = updatedMessage.replaceAll(key, () => entityLink);
        }
      }
    });

  [...hashTagMap.entries()]
    .sort(([leftKey], [rightKey]) => rightKey.length - leftKey.length)
    .forEach(([key, value]) => {
      if (value) {
        const [, href, rawEntityType, fqn] = value;

        const entityLink = `<a href="${href}/${rawEntityType}/${fqn}" data-type="hashtag" data-entityType="${rawEntityType}" data-fqn="${fqn}" data-label="${fqn}">#${fqn}</a>`;
        updatedMessage = updatedMessage.replaceAll(key, () => entityLink);
      }
    });

  return updatedMessage;
};

// Lists and tables are structural markup the markdown converter cannot round
// trip: Showdown hashes such markup as inline spans and its unhash pass gives
// up after 10 levels of nesting, leaking `\u00a8C<n>C` placeholders into the
// rendered output. Content carrying one is always treated as HTML.
const STRUCTURAL_HTML_SELECTOR = 'ul, ol, table';

// A fenced block or a code span holds a literal example. `DOMParser` has no
// notion of either, so `<table>…` written inside one parses into a real
// element — dropping these regions first keeps a code sample from being read
// as rendered content.
const MARKDOWN_CODE_REGION = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g;

// Markdown's third code form: a line indented by four spaces or a tab, opening
// after a blank line or at the start of the document.
const INDENTED_CODE_LINE = /^(?: {4}|\t)/;

/**
 * Blanks out every markdown code region — fenced blocks, code spans, and
 * four-space-indented blocks — leaving the surrounding text in place.
 *
 * An indented block runs from its opening line until a line that is neither
 * indented nor blank, which is why this is a line walk rather than one regex.
 */
const stripMarkdownCodeRegions = (content: string) => {
  let isInIndentedBlock = false;
  let previousLineWasBlank = true;

  return content
    .replace(MARKDOWN_CODE_REGION, '')
    .split('\n')
    .map((line) => {
      const isBlank = line.trim() === '';
      const isIndented = INDENTED_CODE_LINE.test(line);

      isInIndentedBlock = isInIndentedBlock
        ? isIndented || isBlank
        : previousLineWasBlank && isIndented;
      previousLineWasBlank = isBlank;

      return isInIndentedBlock ? '' : line;
    })
    .join('\n');
};

export const isHTMLString = (content: string) => {
  const commonHtmlTags =
    /<(p|div|span|a|ul|ol|li|table|h[1-6]|br|strong|em|code|pre)[>\s]/i;

  if (!commonHtmlTags.test(content)) {
    return false;
  }

  try {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(content, 'text/html');

    const outsideCodeRegions = parser.parseFromString(
      stripMarkdownCodeRegions(content),
      'text/html'
    );

    // Bare text between the markup is what makes a document markdown prose.
    // Serialized editor output has none, and its indentation is pretty
    // printing rather than a code block — so only prose is read with code
    // regions removed. Reading serialized HTML that way would discard its own
    // markup and hand it back to the converter, which is the corruption this
    // whole guard exists to prevent.
    const hasProseAroundMarkup = Array.from(
      parsedDocument.body.childNodes
    ).some(
      (node) =>
        node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
    );

    const renderedMarkup = hasProseAroundMarkup
      ? outsideCodeRegions
      : parsedDocument;

    const hasHtmlElements = Array.from(renderedMarkup.body.childNodes).some(
      (node) => node.nodeType === Node.ELEMENT_NODE
    );

    if (
      hasHtmlElements &&
      outsideCodeRegions.body.querySelector(STRUCTURAL_HTML_SELECTOR)
    ) {
      return true;
    }

    const markdownPatterns = [
      /^#{1,6}\s/,
      /^\s*[-*+]\s/,
      /^\s*\d+\.\s/,
      /^\s*>{1,}\s/,
      /^---|\*\*\*|___/,
      /`{1,3}[^`]+`{1,3}/,
      /(\*\*)[^*]+(\*\*)|(__)[^_]+(__)/,
    ];

    // Match against the rendered text, not the markup: tag names and
    // attribute values (`__`, `*`, backticks in a URL) are not markdown and
    // must not push already-rendered HTML down the converter path.
    const textContent = parsedDocument.body.textContent ?? '';

    const hasMarkdownSyntax = markdownPatterns.some((pattern) =>
      pattern.test(textContent)
    );

    return hasHtmlElements && !hasMarkdownSyntax;
  } catch {
    return false;
  }
};

export const formatClientContent = (htmlString: string) => {
  const parser = new DOMParser();
  const processedContent = isHTMLString(htmlString)
    ? htmlString
    : convertMarkdownFormatToHtmlString(htmlString);

  const doc = parser.parseFromString(processedContent, 'text/html');

  const anchorTags = doc.querySelectorAll(
    'a[data-type="mention"], a[data-type="hashtag"]'
  );

  anchorTags.forEach((tag) => {
    const label = tag.getAttribute('data-label');
    const type = tag.getAttribute('data-type');
    const prefix = type === 'mention' ? '@' : '#';

    tag.textContent = `${prefix}${label}`;
  });

  return getSanitizeContent(doc.body.innerHTML);
};

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

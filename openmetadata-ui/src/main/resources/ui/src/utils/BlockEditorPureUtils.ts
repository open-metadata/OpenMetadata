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

export const isHTMLString = (content: string) => {
  const commonHtmlTags =
    /<(p|div|span|a|ul|ol|li|h[1-6]|br|strong|em|code|pre)[>\s]/i;

  if (!commonHtmlTags.test(content)) {
    return false;
  }

  try {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(content, 'text/html');

    const hasHtmlElements = Array.from(parsedDocument.body.childNodes).some(
      (node) => node.nodeType === Node.ELEMENT_NODE
    );

    const markdownPatterns = [
      /^#{1,6}\s/,
      /^\s*[-*+]\s/,
      /^\s*\d+\.\s/,
      /^\s*>{1,}\s/,
      /^---|\*\*\*|___/,
      /`{1,3}[^`]+`{1,3}/,
      /(\*\*)[^*]+(\*\*)|(__)[^_]+(__)/,
    ];

    const hasMarkdownSyntax = markdownPatterns.some((pattern) =>
      pattern.test(content)
    );

    return hasHtmlElements && !hasMarkdownSyntax;
  } catch {
    return false;
  }
};

const _convertMarkdownFormatToHtmlString = (markdown: string) => {
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

  mentionMap.forEach((value, key) => {
    if (value) {
      const [, href, rawEntityType, fqn] = value;
      const entityType = urlEntries.find((e) => e[1] === rawEntityType)?.[0];

      if (entityType) {
        const entityLink = `<a href="${href}/${rawEntityType}/${fqn}" data-type="mention" data-entityType="${entityType}" data-fqn="${fqn}" data-label="${fqn}">@${fqn}</a>`;
        updatedMessage = updatedMessage.replaceAll(key, entityLink);
      }
    }
  });

  hashTagMap.forEach((value, key) => {
    if (value) {
      const [, href, rawEntityType, fqn] = value;

      const entityLink = `<a href="${href}/${rawEntityType}/${fqn}" data-type="hashtag" data-entityType="${rawEntityType}" data-fqn="${fqn}" data-label="${fqn}">#${fqn}</a>`;
      updatedMessage = updatedMessage.replaceAll(key, entityLink);
    }
  });

  return updatedMessage;
};

export const formatContentForClient = (htmlString: string) => {
  const parser = new DOMParser();

  const processedContent = isHTMLString(htmlString)
    ? htmlString
    : _convertMarkdownFormatToHtmlString(htmlString);

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

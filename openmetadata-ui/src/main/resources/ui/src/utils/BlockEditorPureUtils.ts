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

import { findLastIndex, isEmpty, sumBy } from 'lodash';
import Showdown from 'showdown';
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

// Blockquote markers sit outside the indentation they quote, so they come off
// before a line is measured — `>     <table>` is an indented code block too.
const BLOCKQUOTE_MARKER = /^ {0,3}(?:> ?)+/;

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
      const quotedLine = line.replace(BLOCKQUOTE_MARKER, '');
      const isBlank = quotedLine.trim() === '';
      const isIndented = INDENTED_CODE_LINE.test(quotedLine);

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

    // Everything below reads this one view of the document. Deciding what
    // counts as an element from one view and what counts as a list from
    // another lets pretty-printed markup lose its own lists.
    const renderedMarkup = hasProseAroundMarkup
      ? parser.parseFromString(stripMarkdownCodeRegions(content), 'text/html')
      : parsedDocument;

    const hasHtmlElements = Array.from(renderedMarkup.body.childNodes).some(
      (node) => node.nodeType === Node.ELEMENT_NODE
    );

    if (
      hasHtmlElements &&
      renderedMarkup.body.querySelector(STRUCTURAL_HTML_SELECTOR)
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

const _convertMarkdownStringToHtmlString = new Showdown.Converter({
  ghCodeBlocks: true,
  encodeEmails: false,
  ellipsis: false,
  simplifiedAutoLink: true,
  tables: true,
  strikethrough: true,
  simpleLineBreaks: true,
  openLinksInNewWindow: true,
  emoji: true,
  underline: true,
});

/**
 * Converts a markdown string to an HTML string. Content that is already HTML
 * is returned untouched.
 */
export const getHtmlStringFromMarkdownString = (content: string) => {
  return isHTMLString(content)
    ? content
    : _convertMarkdownStringToHtmlString.makeHtml(content);
};

const MENTION_OR_HASHTAG_SELECTOR =
  'a[data-type="mention"], a[data-type="hashtag"]';

const PREVIEW_BLOCK_SELECTOR =
  'p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, tr';

const BLOCK_ELEMENT_SELECTOR = `${PREVIEW_BLOCK_SELECTOR}, ul, ol, table, thead, tbody, tfoot, th, td, div, hr`;

const MAX_PREVIEW_BLOCKS = 3;

export const formatClientContent = (content: string) => {
  const parser = new DOMParser();

  // Markdown must be rendered to HTML *before* it is parsed and sanitised.
  // Parsing markdown as HTML serialises bare `<` and `>` into entities, which
  // the downstream markdown renderer then escapes a second time, surfacing
  // `&gt;` to the user as literal text.
  const processedContent = isHTMLString(content)
    ? content
    : getHtmlStringFromMarkdownString(
        convertMarkdownFormatToHtmlString(content)
      );

  const doc = parser.parseFromString(processedContent, 'text/html');

  const anchorTags = doc.querySelectorAll(MENTION_OR_HASHTAG_SELECTOR);

  anchorTags.forEach((tag) => {
    const label = tag.getAttribute('data-label');
    const type = tag.getAttribute('data-type');
    const prefix = type === 'mention' ? '@' : '#';

    if (label) {
      tag.textContent = `${prefix}${label}`;
    }
  });

  return getSanitizeContent(doc.body.innerHTML);
};

const cutTextNode = (node: Text, remaining: number): Node => {
  const mentionOrHashtag = node.parentElement?.closest(
    MENTION_OR_HASHTAG_SELECTOR
  );

  if (mentionOrHashtag) {
    const ellipsis = node.ownerDocument.createTextNode('...');
    mentionOrHashtag.after(ellipsis);

    return ellipsis;
  }

  if (node.data.length === remaining) {
    node.data = `${node.data.trimEnd()}...`;

    return node;
  }

  const slicedText = node.data.slice(0, remaining);
  const lastSpaceIndex = slicedText.lastIndexOf(' ');
  node.data = `${
    lastSpaceIndex > 0 ? slicedText.slice(0, lastSpaceIndex) : slicedText
  }...`;

  return node;
};

const isBlockElement = (node: Node | null) =>
  node?.nodeType === Node.ELEMENT_NODE &&
  (node as Element).matches(BLOCK_ELEMENT_SELECTOR);

const isPreviewNode = (node: Node) => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node.nodeName === 'BR';
  }

  if (node.textContent?.trim()) {
    return true;
  }

  return (
    Boolean(node.parentElement?.closest(PREVIEW_BLOCK_SELECTOR)) &&
    !isBlockElement(node.previousSibling) &&
    !isBlockElement(node.nextSibling)
  );
};

const splitPreformattedLines = (body: HTMLElement) => {
  body.querySelectorAll('pre').forEach((pre) => {
    const walker = body.ownerDocument.createTreeWalker(
      pre,
      NodeFilter.SHOW_TEXT
    );

    for (
      let node = walker.nextNode() as Text | null;
      node;
      node = walker.nextNode() as Text | null
    ) {
      const lineEnd = node.data.indexOf('\n');

      if (lineEnd !== -1 && lineEnd < node.data.length - 1) {
        node.splitText(lineEnd + 1);
      }
    }
  });
};

const startsNewLine = (text: Text, previous: Text | null) =>
  Boolean(previous?.data.endsWith('\n') && text.parentElement?.closest('pre'));

const getPreviewNodes = (body: HTMLElement) => {
  splitPreformattedLines(body);

  const walker = body.ownerDocument.createTreeWalker(
    body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    (node) =>
      isPreviewNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
  );
  const nodes: Node[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node);
  }

  return nodes;
};

const getPreviewBlock = (text: Text) =>
  text.parentElement?.closest('tr') ??
  text.parentElement?.closest(PREVIEW_BLOCK_SELECTOR) ??
  null;

const isTrailingMentionOrHashtag = (text: Text, isLastText: boolean) =>
  isLastText &&
  Boolean(text.parentElement?.closest(MENTION_OR_HASHTAG_SELECTOR));

const reachesLimit = (text: Text, remaining: number, hasMoreText: boolean) =>
  text.data.length > remaining ||
  (text.data.length === remaining && hasMoreText);

const findPreviewCut = (nodes: Node[], limit: number) => {
  const lastTextIndex = findLastIndex(nodes, (node) =>
    Boolean(node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
  );
  let remaining = limit;
  let blockCount = 0;
  let currentBlock: Element | null | undefined;
  let previous: Text | null = null;

  for (const [index, node] of nodes.slice(0, lastTextIndex + 1).entries()) {
    if (node.nodeType !== Node.TEXT_NODE) {
      currentBlock = undefined;

      continue;
    }

    const text = node as Text;
    const block = getPreviewBlock(text);

    if (startsNewLine(text, previous)) {
      currentBlock = undefined;
    }

    if (block !== currentBlock) {
      currentBlock = block;
      blockCount++;
    }

    if (blockCount > MAX_PREVIEW_BLOCKS && previous) {
      return { node: previous, remaining: previous.data.length };
    }

    if (reachesLimit(text, remaining, index < lastTextIndex)) {
      return isTrailingMentionOrHashtag(text, index === lastTextIndex)
        ? undefined
        : { node: text, remaining };
    }

    remaining -= text.data.length;
    previous = text;
  }

  return undefined;
};

export const getTrimmedHtmlContent = (html: string, limit: number) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = getPreviewNodes(doc.body);
  const textLength = sumBy(nodes, (node) =>
    node.nodeType === Node.TEXT_NODE ? (node as Text).data.length : 0
  );

  if (textLength <= limit) {
    return html;
  }

  const cut = findPreviewCut(nodes, limit);

  if (!cut) {
    return html;
  }

  const range = doc.createRange();
  range.setStartAfter(cutTextNode(cut.node, cut.remaining));
  range.setEnd(doc.body, doc.body.childNodes.length);
  range.deleteContents();

  return doc.body.innerHTML;
};

/** Text, mentions and embedded media count as content; layout-only markup does not. */
export const isDescriptionContentEmpty = (content: string) => {
  if (isEmpty(content)) {
    return true;
  }

  const doc = new DOMParser().parseFromString(content, 'text/html');

  return (
    !doc.body.textContent?.trim() &&
    !doc.body.querySelector(
      'img, video, audio, iframe, hr, [data-type="mention"], [data-type="file-attachment"]'
    )
  );
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

export const stripPendingUploadNodes = (html: string): string => {
  if (!html.includes('data-uploading="true"')) {
    return html;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc
    .querySelectorAll<HTMLDivElement>(
      'div[data-type="file-attachment"][data-uploading="true"]'
    )
    .forEach((node) => {
      if (!node.dataset.url) {
        node.remove();
      }
    });

  return doc.body.innerHTML;
};

export const isInViewport = (ele: HTMLElement, container: HTMLElement) => {
  const eleTop = ele.offsetTop;
  const eleBottom = eleTop + ele.clientHeight;

  const containerTop = container.scrollTop;
  const containerBottom = containerTop + container.clientHeight;

  return eleTop >= containerTop && eleBottom <= containerBottom;
};

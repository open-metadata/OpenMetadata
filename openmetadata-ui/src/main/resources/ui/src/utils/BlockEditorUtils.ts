/*
 *  Copyright 2023 Collate.
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

import { EditorState } from '@tiptap/pm/state';
import { Editor } from '@tiptap/react';
import { isEmpty, isString } from 'lodash';
import Showdown from 'showdown';
import { ReactComponent as IconFormatAttachment } from '../assets/svg/ic-format-attachment.svg';
import { ReactComponent as IconFormatAudio } from '../assets/svg/ic-format-audio.svg';
import { ReactComponent as IconFormatImage } from '../assets/svg/ic-format-image.svg';
import { ReactComponent as IconFormatVideo } from '../assets/svg/ic-format-video.svg';
import { FileType } from '../components/BlockEditor/BlockEditor.interface';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { ENTITY_URL_MAP } from '../constants/Feeds.constants';
import { getEntityDetail, getHashTagList, getMentionList } from './FeedUtils';

export const getSelectedText = (state: EditorState) => {
  const { from, to } = state.selection;

  const text = state.doc.textBetween(from, to);

  return text;
};

export const isInViewport = (ele: HTMLElement, container: HTMLElement) => {
  const eleTop = ele.offsetTop;
  const eleBottom = eleTop + ele.clientHeight;

  const containerTop = container.scrollTop;
  const containerBottom = containerTop + container.clientHeight;

  // The element is fully visible in the container
  return eleTop >= containerTop && eleBottom <= containerBottom;
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

export type FormatContentFor = 'server' | 'client';

export const formatContent = (
  htmlString: string,
  formatFor: FormatContentFor
) => {
  // Create a new DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    _convertMarkdownFormatToHtmlString(htmlString),
    'text/html'
  );

  // Use querySelectorAll to find all anchor tags with text content starting with "@" or "#"
  const anchorTags = doc.querySelectorAll(
    'a[data-type="mention"], a[data-type="hashtag"]'
  );

  if (formatFor === 'server') {
    anchorTags.forEach((tag) => {
      const href = tag.getAttribute('href');
      const text = tag.textContent;
      const fqn = tag.getAttribute('data-fqn');
      const entityType = tag.getAttribute('data-entityType');

      const entityLink = `<#E${FQN_SEPARATOR_CHAR}${entityType}${FQN_SEPARATOR_CHAR}${fqn}|[${text}](${href})>`;
      tag.textContent = entityLink;
    });
  } else {
    anchorTags.forEach((tag) => {
      const label = tag.getAttribute('data-label');
      const type = tag.getAttribute('data-type');
      const prefix = type === 'mention' ? '@' : '#';

      tag.textContent = `${prefix}${label}`;
    });
  }
  const modifiedHtmlString = doc.body.innerHTML;

  return modifiedHtmlString;
};

export const formatValueBasedOnContent = (value: string) =>
  value === '<p></p>' ? '' : value;

export const isHTMLString = (content: string) => {
  // Quick check for common HTML tags
  const commonHtmlTags =
    /<(p|div|span|a|ul|ol|li|h[1-6]|br|strong|em|code|pre)[>\s]/i;

  // If content doesn't have any HTML-like structure, return false early
  if (!commonHtmlTags.test(content)) {
    return false;
  }

  try {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(content, 'text/html');

    // Check if there are any actual HTML elements (not just text nodes)
    const hasHtmlElements = Array.from(parsedDocument.body.childNodes).some(
      (node) => node.nodeType === Node.ELEMENT_NODE
    );

    // Check if the content has markdown-specific patterns
    const markdownPatterns = [
      /^#{1,6}\s/, // Headers
      /^\s*[-*+]\s/, // Lists
      /^\s*\d+\.\s/, // Numbered lists
      /^\s*>{1,}\s/, // Blockquotes
      /^---|\*\*\*|___/, // Horizontal rules
      /`{1,3}[^`]+`{1,3}/, // Code blocks
      /(\*\*)[^*]+(\*\*)|(__)[^_]+(__)/, // Bold/Strong text
    ];

    const hasMarkdownSyntax = markdownPatterns.some((pattern) =>
      pattern.test(content)
    );

    // If it has markdown syntax but also parsed as HTML, prefer markdown interpretation
    return hasHtmlElements && !hasMarkdownSyntax;
  } catch (e) {
    return false;
  }
};

/**
 * Convert a markdown string to an HTML string
 */
const _convertMarkdownStringToHtmlString = new Showdown.Converter({
  ghCodeBlocks: true,
  encodeEmails: false,
  ellipsis: false,
  tables: true,
  strikethrough: true,
  simpleLineBreaks: true,
  openLinksInNewWindow: true,
  emoji: true,
  underline: true,
  backslashEscapesHTMLTags: false, // Allow HTML tags to pass through
});

export const getHtmlStringFromMarkdownString = (content: string) => {
  // First, convert YouTube components to iframe format that YouTubeEmbed extension expects
  let processedContent = content;
  const youtubeRegex = /<YouTube\s+videoId=["']([^"']+)["']\s*\/?>/gi;
  processedContent = processedContent.replace(
    youtubeRegex,
    (_match, videoId) => {
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;

      return `<iframe src="${embedUrl}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
    }
  );

  // Convert markdown to HTML using Showdown
  const markdownHtml =
    _convertMarkdownStringToHtmlString.makeHtml(processedContent);

  return markdownHtml;
};

// Helper function to convert YouTube URLs to embed format
export const convertYouTubeUrlToEmbed = (url: string): string => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);

  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }

  return url;
};

// Helper function to check if a URL is a YouTube URL
export const isYouTubeUrl = (url: string): boolean => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
};

/**
 * Set the content of the editor
 * @param editor The editor instance
 * @param newContent The new content to set
 */
export const transformImgTagsToFileAttachment = (
  htmlString: string
): string => {
  // Input validation - ensure we have a valid string
  if (!htmlString || !isString(htmlString)) {
    return String(htmlString || '');
  }

  if (!htmlString.includes('<img')) {
    return htmlString;
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;

  const imgTags = tempDiv.querySelectorAll('img[src]');

  imgTags.forEach((img) => {
    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt') || '';
    const title = img.getAttribute('title') || '';

    if (src) {
      const fileDiv = document.createElement('div');
      fileDiv.setAttribute('data-type', 'file-attachment');
      fileDiv.setAttribute('data-url', src);
      fileDiv.setAttribute('data-filename', title || alt || 'image');
      fileDiv.setAttribute('data-mimetype', 'image');
      fileDiv.setAttribute('data-uploading', 'false');
      fileDiv.setAttribute('data-upload-progress', '0');
      fileDiv.setAttribute('data-is-image', 'true');
      if (alt) {
        fileDiv.setAttribute('data-alt', alt);
      }

      img.parentNode?.replaceChild(fileDiv, img);
    }
  });

  return tempDiv.innerHTML;
};

export const setEditorContent = (editor: Editor, newContent: string) => {
  // Convert the markdown string to an HTML string
  let htmlString = getHtmlStringFromMarkdownString(newContent);

  // Transform img tags to file-attachment divs before Tiptap processes them
  htmlString = transformImgTagsToFileAttachment(htmlString);

  editor.commands.setContent(htmlString);

  // Update the editor state to reflect the new content
  const newEditorState = EditorState.create({
    doc: editor.state.doc,
    plugins: editor.state.plugins,
    schema: editor.state.schema,
    selection: editor.state.selection,
    storedMarks: editor.state.storedMarks,
  });
  editor.view.updateState(newEditorState);
};

/**
 *
 * @param content The content to check
 * @returns Whether the content is empty or not
 */
export const isDescriptionContentEmpty = (content: string) => {
  // Check if the content is empty or has only empty paragraph tags
  return isEmpty(content) || content === '<p></p>';
};

/**
 *
 * @param description HTML string
 * @returns Text from HTML string
 */
export const getTextFromHtmlString = (description?: string): string => {
  if (!description) {
    return '';
  }

  return description.replace(/<[^>]{1,1000}>/g, '').trim();
};

export const getAcceptedFileTypes = (fileType: FileType) => {
  switch (fileType) {
    case FileType.IMAGE:
      return 'image/*';
    case FileType.VIDEO:
      return 'video/*';
    case FileType.AUDIO:
      return 'audio/*';
    case FileType.FILE:
    default:
      return '*/*';
  }
};

/**
 * Get the file type from the mime type
 * @param mimeType The mime type
 * @returns The file type
 */
export const getFileTypeFromMimeType = (mimeType: string) => {
  if (mimeType.startsWith(FileType.IMAGE)) {
    return FileType.IMAGE;
  }

  if (mimeType.startsWith(FileType.VIDEO)) {
    return FileType.VIDEO;
  }

  if (mimeType.startsWith(FileType.AUDIO)) {
    return FileType.AUDIO;
  }

  return FileType.FILE;
};

export const getFileIcon = (fileType: FileType) => {
  switch (fileType) {
    case FileType.IMAGE:
      return IconFormatImage;
    case FileType.VIDEO:
      return IconFormatVideo;
    case FileType.AUDIO:
      return IconFormatAudio;
    default:
      return IconFormatAttachment;
  }
};

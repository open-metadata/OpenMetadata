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
import type { Editor } from '@tiptap/react';
import { isString } from 'lodash';
import Showdown from 'showdown';
import { ReactComponent as IconFormatAttachment } from '../assets/svg/ic-format-attachment.svg';
import { ReactComponent as IconFormatAudio } from '../assets/svg/ic-format-audio.svg';
import { ReactComponent as IconFormatImage } from '../assets/svg/ic-format-image.svg';
import { ReactComponent as IconFormatVideo } from '../assets/svg/ic-format-video.svg';
import { FileType } from '../components/BlockEditor/BlockEditor.interface';
import blockEditorExtensionsClassBase from './BlockEditorExtensionsClassBase';
import {
  convertMarkdownFormatToHtmlString,
  isHTMLString,
} from './BlockEditorPureUtils';
import { ENTITY_LINK_SEPARATOR } from './EntityPureUtils';
import { getSanitizeContent } from './sanitize.utils';

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

// Unique marker prefix used to temporarily replace entity links during HTML serialization
// This avoids HTML encoding of < and > characters in entity links
const ENTITY_LINK_MARKER_PREFIX = '__ENTITY_LINK_MARKER_';

const escapeMarkdownLinkText = (text: string): string =>
  text.replace(/[[\]()\\]/g, '\\$&');

const sanitizeEntityLinkField = (value: string): string =>
  value.replace(/[<>|]/g, '');

export const formatContent = (htmlString: string) => {
  // Create a new DOMParser
  const parser = new DOMParser();

  // Only convert markdown to HTML if the content is not already HTML
  const processedContent = isHTMLString(htmlString)
    ? htmlString
    : convertMarkdownFormatToHtmlString(htmlString);

  const doc = parser.parseFromString(processedContent, 'text/html');

  // Use querySelectorAll to find all anchor tags with text content starting with "@" or "#"
  const anchorTags = doc.querySelectorAll(
    'a[data-type="mention"], a[data-type="hashtag"]'
  );

  // Store entity links with markers to avoid HTML encoding during serialization
  const entityLinkMap = new Map<string, string>();

  anchorTags.forEach((tag, index) => {
    const rawHref = tag.getAttribute('href');
    const text = tag.textContent;
    const fqn = tag.getAttribute('data-fqn');
    const entityType = tag.getAttribute('data-entityType');

    // Validate href to only allow safe protocols before embedding into entity link string.
    // This prevents unsafe URLs from bypassing DOMPurify via the post-sanitization replacement.
    const href =
      rawHref &&
      (rawHref.startsWith('http://') ||
        rawHref.startsWith('https://') ||
        rawHref.startsWith('/') ||
        rawHref.startsWith('#'))
        ? rawHref
        : '';

    const safeEntityType = sanitizeEntityLinkField(entityType ?? '');
    const safeFqn = sanitizeEntityLinkField(fqn ?? '');
    const safeText = escapeMarkdownLinkText(text ?? '');
    const entityLink = `<#E${ENTITY_LINK_SEPARATOR}${safeEntityType}${ENTITY_LINK_SEPARATOR}${safeFqn}|[${safeText}](${href})>`;
    const marker = `${ENTITY_LINK_MARKER_PREFIX}${index}__`;

    entityLinkMap.set(marker, entityLink);
    tag.textContent = marker;
  });

  let modifiedHtmlString = doc.body.innerHTML;

  modifiedHtmlString = getSanitizeContent(
    blockEditorExtensionsClassBase.serializeContentForBackend(
      modifiedHtmlString
    )
  );

  // Replace markers with actual entity links
  entityLinkMap.forEach((entityLink, marker) => {
    modifiedHtmlString = modifiedHtmlString.replace(marker, entityLink);
  });

  return modifiedHtmlString;
};

export const formatValueBasedOnContent = (value: string) =>
  value === '<p></p>' ? '' : value;

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
});

export const getHtmlStringFromMarkdownString = (content: string) => {
  return isHTMLString(content)
    ? content
    : _convertMarkdownStringToHtmlString.makeHtml(content);
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

  // Apply additional transformations from backend format
  htmlString =
    blockEditorExtensionsClassBase.parseContentFromBackend(htmlString);

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

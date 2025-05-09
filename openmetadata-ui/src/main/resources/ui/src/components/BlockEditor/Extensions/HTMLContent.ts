/*
 *  Copyright 2025 Collate.
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
import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/react';

export const HTMLContent = Node.create({
  name: 'htmlContent',

  group: 'block',

  content: 'inline*',

  parseHTML() {
    return [
      {
        tag: 'div[data-type="html-content"]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          const content = element.getAttribute('data-content') || '';

          return {
            content,
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const attrs = node.attrs;
    const baseAttrs = {
      'data-type': 'html-content',
      'data-content': attrs.content,
    };

    return ['div', mergeAttributes(this.options.HTMLAttributes, baseAttrs)];
  },

  addNodeView() {
    return ({ node }) => {
      const div = document.createElement('div');
      // Create a temporary div to parse the HTML content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = node.attrs.content;

      // Check for custom YouTube tag
      const youtubeTag = tempDiv.querySelector('youtube');
      if (youtubeTag) {
        const videoId = youtubeTag.getAttribute('videoId');
        const width = youtubeTag.getAttribute('width') || '800px';
        const height = youtubeTag.getAttribute('height') || '450px';
        const start = youtubeTag.getAttribute('start') || '0:00';
        const end = youtubeTag.getAttribute('end') || '';

        // Create iframe for YouTube video
        const iframe = document.createElement('iframe');
        iframe.setAttribute('width', width);
        iframe.setAttribute('height', height);
        iframe.setAttribute(
          'src',
          `https://www.youtube.com/embed/${videoId}?start=${start}&end=${end}`
        );
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute(
          'allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
        );
        iframe.setAttribute('allowfullscreen', '');
        div.appendChild(iframe);
      } else {
        // Check for iframe
        const iframe = tempDiv.querySelector('iframe');
        if (iframe) {
          // Create a new iframe element
          const newIframe = document.createElement('iframe');
          // Copy all attributes from the original iframe
          Array.from(iframe.attributes).forEach((attr) => {
            newIframe.setAttribute(attr.name, attr.value);
          });
          // Set the src attribute to allow the iframe to load
          newIframe.setAttribute('src', iframe.getAttribute('src') || '');
          // Add the iframe to the div
          div.appendChild(newIframe);
        } else {
          // For non-iframe content, just set the innerHTML
          div.innerHTML = node.attrs.content;
        }
      }

      return {
        dom: div,
      };
    };
  },
});

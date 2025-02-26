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
import { mergeAttributes, Node } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import i18n from '../../../../utils/i18next/LocalUtil';
import { bytesToSize } from '../../../../utils/StringsUtils';
import { FileType } from '../../BlockEditor.interface';
import { FileNodeAttrs, FileNodeOptions } from './FileNode.interface';
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFile: (attrs: FileNodeAttrs) => ReturnType;
    };
  }
}

const FileNode = Node.create<FileNodeOptions>({
  name: 'fileAttachment',
  group: 'block',
  atom: true,

  addOptions() {
    return {
      allowedTypes: [
        FileType.FILE,
        FileType.IMAGE,
        FileType.VIDEO,
        FileType.AUDIO,
      ],
    };
  },

  addAttributes() {
    return {
      url: { default: '' },
      fileName: { default: '' },
      fileSize: { default: null },
      mimeType: { default: '' },
      type: { default: FileType.FILE },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="file-attachment"]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          // For video/audio elements
          const mediaElement = element.querySelector('video, audio');
          if (mediaElement) {
            return {
              url: mediaElement.getAttribute('src') || '',
              fileName: mediaElement.getAttribute('alt') || '',
              mimeType:
                mediaElement instanceof HTMLVideoElement
                  ? 'video/mp4'
                  : 'audio/mpeg',
            };
          }

          // For files
          const link = element.querySelector('a');
          if (link) {
            return {
              url: link.getAttribute('href') || '',
              fileName: link.childNodes[0].textContent?.trim() || '',
              fileSize: link.querySelector('.file-size')?.textContent || '',
              mimeType: 'application/octet-stream',
            };
          }

          return false;
        },
      },
      {
        tag: 'img',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          return {
            url: element.getAttribute('src') || '',
            fileName: element.getAttribute('alt') || '',
            mimeType: 'image/jpeg',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as FileNodeAttrs;

    switch (true) {
      case attrs.mimeType.startsWith(FileType.IMAGE):
        return [
          'img',
          mergeAttributes({
            src: attrs.url,
            alt: attrs.fileName,
          }),
        ];
      case attrs.mimeType.startsWith(FileType.VIDEO):
        return [
          'div',
          mergeAttributes({
            'data-type': 'file-attachment',
            class: 'file-attachment file-type-video',
          }),
          [
            'video',
            {
              controls: 'true',
              src: attrs.url,
              preload: 'metadata',
              class: 'video-player',
            },
          ],
        ];
      case attrs.mimeType.startsWith(FileType.AUDIO):
        return [
          'div',
          mergeAttributes({
            'data-type': 'file-attachment',
            class: 'file-attachment file-type-audio',
          }),
          [
            'audio',
            {
              controls: 'true',
              src: attrs.url,
              preload: 'metadata',
              class: 'audio-player',
            },
          ],
        ];
      default:
        return [
          'div',
          mergeAttributes({
            'data-type': 'file-attachment',
            class: 'file-attachment file-type-file',
          }),
          [
            'a',
            {
              href: attrs.url,
              class: 'file-link',
              target: '_blank',
            },
            attrs.fileName,
            ['span', { class: 'file-size' }, attrs.fileSize ?? ''],
          ],
        ];
    }
  },

  addStorage() {
    return {
      renderFileContent(node: ProseMirrorNode) {
        const attrs = node.attrs as FileNodeAttrs;

        switch (true) {
          case attrs.mimeType.startsWith(FileType.IMAGE):
            return ['img', { src: attrs.url, alt: attrs.fileName }];
          case attrs.mimeType.startsWith(FileType.VIDEO):
            return [
              'div',
              { class: 'video-wrapper' },
              [
                'video',
                {
                  controls: true,
                  src: attrs.url,
                  preload: 'metadata',
                  class: 'video-player',
                },
                [
                  'p',
                  { class: 'video-fallback' },
                  i18n.t('message.video-playback-not-supported'),
                ],
              ],
            ];
          case attrs.mimeType.startsWith(FileType.AUDIO):
            return [
              'div',
              { class: 'audio-wrapper' },
              [
                'audio',
                {
                  controls: true,
                  src: attrs.url,
                  preload: 'metadata',
                  class: 'audio-player',
                },
                [
                  'p',
                  { class: 'audio-fallback' },
                  i18n.t('message.audio-playback-not-supported'),
                ],
              ],
            ];
          default:
            return [
              'div',
              { class: 'file-link-wrapper' },
              [
                'a',
                {
                  href: attrs.url,
                  class: 'file-link',
                  target: '_blank',
                },
                [
                  'span',
                  { class: 'file-name' },
                  attrs.fileName,
                  [
                    'span',
                    { class: 'file-size' },
                    attrs.fileSize ? `(${bytesToSize(attrs.fileSize)})` : '',
                  ],
                ],
              ],
            ];
        }
      },
    };
  },

  addCommands() {
    return {
      setFile:
        (attrs: FileNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

export default FileNode;

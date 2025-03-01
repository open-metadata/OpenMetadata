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
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      url: { default: '' },
      fileName: { default: '' },
      fileSize: { default: null },
      mimeType: { default: '' },
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

          const url = element.getAttribute('data-url') || '';
          const fileName = element.getAttribute('data-filename') || '';
          const fileSize = element.getAttribute('data-filesize');
          const mimeType = element.getAttribute('data-mimetype') || '';

          return {
            url,
            fileName,
            fileSize: fileSize ? parseInt(fileSize) : null,
            mimeType,
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as FileNodeAttrs;
    const baseAttrs = {
      'data-type': 'file-attachment',
      'data-url': attrs.url,
      'data-filename': attrs.fileName,
      'data-filesize': attrs.fileSize?.toString(),
      'data-mimetype': attrs.mimeType,
    };

    switch (true) {
      case attrs.mimeType.startsWith(FileType.VIDEO):
        return [
          'div',
          mergeAttributes(this.options.HTMLAttributes, baseAttrs, {
            class: 'file-attachment file-type-video',
          }),
          [
            'video',
            {
              controls: 'true',
              src: attrs.url,
              class: 'video-player',
            },
          ],
        ];

      case attrs.mimeType.startsWith(FileType.AUDIO):
        return [
          'div',
          mergeAttributes(this.options.HTMLAttributes, baseAttrs, {
            class: 'file-attachment file-type-audio',
          }),
          [
            'audio',
            {
              controls: 'true',
              src: attrs.url,
              class: 'audio-player',
            },
          ],
        ];

      default:
        return [
          'div',
          mergeAttributes(this.options.HTMLAttributes, baseAttrs, {
            class: 'file-attachment file-type-file',
          }),
          [
            'a',
            {
              href: attrs.url,
              class: 'file-link',
              target: '_blank',
              rel: 'noopener noreferrer',
            },
            [
              'span',
              { class: 'file-name' },
              attrs.fileName,
              attrs.fileSize
                ? [
                    'span',
                    { class: 'file-size' },
                    ` (${bytesToSize(attrs.fileSize)})`,
                  ]
                : null,
            ],
          ],
        ];
    }
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

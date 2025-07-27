/*
 *  Copyright 2024 Collate.
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
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FileNodeAttrs, FileNodeOptions } from './FileNode.interface';
import FileNodeView from './FileNodeView';

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
      isUploading: { default: false },
      uploadProgress: { default: 0 },
      tempFile: { default: null },
      isImage: { default: false },
      alt: { default: null },
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
          const isUploading = element.getAttribute('data-uploading') === 'true';
          const uploadProgress = element.getAttribute('data-upload-progress');
          const tempFile = element.getAttribute('data-temp-file');
          const isImage = element.getAttribute('data-is-image') === 'true';
          const alt = element.getAttribute('data-alt');

          return {
            url,
            fileName,
            fileSize: fileSize ? parseInt(fileSize) : null,
            mimeType,
            isUploading,
            uploadProgress: uploadProgress ? parseInt(uploadProgress) : 0,
            tempFile: tempFile ? JSON.parse(tempFile) : null,
            isImage,
            alt,
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
      'data-uploading': attrs.isUploading?.toString(),
      'data-upload-progress': attrs.uploadProgress?.toString(),
      'data-temp-file': attrs.tempFile ? JSON.stringify(attrs.tempFile) : null,
      'data-is-image': attrs.isImage?.toString(),
      'data-alt': attrs.alt,
    };

    return ['div', mergeAttributes(this.options.HTMLAttributes, baseAttrs)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileNodeView);
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

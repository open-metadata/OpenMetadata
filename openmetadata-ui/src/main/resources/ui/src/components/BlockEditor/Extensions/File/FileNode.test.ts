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
import { Editor, Node } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { FileType } from '../../BlockEditor.interface';

// Mock FileNode using Node.create
const mockFileNode = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,

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

          return {
            url: element.getAttribute('data-url') || '',
            fileName: element.getAttribute('data-filename') || '',
            fileSize: element.getAttribute('data-filesize')
              ? parseInt(element.getAttribute('data-filesize') || '0')
              : null,
            mimeType: element.getAttribute('data-mimetype') || '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-type': 'file-attachment',
        'data-url': node.attrs.url,
        'data-filename': node.attrs.fileName,
        'data-filesize': node.attrs.fileSize,
        'data-mimetype': node.attrs.mimeType,
      },
    ];
  },

  addCommands() {
    return {
      setFile:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

jest.mock('./FileNode', () => ({
  __esModule: true,
  default: mockFileNode,
}));

describe('FileNode', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Text, Paragraph, mockFileNode],
    });
    editor.commands.setContent('<p></p>');
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Commands', () => {
    it('should insert a file attachment', () => {
      const attrs = {
        url: 'https://example.com/file.pdf',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        type: FileType.FILE,
      };

      editor.commands.setFile(attrs);
      const content = editor.getHTML();

      expect(content).toContain('data-type="file-attachment"');
      expect(content).toContain('data-url="https://example.com/file.pdf"');
      expect(content).toContain('data-filename="test.pdf"');
      expect(content).toContain('data-filesize="1024"');
      expect(content).toContain('data-mimetype="application/pdf"');
    });
  });

  describe('HTML Parsing', () => {
    it('should parse file attachment HTML correctly', () => {
      const html = `
        <div data-type="file-attachment" 
             data-url="https://example.com/file.pdf"
             data-filename="test.pdf"
             data-filesize="1024"
             data-mimetype="application/pdf">
        </div>
      `;

      editor.commands.setContent(html);
      const content = editor.getJSON();

      expect(content.content?.[0].type).toBe('fileAttachment');
      expect(content.content?.[0].attrs).toEqual({
        url: 'https://example.com/file.pdf',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        isUploading: false,
        uploadProgress: 0,
        tempFile: null,
        isImage: false,
        alt: null,
      });
    });
  });
});

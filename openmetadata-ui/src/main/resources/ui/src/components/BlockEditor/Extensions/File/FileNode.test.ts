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
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { FileType } from '../../BlockEditor.interface';
import FileNode from './FileNode';

describe('FileNode', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Text, Paragraph, FileNode],
    });
    // Initialize editor with empty document
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

  describe('HTML Rendering', () => {
    it('should render video file correctly', () => {
      const attrs = {
        url: 'https://example.com/video.mp4',
        fileName: 'test.mp4',
        fileSize: 1024,
        mimeType: FileType.VIDEO,
        type: FileType.VIDEO,
      };

      editor.commands.setFile(attrs);
      const content = editor.getHTML();

      expect(content).toContain('file-type-video');
      expect(content).toContain('<video');
      expect(content).toContain('controls="true"');
      expect(content).toContain('src="https://example.com/video.mp4"');
    });

    it('should render audio file correctly', () => {
      const attrs = {
        url: 'https://example.com/audio.mp3',
        fileName: 'test.mp3',
        fileSize: 1024,
        mimeType: FileType.AUDIO,
        type: FileType.AUDIO,
      };

      editor.commands.setFile(attrs);
      const content = editor.getHTML();

      expect(content).toContain('file-type-audio');
      expect(content).toContain('<audio');
      expect(content).toContain('controls="true"');
      expect(content).toContain('src="https://example.com/audio.mp3"');
    });

    it('should render regular file correctly', () => {
      const attrs = {
        url: 'https://example.com/document.pdf',
        fileName: 'document.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        type: FileType.FILE,
      };

      editor.commands.setFile(attrs);
      const content = editor.getHTML();

      expect(content).toContain('file-type-file');
      expect(content).toContain('<a');
      expect(content).toContain('href="https://example.com/document.pdf"');
      expect(content).toContain('document.pdf');
      expect(content).toContain('(1.00 KB)');
    });

    it('should parse file attachment HTML correctly', () => {
      const html = `
        <div data-type="file-attachment" 
             data-url="https://example.com/file.pdf"
             data-filename="test.pdf"
             data-filesize="1024"
             data-mimetype="application/pdf"
             data-type="file">
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
      });
    });
  });
});

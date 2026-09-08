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

import { getRichTextDiff } from './EntityDiffUtils';

const IMAGE_A =
  '<div data-type="file-attachment" data-url="/api/v1/files/abc" data-filename="a.png" data-mimetype="image/png" data-is-image="true"></div>';

const IMAGE_B =
  '<div data-type="file-attachment" data-url="/api/v1/files/xyz" data-filename="b.png" data-mimetype="image/png" data-is-image="true"></div>';

describe('getRichTextDiff', () => {
  describe('empty / fallback', () => {
    it('returns empty string when both inputs are empty', () => {
      expect(getRichTextDiff('', '')).toBe('');
    });

    it('returns provided fallback when both inputs are empty', () => {
      expect(getRichTextDiff('', '', 'fallback content')).toBe(
        'fallback content'
      );
    });

    it('returns empty string when fallback is not provided and both inputs are empty', () => {
      expect(getRichTextDiff('', '', undefined)).toBe('');
    });
  });

  describe('text-only diffs', () => {
    it('wraps unchanged text in diff-normal spans', () => {
      const result = getRichTextDiff('<p>hello</p>', '<p>hello</p>');

      expect(result).toContain('data-testid="diff-normal"');
      expect(result).not.toContain('data-testid="diff-added"');
      expect(result).not.toContain('data-testid="diff-removed"');
    });

    it('marks added words with diff-added class and testid', () => {
      const result = getRichTextDiff('hello world', 'hello world earth');

      expect(result).toContain('data-testid="diff-added"');
      expect(result).toContain('class="diff-added text-underline');
      expect(result).toContain('earth');
    });

    it('marks removed words with diff-removed class and testid', () => {
      const result = getRichTextDiff('hello world', 'hello');

      expect(result).toContain('data-testid="diff-removed"');
      expect(result).toContain('class="text-grey-muted text-line-through');
      expect(result).toContain('world');
    });

    it('marks replaced word: removed old word and added new word', () => {
      const result = getRichTextDiff('hello world', 'hello earth');

      expect(result).toContain('data-testid="diff-removed"');
      expect(result).toContain('data-testid="diff-added"');
      expect(result).toContain('world');
      expect(result).toContain('earth');
    });

    it('converts newlines to <br> tags', () => {
      const result = getRichTextDiff(
        'line one\nline two',
        'line one\nline three'
      );

      expect(result).toContain('<br>');
    });
  });

  describe('whitespace preservation', () => {
    it('preserves spaces between diff chunks so words do not merge', () => {
      const result = getRichTextDiff('one two three', 'one changed three');

      expect(result).not.toContain('changedthree');
      expect(result).toContain(' three');
    });
  });

  describe('file-attachment image diffs', () => {
    it('renders unchanged image without a data-diff-state attribute', () => {
      const result = getRichTextDiff(IMAGE_A, IMAGE_A);

      expect(result).toContain('data-url="/api/v1/files/abc"');
      expect(result).not.toContain('data-diff-state');
    });

    it('marks an added image with data-diff-state="added"', () => {
      const result = getRichTextDiff('<p>text</p>', `<p>text</p>${IMAGE_A}`);

      expect(result).toContain('data-diff-state="added"');
      expect(result).toContain('data-url="/api/v1/files/abc"');
    });

    it('marks a removed image with data-diff-state="removed"', () => {
      const result = getRichTextDiff(`<p>text</p>${IMAGE_A}`, '<p>text</p>');

      expect(result).toContain('data-diff-state="removed"');
      expect(result).toContain('data-url="/api/v1/files/abc"');
    });

    it('marks replaced image: old as removed and new as added', () => {
      const result = getRichTextDiff(IMAGE_A, IMAGE_B);

      expect(result).toContain('data-diff-state="removed"');
      expect(result).toContain('data-url="/api/v1/files/abc"');
      expect(result).toContain('data-diff-state="added"');
      expect(result).toContain('data-url="/api/v1/files/xyz"');
    });

    it('leaves unchanged image unaffected when only surrounding text changes', () => {
      const result = getRichTextDiff(
        `${IMAGE_A}<p>hello</p>`,
        `${IMAGE_A}<p>world</p>`
      );

      expect(result).toContain('data-url="/api/v1/files/abc"');
      expect(result).not.toContain('data-diff-state="added"');
      expect(result).not.toContain('data-diff-state="removed"');
      expect(result).toContain('data-testid="diff-removed"');
      expect(result).toContain('data-testid="diff-added"');
    });
  });
});

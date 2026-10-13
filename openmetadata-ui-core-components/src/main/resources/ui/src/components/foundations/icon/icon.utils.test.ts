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
import { describe, expect, it } from 'vitest';
import { isImageUrl } from './icon.utils';

describe('isImageUrl', () => {
  it('should return true for valid http URLs', () => {
    expect(isImageUrl('http://example.com/image.png')).toBe(true);
    expect(isImageUrl('http://example.com/path/to/image.jpg')).toBe(true);
  });

  it('should return true for valid https URLs', () => {
    expect(isImageUrl('https://example.com/image.png')).toBe(true);
    expect(isImageUrl('https://example.com/path/to/image.svg')).toBe(true);
  });

  it('should return true for absolute paths', () => {
    expect(isImageUrl('/path/to/image.png')).toBe(true);
    expect(isImageUrl('/assets/icon.svg')).toBe(true);
  });

  it('should return true for data URIs', () => {
    expect(isImageUrl('data:image/png;base64,abc123')).toBe(true);
    expect(isImageUrl('data:image/svg+xml;base64,xyz789')).toBe(true);
  });

  it('should return true for valid image filenames', () => {
    expect(isImageUrl('icon.png')).toBe(true);
    expect(isImageUrl('my-icon.jpg')).toBe(true);
    expect(isImageUrl('icon_name.svg')).toBe(true);
    expect(isImageUrl('image.file.jpeg')).toBe(true);
  });

  it('should return true for relative image paths', () => {
    expect(isImageUrl('assets/certifications/gold.svg')).toBe(true);
    expect(isImageUrl('images/icons/bronze.png')).toBe(true);
  });

  it('should return false for relative paths containing parent directory segments', () => {
    expect(isImageUrl('../assets/icon.png')).toBe(false);
    expect(isImageUrl('assets/../icon.png')).toBe(false);
  });

  it('should return true for all supported image extensions', () => {
    const extensions = [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'svg',
      'webp',
      'bmp',
      'ico',
    ];
    extensions.forEach((ext) => {
      expect(isImageUrl(`image.${ext}`)).toBe(true);
      expect(isImageUrl(`image.${ext.toUpperCase()}`)).toBe(true);
    });
  });

  it('should return false for incomplete URLs', () => {
    expect(isImageUrl('http://')).toBe(false);
    expect(isImageUrl('https://')).toBe(false);
    expect(isImageUrl('/')).toBe(false);
  });

  it('should return false for invalid image filenames', () => {
    expect(isImageUrl('icon.txt')).toBe(false);
    expect(isImageUrl('icon.pdf')).toBe(false);
    expect(isImageUrl('icon')).toBe(false);
    expect(isImageUrl('icon.')).toBe(false);
  });

  it('should return false for empty or undefined strings', () => {
    expect(isImageUrl('')).toBe(false);
  });

  it('should return false for filenames with invalid characters', () => {
    expect(isImageUrl('icon with spaces.png')).toBe(false);
    expect(isImageUrl('icon@special.png')).toBe(false);
  });
});

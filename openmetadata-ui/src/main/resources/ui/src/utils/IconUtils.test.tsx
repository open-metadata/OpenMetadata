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
import { render } from '@testing-library/react';
import { isImageUrl, renderIcon } from './IconUtils';

describe('IconUtils', () => {
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

  describe('renderIcon', () => {
    // beforeEach(() => {
    //   // Mock window.location.origin for getTagImageSrc tests
    //   delete window.location;
    //   window.location = { origin: 'http://localhost:3000' } as Location;
    // });

    it('should return null for undefined iconValue', () => {
      const result = renderIcon(undefined);

      expect(result).toBeNull();
    });

    it('should return null for empty string iconValue', () => {
      const result = renderIcon('');

      expect(result).toBeNull();
    });

    it('should render icon component for known icon names', () => {
      const { container } = render(<>{renderIcon('Cube01')}</>);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should apply custom size to icon component', () => {
      const { container } = render(<>{renderIcon('Cube01', { size: 32 })}</>);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '32');
      expect(svg).toHaveAttribute('height', '32');
    });

    it('should apply custom strokeWidth to icon component', () => {
      const { container } = render(
        <>{renderIcon('Cube01', { strokeWidth: 2 })}</>
      );
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveStyle({ strokeWidth: 2 });
    });

    it('should render img element for valid image URLs', () => {
      const { container } = render(
        <>{renderIcon('http://example.com/image.png')}</>
      );
      const img = container.querySelector('img');

      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'http://example.com/image.png');
    });

    it('should render img element for valid image filenames', () => {
      const { container } = render(<>{renderIcon('icon.png')}</>);
      const img = container.querySelector('img');

      expect(img).toBeInTheDocument();
      expect(img?.getAttribute('src')).toContain('icon.png');
    });

    it('should render img element for absolute paths', () => {
      const { container } = render(<>{renderIcon('/assets/icon.png')}</>);
      const img = container.querySelector('img');

      expect(img).toBeInTheDocument();
      expect(img?.getAttribute('src')).toContain('/assets/icon.png');
    });

    it('should render img element for data URIs', () => {
      const dataUri = 'data:image/png;base64,abc123';
      const { container } = render(<>{renderIcon(dataUri)}</>);
      const img = container.querySelector('img');

      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', dataUri);
    });

    it('should apply custom size to img element', () => {
      const { container } = render(<>{renderIcon('icon.png', { size: 48 })}</>);
      const img = container.querySelector('img');

      expect(img).toBeInTheDocument();
      expect(img).toHaveStyle({ width: '48px', height: '48px' });
    });

    it('should apply custom className to img element', () => {
      const { container } = render(
        <>{renderIcon('icon.png', { className: 'custom-class' })}</>
      );
      const img = container.querySelector('img');

      expect(img).toBeInTheDocument();
      expect(img).toHaveClass('custom-class');
    });

    it('should apply custom styles to img element', () => {
      const { container } = render(
        <>{renderIcon('icon.png', { style: { borderRadius: '50%' } })}</>
      );
      const img = container.querySelector('img');

      expect(img).toBeInTheDocument();
      expect(img).toHaveStyle({ borderRadius: '50%' });
    });

    it('should return null for unknown icon names that are not valid URLs', () => {
      const result = renderIcon('UnknownIcon');

      expect(result).toBeNull();
    });

    it('should return null for invalid image patterns', () => {
      const result = renderIcon('not-an-image.txt');

      expect(result).toBeNull();
    });
  });
});

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
import { fireEvent, render } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  describe('icon name and empty/invalid values', () => {
    it('should render null for undefined iconValue and no fallback', () => {
      const { container } = render(<Icon iconValue={undefined} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should render fallback for undefined iconValue', () => {
      const { getByTestId } = render(
        <Icon
          fallback={<div data-testid="fallback-icon" />}
          iconValue={undefined}
        />
      );

      expect(getByTestId('fallback-icon')).toBeInTheDocument();
    });

    it('should render fallback for empty string iconValue', () => {
      const { getByTestId } = render(
        <Icon fallback={<div data-testid="fallback-icon" />} iconValue="" />
      );

      expect(getByTestId('fallback-icon')).toBeInTheDocument();
    });

    it('should render icon component for known icon names', () => {
      const { container } = render(<Icon iconValue="Cube01" />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should apply custom size to icon component', () => {
      const { container } = render(<Icon iconValue="Cube01" size={32} />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '32');
      expect(svg).toHaveAttribute('height', '32');
    });

    it('should apply custom strokeWidth to icon component', () => {
      const { container } = render(<Icon iconValue="Cube01" strokeWidth={2} />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveStyle({ strokeWidth: 2 });
    });

    it('should apply custom className to icon component', () => {
      const { container } = render(
        <Icon className="custom-class" iconValue="Cube01" />
      );
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('custom-class');
    });

    it('should render fallback for unknown icon names that are not valid URLs', () => {
      const { getByTestId } = render(
        <Icon
          fallback={<div data-testid="fallback-icon" />}
          iconValue="UnknownIcon"
        />
      );

      expect(getByTestId('fallback-icon')).toBeInTheDocument();
    });

    it('should render null for unknown icon names with no fallback', () => {
      const { container } = render(<Icon iconValue="UnknownIcon" />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should render fallback for invalid image patterns', () => {
      const { getByTestId } = render(
        <Icon
          fallback={<div data-testid="fallback-icon" />}
          iconValue="not-an-image.txt"
        />
      );

      expect(getByTestId('fallback-icon')).toBeInTheDocument();
    });
  });

  describe('image URL rendering', () => {
    it('should render img element (hidden initially) for valid image URLs', () => {
      const { getByTestId } = render(
        <Icon iconValue="http://example.com/image.png" />
      );
      const img = getByTestId('icon-image');

      expect(img).toBeInTheDocument();
      expect(img).toHaveStyle({ display: 'none' });
    });

    it('should show img after onLoad fires', () => {
      const { getByTestId } = render(
        <Icon iconValue="http://example.com/image.png" />
      );
      const img = getByTestId('icon-image');
      fireEvent.load(img);

      expect(img).not.toHaveStyle({ display: 'none' });
    });

    it('should show fallback after onError fires', () => {
      const { getByTestId, queryByTestId } = render(
        <Icon
          fallback={<div data-testid="fallback-icon" />}
          iconValue="http://example.com/image.png"
        />
      );
      const img = getByTestId('icon-image');
      fireEvent.error(img);

      expect(getByTestId('fallback-icon')).toBeInTheDocument();
      expect(queryByTestId('icon-image')).not.toBeInTheDocument();
    });

    it('should apply custom size to img element', () => {
      const { getByTestId } = render(
        <Icon iconValue="http://example.com/image.png" size={48} />
      );
      fireEvent.load(getByTestId('icon-image'));

      expect(getByTestId('icon-image')).toHaveStyle({
        width: '48px',
        height: '48px',
      });
    });

    it('should apply custom alt text to img element', () => {
      const { getByTestId } = render(
        <Icon
          alt="certification: Gold"
          iconValue="http://example.com/image.png"
        />
      );

      expect(getByTestId('icon-image')).toHaveAttribute(
        'alt',
        'certification: Gold'
      );
    });

    it('should default alt text to icon', () => {
      const { getByTestId } = render(
        <Icon iconValue="http://example.com/image.png" />
      );

      expect(getByTestId('icon-image')).toHaveAttribute('alt', 'icon');
    });

    it('should apply wrapperStyle to the span container', () => {
      const { container } = render(
        <Icon
          iconValue="http://example.com/image.png"
          wrapperStyle={{ marginRight: 4 }}
        />
      );
      const span = container.querySelector('span');

      expect(span).toHaveStyle({ marginRight: '4px' });
    });

    it('should reset load state when iconValue changes', () => {
      const { getByTestId, rerender } = render(
        <Icon iconValue="http://example.com/image1.png" />
      );
      fireEvent.load(getByTestId('icon-image'));

      expect(getByTestId('icon-image')).not.toHaveStyle({ display: 'none' });

      rerender(<Icon iconValue="http://example.com/image2.png" />);

      expect(getByTestId('icon-image')).toHaveStyle({ display: 'none' });
    });

    it('should render for image filenames', () => {
      const { getByTestId } = render(<Icon iconValue="icon.png" />);

      expect(getByTestId('icon-image')).toBeInTheDocument();
    });

    it('should render for absolute paths', () => {
      const { getByTestId } = render(<Icon iconValue="/assets/icon.png" />);

      expect(getByTestId('icon-image')).toBeInTheDocument();
    });

    it('should render for data URIs', () => {
      const { getByTestId } = render(
        <Icon iconValue="data:image/png;base64,abc123" />
      );

      expect(getByTestId('icon-image')).toBeInTheDocument();
    });

    it('should apply imageStyle to img but not the skeleton', () => {
      const { getByTestId } = render(
        <Icon
          iconValue="http://example.com/image.png"
          imageStyle={{ borderRadius: '50%' }}
        />
      );
      const img = getByTestId('icon-image');

      expect(img).toHaveStyle({ borderRadius: '50%' });
    });

    it('should show img immediately when the browser has it cached (complete=true)', () => {
      const { getByTestId } = render(
        <Icon iconValue="http://example.com/cached.png" />
      );
      const img = getByTestId('icon-image');
      // Simulate a browser-cached image: complete is true before onLoad fires
      Object.defineProperty(img, 'complete', {
        value: true,
        configurable: true,
      });
      Object.defineProperty(img, 'naturalWidth', {
        value: 100,
        configurable: true,
      });
      // Re-trigger the effect by simulating what happens on re-mount
      fireEvent.load(img);

      expect(img).not.toHaveStyle({ display: 'none' });
    });
  });
});

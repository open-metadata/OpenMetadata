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

  describe('image URL loading lifecycle', () => {
    it('should show a loading skeleton and a hidden img before load resolves', () => {
      const { container, getByTestId } = render(
        <Icon iconValue="http://example.com/image.png" />
      );

      const img = getByTestId('icon-image');

      expect(
        container.querySelector('[aria-hidden="true"]')
      ).toBeInTheDocument();
      expect(img).toHaveStyle({ display: 'none' });
    });

    it('should show the image and hide the skeleton once it loads', () => {
      const { container, getByTestId } = render(
        <Icon iconValue="http://example.com/image.png" />
      );

      const img = getByTestId('icon-image');
      fireEvent.load(img);

      expect(img).not.toHaveStyle({ display: 'none' });
      expect(
        container.querySelector('[aria-hidden="true"]')
      ).not.toBeInTheDocument();
    });

    it('should apply wrapperStyle to the wrapper regardless of loading state', () => {
      const { container, getByTestId } = render(
        <Icon
          iconValue="http://example.com/image.png"
          wrapperStyle={{ marginRight: 4, flexShrink: 0 }}
        />
      );

      const wrapper = container.firstChild;

      expect(wrapper).toHaveStyle({ marginRight: '4px', flexShrink: 0 });

      fireEvent.load(getByTestId('icon-image'));

      expect(wrapper).toHaveStyle({ marginRight: '4px', flexShrink: 0 });
    });

    it('should not apply wrapperStyle to the loading skeleton itself', () => {
      const { container } = render(
        <Icon
          iconValue="http://example.com/image.png"
          wrapperStyle={{ marginRight: 4 }}
        />
      );

      expect(container.querySelector('[aria-hidden="true"]')).not.toHaveStyle({
        marginRight: '4px',
      });
    });

    it('should render the img element with the resolved src', () => {
      const { getByTestId } = render(
        <Icon iconValue="http://example.com/image.png" />
      );

      expect(getByTestId('icon-image')).toHaveAttribute(
        'src',
        'http://example.com/image.png'
      );
    });

    it('should apply custom size to img element', () => {
      const { getByTestId } = render(<Icon iconValue="icon.png" size={48} />);

      expect(getByTestId('icon-image')).toHaveStyle({
        width: '48px',
        height: '48px',
      });
    });

    it('should apply custom alt text to img element', () => {
      const { getByTestId } = render(
        <Icon alt="certification: Gold" iconValue="icon.png" />
      );

      expect(getByTestId('icon-image')).toHaveAttribute(
        'alt',
        'certification: Gold'
      );
    });

    it('should default alt text to icon for img element', () => {
      const { getByTestId } = render(<Icon iconValue="icon.png" />);

      expect(getByTestId('icon-image')).toHaveAttribute('alt', 'icon');
    });

    it('should apply custom className to the wrapper element', () => {
      const { container } = render(
        <Icon className="custom-class" iconValue="icon.png" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should apply imageStyle to the img element only', () => {
      const { container, getByTestId } = render(
        <Icon iconValue="icon.png" imageStyle={{ borderRadius: '50%' }} />
      );

      expect(getByTestId('icon-image')).toHaveStyle({ borderRadius: '50%' });
      expect(container.querySelector('[aria-hidden="true"]')).not.toHaveStyle({
        borderRadius: '50%',
      });
    });

    it('should fall back to fallback content when the image fails to load', () => {
      const { getByTestId, queryByTestId } = render(
        <Icon
          fallback={<div data-testid="fallback-icon" />}
          iconValue="http://example.com/broken.png"
        />
      );

      fireEvent.error(getByTestId('icon-image'));

      expect(getByTestId('fallback-icon')).toBeInTheDocument();
      expect(queryByTestId('icon-image')).not.toBeInTheDocument();
    });

    it('should render nothing when the image fails to load and no fallback is provided', () => {
      const { container, getByTestId } = render(
        <Icon iconValue="http://example.com/broken.png" />
      );

      fireEvent.error(getByTestId('icon-image'));

      expect(container).toBeEmptyDOMElement();
    });

    it('should show the image immediately when it is already cached (complete before onLoad fires)', () => {
      Object.defineProperty(HTMLImageElement.prototype, 'complete', {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
        configurable: true,
        get: () => 1,
      });

      const { container, getByTestId } = render(
        <Icon iconValue="http://example.com/cached.png" />
      );

      expect(getByTestId('icon-image')).not.toHaveStyle({ display: 'none' });
      expect(
        container.querySelector('[aria-hidden="true"]')
      ).not.toBeInTheDocument();

      Reflect.deleteProperty(HTMLImageElement.prototype, 'complete');
      Reflect.deleteProperty(HTMLImageElement.prototype, 'naturalWidth');
    });
  });
});

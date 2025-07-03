/*
 *  Copyright 2023 Collate.
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
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../../hooks/useApplicationStore');
jest.mock('../../../utils/BrandData/BrandClassBase', () => ({
  getMonogram: jest.fn().mockReturnValue({
    src: '/default-monogram.svg',
  }),
  getLogo: jest.fn().mockReturnValue({
    src: '/default-logo.svg',
  }),
}));

import { useApplicationStore } from '../../../hooks/useApplicationStore';
import BrandImage from './BrandImage';

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;

describe('Test Brand Logo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({
      applicationConfig: {
        customLogoConfig: {
          customLogoUrlPath: 'https://custom-logo.png',
          customMonogramUrlPath: 'https://custom-monogram.png',
        },
      },
    });
  });

  it('Should render the brand logo with default props value', () => {
    render(<BrandImage height="auto" width={152} />);

    const image = screen.getByTestId('brand-logo-image');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'OpenMetadata Logo');
    expect(image).toHaveAttribute('height', 'auto');
    expect(image).toHaveAttribute('width', '152');
    expect(image).toHaveAttribute('id', 'brand-image');
  });

  it('Should render the brand logo with passed props value', () => {
    render(
      <BrandImage
        alt="brand-monogram"
        className="m-auto"
        dataTestId="brand-monogram"
        height={30}
        width={30}
      />
    );

    const image = screen.getByTestId('brand-monogram');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'brand-monogram');
    expect(image).toHaveAttribute('height', '30');
    expect(image).toHaveAttribute('width', '30');
    expect(image).toHaveClass('m-auto');
  });

  it('Should render the brand logo based on custom logo config', () => {
    render(
      <BrandImage
        alt="brand-logo"
        className="m-auto"
        dataTestId="brand-logo"
        height="auto"
        width={152}
      />
    );

    const image = screen.getByTestId('brand-logo');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'brand-logo');
    expect(image).toHaveAttribute('height', 'auto');
    expect(image).toHaveAttribute('width', '152');
    expect(image).toHaveAttribute('src', 'https://custom-logo.png');
    expect(image).toHaveClass('m-auto');
  });

  it('Should render the monogram if isMonoGram is true', () => {
    render(
      <BrandImage
        isMonoGram
        alt="brand-monogram"
        dataTestId="brand-monogram"
        height={30}
        width={30}
      />
    );

    const image = screen.getByTestId('brand-monogram');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'brand-monogram');
    expect(image).toHaveAttribute('height', '30');
    expect(image).toHaveAttribute('width', '30');
    expect(image).toHaveAttribute('src', 'https://custom-monogram.png');
  });

  it('Should use default logo when no custom logo config is provided', () => {
    mockUseApplicationStore.mockReturnValue({
      applicationConfig: {
        customLogoConfig: {
          customLogoUrlPath: '',
          customMonogramUrlPath: '',
        },
      },
    });

    render(
      <BrandImage
        alt="default-logo"
        dataTestId="default-logo"
        height={30}
        width={30}
      />
    );

    const image = screen.getByTestId('default-logo');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/default-logo.svg');
  });

  it('Should use default monogram when no custom monogram config is provided', () => {
    mockUseApplicationStore.mockReturnValue({
      applicationConfig: {
        customLogoConfig: {
          customLogoUrlPath: '',
          customMonogramUrlPath: '',
        },
      },
    });

    render(
      <BrandImage
        isMonoGram
        alt="default-monogram"
        dataTestId="default-monogram"
        height={30}
        width={30}
      />
    );

    const image = screen.getByTestId('default-monogram');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/default-monogram.svg');
  });

  it('Should handle missing customLogoConfig gracefully', () => {
    mockUseApplicationStore.mockReturnValue({
      applicationConfig: {},
    });

    render(
      <BrandImage
        alt="fallback-logo"
        dataTestId="fallback-logo"
        height={30}
        width={30}
      />
    );

    const image = screen.getByTestId('fallback-logo');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/default-logo.svg');
  });

  it('Should handle missing applicationConfig gracefully', () => {
    mockUseApplicationStore.mockReturnValue({});

    render(
      <BrandImage
        alt="no-config-logo"
        dataTestId="no-config-logo"
        height={30}
        width={30}
      />
    );

    const image = screen.getByTestId('no-config-logo');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/default-logo.svg');
  });

  it('Should use provided src prop when given', () => {
    const customSrc = 'https://example.com/custom-image.png';

    render(
      <BrandImage
        alt="custom-src-logo"
        dataTestId="custom-src-logo"
        height={30}
        src={customSrc}
        width={30}
      />
    );

    const image = screen.getByTestId('custom-src-logo');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', customSrc);
  });

  it('Should handle onError and fallback to default logo when image fails to load', () => {
    render(
      <BrandImage
        alt="error-logo"
        dataTestId="error-logo"
        height={30}
        width={30}
      />
    );

    const image = screen.getByTestId('error-logo');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://custom-logo.png');

    // Simulate image load error
    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/default-logo.svg');
  });

  it('Should handle onError and fallback to default monogram when monogram fails to load', () => {
    render(
      <BrandImage
        isMonoGram
        alt="error-monogram"
        dataTestId="error-monogram"
        height={30}
        width={30}
      />
    );

    const image = screen.getByTestId('error-monogram');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://custom-monogram.png');

    // Simulate image load error
    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/default-monogram.svg');
  });

  it('Should handle onError with custom src and fallback to default logo', () => {
    const customSrc = 'https://example.com/broken-image.png';

    render(
      <BrandImage
        alt="broken-custom-logo"
        dataTestId="broken-custom-logo"
        height={30}
        src={customSrc}
        width={30}
      />
    );

    const image = screen.getByTestId('broken-custom-logo');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', customSrc);

    // Simulate image load error
    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/default-logo.svg');
  });

  it('Should handle onError with custom src and monogram fallback', () => {
    const customSrc = 'https://example.com/broken-monogram.png';

    render(
      <BrandImage
        isMonoGram
        alt="broken-custom-monogram"
        dataTestId="broken-custom-monogram"
        height={30}
        src={customSrc}
        width={30}
      />
    );

    const image = screen.getByTestId('broken-custom-monogram');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', customSrc);

    // Simulate image load error
    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/default-monogram.svg');
  });

  it('Should render with all props including optional ones', () => {
    render(
      <BrandImage
        alt="comprehensive test logo"
        className="test-class custom-brand"
        dataTestId="comprehensive-test"
        height="50px"
        isMonoGram={false}
        src="https://example.com/test-logo.png"
        width="100%"
      />
    );

    const image = screen.getByTestId('comprehensive-test');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'comprehensive test logo');
    expect(image).toHaveAttribute('width', '100%');
    expect(image).toHaveAttribute('height', '50px');
    expect(image).toHaveAttribute('src', 'https://example.com/test-logo.png');
    expect(image).toHaveAttribute('id', 'brand-image');
    expect(image).toHaveClass('test-class', 'custom-brand');
  });

  it('Should prioritize src prop over custom logo configuration', () => {
    const prioritySrc = 'https://priority.com/logo.png';

    render(
      <BrandImage
        dataTestId="priority-test"
        height={30}
        src={prioritySrc}
        width={30}
      />
    );

    const image = screen.getByTestId('priority-test');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', prioritySrc);
    expect(image).not.toHaveAttribute('src', 'https://custom-logo.png');
  });
});

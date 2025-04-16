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
import { render, screen } from '@testing-library/react';
import BrandImage from './BrandImage';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    applicationConfig: {
      customLogoConfig: {
        customLogoUrlPath: 'https://custom-logo.png',
        customMonogramUrlPath: 'https://custom-monogram.png',
      },
    },
  })),
}));

describe('Test Brand Logo', () => {
  it('Should render the brand logo with default props value', () => {
    render(<BrandImage height="auto" width={152} />);

    const image = screen.getByTestId('brand-logo-image');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'OpenMetadata Logo');
    expect(image).toHaveAttribute('height', 'auto');
    expect(image).toHaveAttribute('width', '152');
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
        alt="brand-monogram"
        className="m-auto"
        dataTestId="brand-monogram"
        height="auto"
        width={152}
      />
    );

    const image = screen.getByTestId('brand-monogram');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'brand-monogram');
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
});

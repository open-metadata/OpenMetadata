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
import { render, screen } from '@testing-library/react';

jest.mock('../../BlockEditor/Extensions/image/ImageClassBase', () => ({
  __esModule: true,
  default: {
    getAuthenticatedImageUrl: jest.fn(),
  },
}));

import imageClassBase from '../../BlockEditor/Extensions/image/ImageClassBase';
import { CoverImage } from './CoverImage.component';

const mockGetAuthenticatedImageUrl =
  imageClassBase.getAuthenticatedImageUrl as jest.Mock;

describe('CoverImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedImageUrl.mockReturnValue(undefined);
  });

  it('renders gradient placeholder when no imageUrl is given', () => {
    render(<CoverImage />);

    expect(screen.getByTestId('cover-image-container')).toBeInTheDocument();
    expect(screen.getByTestId('cover-image-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('cover-image')).not.toBeInTheDocument();
  });

  it('renders gradient placeholder when imageUrl is an empty string', () => {
    render(<CoverImage imageUrl="" />);

    expect(screen.getByTestId('cover-image-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('cover-image')).not.toBeInTheDocument();
  });

  it('renders the image for a public imageUrl when no auth hook is present', () => {
    render(<CoverImage imageUrl="https://example.com/img.png" />);

    const image = screen.getByTestId('cover-image');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/img.png');
    expect(image).not.toHaveStyle({
      transform: expect.stringContaining('translateY'),
    });
  });

  it('renders loading element while authenticated URL is resolving', () => {
    mockGetAuthenticatedImageUrl.mockReturnValue(() => ({
      imageSrc: '/api/v1/attachments/123',
      isLoading: true,
    }));

    render(<CoverImage imageUrl="/api/v1/attachments/123" />);

    expect(screen.getByTestId('cover-image-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('cover-image')).not.toBeInTheDocument();
  });

  it('renders image when authenticated blob URL is ready', () => {
    mockGetAuthenticatedImageUrl.mockReturnValue(() => ({
      imageSrc: 'blob:http://localhost/abc',
      isLoading: false,
    }));

    render(<CoverImage imageUrl="/api/v1/attachments/123" />);

    const image = screen.getByTestId('cover-image');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'blob:http://localhost/abc');
  });

  it('applies translateY transform when position.y is provided', () => {
    render(
      <CoverImage
        imageUrl="https://example.com/img.png"
        position={{ y: '-16%' }}
      />
    );

    const image = screen.getByTestId('cover-image');

    expect(image).toHaveStyle({ transform: 'translateY(-16%)' });
  });

  it('does not apply transform when position.y is absent', () => {
    render(<CoverImage imageUrl="https://example.com/img.png" />);

    const image = screen.getByTestId('cover-image');

    expect(image).not.toHaveStyle({
      transform: expect.stringContaining('translateY'),
    });
  });
});

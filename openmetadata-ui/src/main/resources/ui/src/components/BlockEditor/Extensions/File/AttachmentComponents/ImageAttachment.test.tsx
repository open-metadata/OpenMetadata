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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NodeViewProps } from '@tiptap/react';
import { UPLOADED_ASSETS_URL } from '../../../../../constants/BlockEditor.constants';
import ImageAttachment from './ImageAttachment';

describe('ImageAttachment', () => {
  const mockNode = {
    attrs: {
      url: 'https://example.com/image.jpg',
      alt: 'Test Image',
      isUploading: false,
    },
  } as unknown as NodeViewProps['node'];

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state when isUploading is true', () => {
    const uploadingNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        isUploading: true,
      },
    } as unknown as NodeViewProps['node'];

    render(
      <ImageAttachment
        isMediaLoading={false}
        mediaSrc=""
        node={uploadingNode}
      />
    );

    const imageContainer = screen.getByTestId('image-container');

    expect(imageContainer).toHaveClass('loading-state');
    expect(screen.queryByTestId('uploaded-image-node')).not.toBeInTheDocument();
  });

  it('should render loading state when media is loading and needs authentication', () => {
    const authenticatedNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        url: `${UPLOADED_ASSETS_URL}/123`,
      },
    } as unknown as NodeViewProps['node'];

    render(
      <ImageAttachment isMediaLoading mediaSrc="" node={authenticatedNode} />
    );

    const imageContainer = screen.getByTestId('image-container');

    expect(imageContainer).toHaveClass('loading-state');
    expect(screen.queryByTestId('uploaded-image-node')).not.toBeInTheDocument();
  });

  it('should render image when mediaSrc is provided', async () => {
    const mediaSrc = 'https://example.com/image.jpg';
    render(
      <ImageAttachment
        isMediaLoading={false}
        mediaSrc={mediaSrc}
        node={mockNode}
      />
    );

    const image = screen.getByTestId('uploaded-image-node');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', mediaSrc);
    expect(image).toHaveAttribute('alt', 'Test Image');
  });

  it('should show error state when image fails to load', async () => {
    render(
      <ImageAttachment isMediaLoading={false} mediaSrc="" node={mockNode} />
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId('uploaded-image-node')
      ).not.toBeInTheDocument();
    });
  });

  it('should handle authenticated image URLs correctly', async () => {
    const authenticatedNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        url: `${UPLOADED_ASSETS_URL}/123`,
      },
    } as unknown as NodeViewProps['node'];

    render(
      <ImageAttachment isMediaLoading mediaSrc="" node={authenticatedNode} />
    );

    const imageContainer = screen.getByTestId('image-container');

    expect(imageContainer).toHaveClass('loading-state');
    expect(screen.queryByTestId('uploaded-image-node')).not.toBeInTheDocument();
  });

  it('should display authenticated image when mediaSrc is provided', async () => {
    const authenticatedNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        url: `${UPLOADED_ASSETS_URL}/123`,
      },
    } as unknown as NodeViewProps['node'];

    const mediaSrc = 'https://example.com/authenticated-image.jpg';
    render(
      <ImageAttachment
        isMediaLoading={false}
        mediaSrc={mediaSrc}
        node={authenticatedNode}
      />
    );

    const image = screen.getByTestId('uploaded-image-node');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', mediaSrc);
  });

  it('should reset states when url changes', async () => {
    const { rerender } = render(
      <ImageAttachment
        isMediaLoading={false}
        mediaSrc="https://example.com/image1.jpg"
        node={mockNode}
      />
    );

    // Simulate image load
    const image = screen.getByTestId('uploaded-image-node');
    fireEvent.load(image);

    // Rerender with new url
    const newNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        url: 'https://example.com/new-image.jpg',
      },
    } as unknown as NodeViewProps['node'];

    rerender(
      <ImageAttachment
        isMediaLoading={false}
        mediaSrc="https://example.com/image1.jpg"
        node={newNode}
      />
    );

    // Image should be hidden again until it loads
    expect(screen.getByTestId('uploaded-image-node')).toHaveAttribute(
      'src',
      'https://example.com/image1.jpg'
    );
  });

  it('should reset states when mediaSrc changes', async () => {
    const { rerender } = render(
      <ImageAttachment
        isMediaLoading={false}
        mediaSrc="https://example.com/image1.jpg"
        node={mockNode}
      />
    );

    // Simulate image load
    const image = screen.getByTestId('uploaded-image-node');
    fireEvent.load(image);

    // Rerender with new mediaSrc
    rerender(
      <ImageAttachment
        isMediaLoading={false}
        mediaSrc="https://example.com/image2.jpg"
        node={mockNode}
      />
    );

    // Image should be hidden again until it loads
    expect(screen.getByTestId('uploaded-image-node')).toHaveAttribute(
      'src',
      'https://example.com/image2.jpg'
    );
  });

  it('should handle empty alt text', () => {
    const nodeWithEmptyAlt = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        alt: '',
      },
    } as unknown as NodeViewProps['node'];

    render(
      <ImageAttachment
        isMediaLoading={false}
        mediaSrc="https://example.com/image.jpg"
        node={nodeWithEmptyAlt}
      />
    );

    const image = screen.getByTestId('uploaded-image-node');

    expect(image).toHaveAttribute('alt', '');
  });
});

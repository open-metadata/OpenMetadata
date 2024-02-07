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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeViewProps } from '@tiptap/core';
import React from 'react';
import ImageComponent from './ImageComponent';

const mockNode = {
  attrs: {
    src: 'https://open-metadata.org/images/omd-logo.svg',
    alt: 'OMD Logo',
  },
} as unknown as NodeViewProps['node'];

const mockDeleteNode = jest.fn();
const mockUpdateAttributes = jest.fn();

const mockNodeViewProps = {
  node: mockNode,
  updateAttributes: mockUpdateAttributes,
  deleteNode: mockDeleteNode,
} as unknown as NodeViewProps;

describe('ImageComponent', () => {
  it('should render without crashing', async () => {
    await act(async () => {
      render(<ImageComponent {...mockNodeViewProps} />);
    });

    const imageNode = screen.getByTestId('uploaded-image-node');

    expect(imageNode).toBeInTheDocument();
    expect(imageNode).toHaveAttribute(
      'src',
      'https://open-metadata.org/images/omd-logo.svg'
    );

    expect(imageNode).toHaveAttribute('alt', 'OMD Logo');
  });

  it('should render the popover when image node is clicked', async () => {
    await act(async () => {
      render(<ImageComponent {...mockNodeViewProps} />);
    });

    const imageNode = screen.getByTestId('uploaded-image-node');

    await act(async () => {
      userEvent.click(imageNode);
    });

    const popover = screen.getByRole('tooltip');

    expect(popover).toBeInTheDocument();

    expect(screen.getByText('label.upload')).toBeInTheDocument();
    expect(screen.getByText('label.embed-link')).toBeInTheDocument();
  });

  it('should render the upload tab by default', async () => {
    await act(async () => {
      render(<ImageComponent {...mockNodeViewProps} />);
    });

    const imageNode = screen.getByTestId('uploaded-image-node');

    await act(async () => {
      userEvent.click(imageNode);
    });

    const uploadTab = screen.getByText('label.upload');

    expect(uploadTab).toBeInTheDocument();

    expect(uploadTab).toHaveAttribute('aria-selected', 'true');

    // image upload form should be visible

    expect(screen.getByTestId('image-upload-form')).toBeInTheDocument();

    // update button should be disabled

    expect(screen.getByText('label.update-image')).toBeInTheDocument();

    // delete button should be visible

    expect(screen.getByText('label.delete')).toBeInTheDocument();
  });

  it('should render the embed link tab when clicked', async () => {
    await act(async () => {
      render(<ImageComponent {...mockNodeViewProps} />);
    });

    const imageNode = screen.getByTestId('uploaded-image-node');

    await act(async () => {
      userEvent.click(imageNode);
    });

    const embedLinkTab = screen.getByText('label.embed-link');

    await act(async () => {
      userEvent.click(embedLinkTab);
    });

    expect(embedLinkTab).toHaveAttribute('aria-selected', 'true');

    // embed link form should be visible

    expect(screen.getByTestId('embed-link-form')).toBeInTheDocument();

    // embed input should be disabled

    expect(screen.getByTestId('embed-input')).toBeInTheDocument();

    // embed button should be visible

    expect(screen.getByText('label.embed-image')).toBeInTheDocument();
  });

  it("should render the image placeholder when the image's src is invalid", async () => {
    const invalidSrcNode = {
      attrs: {
        src: '',
        alt: 'OMD Logo',
      },
    } as unknown as NodeViewProps['node'];

    const invalidSrcNodeViewProps = {
      node: invalidSrcNode,
      updateAttributes: mockUpdateAttributes,
      deleteNode: mockDeleteNode,
    } as unknown as NodeViewProps;

    await act(async () => {
      render(<ImageComponent {...invalidSrcNodeViewProps} />);
    });

    const imageNode = screen.getByTestId('image-placeholder');

    expect(imageNode).toBeInTheDocument();
  });

  it('embed image link form should work as expected', async () => {
    await act(async () => {
      render(<ImageComponent {...mockNodeViewProps} />);
    });

    const imageNode = screen.getByTestId('uploaded-image-node');

    await act(async () => {
      userEvent.click(imageNode);
    });

    const embedLinkTab = screen.getByText('label.embed-link');

    await act(async () => {
      userEvent.click(embedLinkTab);
    });

    const embedInput = screen.getByTestId('embed-input');

    await act(async () => {
      userEvent.type(embedInput, 'https://open-metadata.org/images/omd-logo');
    });

    const embedButton = screen.getByText('label.embed-image');

    await act(async () => {
      userEvent.click(embedButton);
    });

    expect(mockUpdateAttributes).toHaveBeenCalledWith({
      src: 'https://open-metadata.org/images/omd-logo',
    });
  });

  it('should delete the node when the delete button is clicked', async () => {
    await act(async () => {
      render(<ImageComponent {...mockNodeViewProps} />);
    });

    const imageNode = screen.getByTestId('uploaded-image-node');

    await act(async () => {
      userEvent.click(imageNode);
    });

    const deleteButton = screen.getByText('label.delete');

    await act(async () => {
      userEvent.click(deleteButton);
    });

    expect(mockDeleteNode).toHaveBeenCalled();
  });
});

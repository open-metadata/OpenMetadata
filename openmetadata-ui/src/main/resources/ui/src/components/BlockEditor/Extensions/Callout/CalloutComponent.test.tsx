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
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeViewProps } from '@tiptap/core';
import CalloutComponent from './CalloutComponent';

const mockNode = {
  attrs: {
    calloutType: 'info',
  },
} as unknown as NodeViewProps['node'];

const mockExtension = {
  name: 'callout',
} as unknown as NodeViewProps['extension'];

const mockUpdateAttributes = jest.fn();

const mockNodeViewProps = {
  node: mockNode,
  extension: mockExtension,
  updateAttributes: mockUpdateAttributes,
  editor: {
    isEditable: true,
  },
} as unknown as NodeViewProps;

describe('CalloutComponent', () => {
  it('should render without crashing', async () => {
    await act(async () => {
      render(<CalloutComponent {...mockNodeViewProps} />);
    });

    const calloutNode = screen.getByTestId('callout-node');

    expect(calloutNode).toBeInTheDocument();
    expect(calloutNode).toHaveAttribute('data-type', 'callout');

    expect(screen.getByTestId('callout-info-btn')).toBeInTheDocument();

    expect(screen.getByTestId('callout-content')).toBeInTheDocument();
  });

  it('should render the popover when callout button is clicked', async () => {
    await act(async () => {
      render(<CalloutComponent {...mockNodeViewProps} />);
    });

    const calloutButton = screen.getByTestId('callout-info-btn');

    fireEvent.click(calloutButton);

    const popover = screen.getByRole('tooltip');

    expect(popover).toBeInTheDocument();

    expect(screen.getByTestId('callout-info')).toBeInTheDocument();
    expect(screen.getByTestId('callout-warning')).toBeInTheDocument();
    expect(screen.getByTestId('callout-note')).toBeInTheDocument();
    expect(screen.getByTestId('callout-danger')).toBeInTheDocument();
  });

  it('should not render the popover when callout button is clicked and editor is not editable', async () => {
    const nodeViewProps = {
      node: mockNode,
      extension: mockExtension,
      updateAttributes: mockUpdateAttributes,
      editor: {
        isEditable: false,
      },
    } as unknown as NodeViewProps;

    await act(async () => {
      render(<CalloutComponent {...nodeViewProps} />);
    });

    const calloutButton = screen.getByTestId('callout-info-btn');

    await act(async () => {
      userEvent.click(calloutButton);
    });

    const popover = screen.queryByRole('tooltip');

    expect(popover).not.toBeInTheDocument();
  });
});

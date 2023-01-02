/*
 *  Copyright 2022 Collate.
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

import {
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeedCardBody from './FeedCardBody';

const mockCancel = jest.fn();

const mockUpdate = jest.fn();

jest.mock('../../../../utils/FeedUtils', () => ({
  getFrontEndFormat: jest.fn(),
  MarkdownToHTMLConverter: {
    makeHtml: jest.fn().mockReturnValue('html string'),
  },
}));

jest.mock('../../../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichText Preview</p>);
});

jest.mock('../../ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockImplementation(({ editAction }) => {
    return <div data-testid="editor">{editAction}</div>;
  });
});

const mockFeedCardBodyProps = {
  isAuthor: true,
  message: 'xyz',
  threadId: 'id1',
  postId: 'id2',
  deletePostHandler: jest.fn(),
  onConfirmation: jest.fn(),
  reactions: [],
  onReactionSelect: jest.fn(),
  isEditPost: false,
  onPostUpdate: mockUpdate,
  onCancelPostUpdate: mockCancel,
};

describe('Test FeedCardBody component', () => {
  it('Check if FeedCardBody has all the child elements', async () => {
    const { container } = render(<FeedCardBody {...mockFeedCardBodyProps} />, {
      wrapper: MemoryRouter,
    });

    const messagePreview = await findByText(container, /RichText Preview/i);

    expect(messagePreview).toBeInTheDocument();
  });

  it('Should render editor if editpost is true', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} isEditPost />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editor = await findByTestId(container, 'editor');

    const cancelButton = await findByTestId(container, 'cancel-button');

    const saveButton = await findByTestId(container, 'save-button');

    expect(editor).toBeInTheDocument();

    expect(cancelButton).toBeInTheDocument();

    expect(saveButton).toBeInTheDocument();
  });

  it('Cancel button should work', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} isEditPost />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editor = await findByTestId(container, 'editor');

    const cancelButton = await findByTestId(container, 'cancel-button');

    expect(editor).toBeInTheDocument();

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    expect(mockCancel).toHaveBeenCalled();
  });

  it('Save button should work', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} isEditPost />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editor = await findByTestId(container, 'editor');

    const saveButton = await findByTestId(container, 'save-button');

    expect(editor).toBeInTheDocument();

    expect(saveButton).toBeInTheDocument();

    fireEvent.click(saveButton);

    expect(mockUpdate).toHaveBeenCalledWith('xyz');
  });

  it('Save button should be disable if message is empty', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} isEditPost message="" />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editor = await findByTestId(container, 'editor');

    const saveButton = await findByTestId(container, 'save-button');

    expect(editor).toBeInTheDocument();

    expect(saveButton).toBeInTheDocument();

    expect(saveButton).toBeDisabled();
  });
});

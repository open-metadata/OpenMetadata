/*
 *  Copyright 2021 Collate
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
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeedCardBody from './FeedCardBody';

jest.mock('../../../utils/FeedUtils', () => ({
  getFrontEndFormat: jest.fn(),
}));

jest.mock('../../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichText Preview</p>);
});

const mockFeedCardBodyProps = {
  isAuthor: true,
  message: 'xyz',
  threadId: 'id1',
  postId: 'id2',
  deletePostHandler: jest.fn(),
  onConfirmation: jest.fn(),
};

describe('Test FeedCardBody component', () => {
  it('Check if FeedCardBody has all the child elements', async () => {
    const { container } = render(<FeedCardBody {...mockFeedCardBodyProps} />, {
      wrapper: MemoryRouter,
    });

    const messagePreview = await findByText(container, /RichText Preview/i);
    const deleteButton = await findByTestId(container, 'delete-button');

    expect(messagePreview).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it('Check if FeedCardBody has isAuthor as false', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} isAuthor={false} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const deleteButton = queryByTestId(container, 'delete-button');

    expect(deleteButton).not.toBeInTheDocument();
  });

  it('Check if FeedCardBody has onConfirmation as undefined', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} onConfirmation={undefined} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const deleteButton = queryByTestId(container, 'delete-button');

    expect(deleteButton).not.toBeInTheDocument();
  });

  it('Check if FeedCardBody has postId as undefined', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} postId={undefined} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const deleteButton = queryByTestId(container, 'delete-button');

    expect(deleteButton).not.toBeInTheDocument();
  });

  it('Check if FeedCardBody has threadId as undefined', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} threadId={undefined} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const deleteButton = queryByTestId(container, 'delete-button');

    expect(deleteButton).not.toBeInTheDocument();
  });

  it('Check if FeedCardBody has postId, threadId and deletePostHandler as undefined and isAuthor as false', async () => {
    const { container } = render(
      <FeedCardBody {...mockFeedCardBodyProps} threadId={undefined} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const deleteButton = queryByTestId(container, 'delete-button');

    expect(deleteButton).not.toBeInTheDocument();
  });
});

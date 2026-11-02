/*
 *  Copyright 2026 Collate.
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
import { useEffect, useState } from 'react';
import { Conversation } from '../../../../generated/entity/feed/conversation';
import FeedCardBodyNew from './FeedCardBodyNew';

const mockPreview = jest.fn();

jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn().mockImplementation(() => mockPreview())
);

jest.mock('../../../common/DeferredWidget/DeferredWidget.component', () =>
  jest.fn().mockImplementation(({ children }) => children)
);

const PreviewFilledLater = () => {
  const [text, setText] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setText('Late description'), 100);

    return () => clearTimeout(timer);
  }, []);

  return <p>{text}</p>;
};

const renderBody = () =>
  render(
    <FeedCardBodyNew
      feed={{ message: 'Description' } as Conversation}
      isEditPost={false}
      message="Description"
    />
  );

const expectPreviewShown = (content: HTMLElement) => {
  expect(screen.queryByTestId('feed-message-skeleton')).not.toBeInTheDocument();
  expect(content.parentElement).not.toHaveClass('tw:hidden');
};

describe('FeedCardBodyNew message preview', () => {
  it('replaces the skeleton once text content renders', async () => {
    mockPreview.mockReturnValue(<p>Rendered description</p>);

    renderBody();

    expectPreviewShown(await screen.findByText('Rendered description'));
  });

  it('replaces the skeleton when the preview renders only an image', async () => {
    mockPreview.mockReturnValue(<img alt="" data-testid="preview-image" />);

    renderBody();

    expectPreviewShown(await screen.findByTestId('preview-image'));
  });

  it('keeps the skeleton while the preview is empty and swaps once it fills in', async () => {
    mockPreview.mockImplementation(() => <PreviewFilledLater />);

    renderBody();

    // The message text stays readable while the preview is still loading.
    expect(
      await screen.findByTestId('feed-message-skeleton')
    ).toHaveTextContent('Description');

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expectPreviewShown(await screen.findByText('Late description'));
  });
});

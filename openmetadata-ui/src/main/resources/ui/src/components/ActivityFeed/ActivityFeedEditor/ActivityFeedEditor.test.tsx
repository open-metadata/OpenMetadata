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

import { findByTestId, render } from '@testing-library/react';
import { forwardRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import ActivityFeedEditor from './ActivityFeedEditor';

const onSave = jest.fn();

const onSaveHandler = jest.fn().mockImplementation(() => {
  onSave();
});

jest.mock('../../../utils/FeedUtils', () => ({
  getBackendFormat: jest.fn(),
  HTMLToMarkdown: jest.fn().mockReturnValue({ turndown: jest.fn() }),
}));

jest.mock('../FeedEditor/FeedEditor', () => ({
  __esModule: true,
  FeedEditor: forwardRef(
    jest.fn().mockImplementation(({ onChangeHandler, onSave }, ref) => {
      return (
        <div
          data-testid="feed-editor"
          ref={ref}
          onChange={onChangeHandler}
          onClick={onSave}>
          FeedEditor
        </div>
      );
    })
  ),
}));

jest.mock('./SendButton', () => ({
  SendButton: jest.fn().mockImplementation(({ buttonClass }) => {
    return (
      <button
        className={buttonClass}
        data-testid="send-button"
        onClick={onSaveHandler}>
        send button
      </button>
    );
  }),
}));

const mockProp = {
  buttonClass: '',
  onSave,
  placeHolder: '',
  defaultValue: '',
};

describe('Test Activity Feed Editor Component', () => {
  it('Check if FeedEditor has all child elements', async () => {
    const { container } = render(<ActivityFeedEditor {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const editor = await findByTestId(container, 'feed-editor');
    const sendButton = await findByTestId(container, 'send-button');

    expect(editor).toBeInTheDocument();
    expect(sendButton).toBeInTheDocument();
  });
});

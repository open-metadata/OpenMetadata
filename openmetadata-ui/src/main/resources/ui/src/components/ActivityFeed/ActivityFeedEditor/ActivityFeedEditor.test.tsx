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

import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ActivityFeedEditor from './ActivityFeedEditor';

jest.mock('../../../utils/FeedUtils', () => ({
  getBackendFormat: jest.fn(),
  HTMLToMarkdown: jest.fn().mockReturnValue({ turndown: jest.fn() }),
}));

jest.mock('../../FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});

describe('Test Activity Feed Editor Component', () => {
  it('Check if FeedEditor has all child elements', async () => {
    const { container } = render(<ActivityFeedEditor />, {
      wrapper: MemoryRouter,
    });

    const editor = await findByText(container, /FeedEditor/i);
    const sendButton = await findByTestId(container, 'send-button');

    expect(editor).toBeInTheDocument();
    expect(sendButton).toBeInTheDocument();
  });
});

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

import { act, findAllByText, render, screen } from '@testing-library/react';
import ReactDOM from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import ActivityThreadPanel from './ActivityThreadPanel';

const mockActivityThreadPanelProp = {
  threadLink: '',
  onCancel: jest.fn(),
  open: true,
  postFeedHandler: jest.fn(),
  createThread: jest.fn(),
  deletePostHandler: jest.fn(),
  updateThreadHandler: jest.fn(),
};

jest.mock('../../../rest/feedsAPI', () => ({
  getAllFeeds: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedEditor</p>);
});
jest.mock('../ActivityFeedPanel/FeedPanelHeader', () => {
  return jest.fn().mockReturnValue(<p>FeedPanelHeader</p>);
});

jest.mock('./ActivityThread', () => {
  return jest.fn().mockReturnValue(<p>ActivityThread</p>);
});
jest.mock('./ActivityThreadList', () => {
  return jest.fn().mockReturnValue(<p>ActivityThreadList</p>);
});

describe('Test ActivityThreadPanel Component', () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ReactDOM.createPortal = jest.fn().mockImplementation((element, _node) => {
      return element;
    });
  });

  it('Check if it has all child elements', async () => {
    const { container } = render(
      <ActivityThreadPanel {...mockActivityThreadPanelProp} />,
      { wrapper: MemoryRouter }
    );

    const panelThreadList = await findAllByText(
      container,
      /ActivityThreadList/i
    );

    expect(panelThreadList).toHaveLength(1);
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    await act(async () => {
      render(<ActivityThreadPanel {...mockActivityThreadPanelProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const obServerElement = await screen.findByTestId('observer-element');

    expect(obServerElement).toBeInTheDocument();
  });
});

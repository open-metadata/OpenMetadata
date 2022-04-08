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
import ActivityThreadPanel from './ActivityThreadPanel';

const mockActivityThreadPanelProp = {
  threadLink: '',
  onCancel: jest.fn(),
  open: true,
  postFeedHandler: jest.fn(),
  createThread: jest.fn(),
  deletePostHandler: jest.fn(),
};

jest.mock('../../../axiosAPIs/feedsAPI', () => ({
  getAllFeeds: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedEditor</p>);
});
jest.mock('../ActivityFeedPanel/FeedPanelHeader', () => {
  return jest.fn().mockReturnValue(<p>FeedPanelHeader</p>);
});
jest.mock('../ActivityFeedPanel/FeedPanelOverlay', () => {
  return jest.fn().mockReturnValue(<p>FeedPanelOverlay</p>);
});
jest.mock('../DeleteConfirmationModal/DeleteConfirmationModal', () => {
  return jest.fn().mockReturnValue(<p>DeleteConfirmationModal</p>);
});
jest.mock('./ActivityThread', () => {
  return jest.fn().mockReturnValue(<p>ActivityThread</p>);
});
jest.mock('./ActivityThreadList', () => {
  return jest.fn().mockReturnValue(<p>ActivityThreadList</p>);
});

const mockObserve = jest.fn();
const mockunObserve = jest.fn();

window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockunObserve,
}));

describe('Test ActivityThreadPanel Component', () => {
  it('Check if it has all child elements', async () => {
    const { container } = render(
      <ActivityThreadPanel {...mockActivityThreadPanelProp} />,
      { wrapper: MemoryRouter }
    );
    const panelOverlay = await findByText(container, /FeedPanelOverlay/i);
    const panelHeader = await findByText(container, /FeedPanelHeader/i);
    const panelThreadList = await findByText(container, /ActivityThreadList/i);

    expect(panelOverlay).toBeInTheDocument();
    expect(panelHeader).toBeInTheDocument();
    expect(panelThreadList).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    const { container } = render(
      <ActivityThreadPanel {...mockActivityThreadPanelProp} />,
      { wrapper: MemoryRouter }
    );

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();

    expect(mockObserve).toHaveBeenCalled();
  });
});

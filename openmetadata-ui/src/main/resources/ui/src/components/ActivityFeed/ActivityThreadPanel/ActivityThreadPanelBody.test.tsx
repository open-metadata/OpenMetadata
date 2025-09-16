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

import { findByTestId, findByText, render } from '@testing-library/react';
import ReactDOM from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import { ThreadType } from '../../../generated/entity/feed/thread';
import ActivityThreadPanelBody from './ActivityThreadPanelBody';

const mockActivityThreadPanelBodyBodyProp = {
  threadLink: '',
  onCancel: jest.fn(),
  postFeedHandler: jest.fn(),
  createThread: jest.fn(),
  deletePostHandler: jest.fn(),
  updateThreadHandler: jest.fn(),
  threadType: ThreadType.Conversation,
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

describe('Test ActivityThreadPanelBodyBody Component', () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ReactDOM.createPortal = jest.fn().mockImplementation((element, _node) => {
      return element;
    });
  });

  it('Check if it has all child elements', async () => {
    const { container } = render(
      <ActivityThreadPanelBody {...mockActivityThreadPanelBodyBodyProp} />,
      { wrapper: MemoryRouter }
    );

    const panelHeader = await findByText(container, /FeedPanelHeader/i);
    const panelThreadList = await findByText(container, /ActivityThreadList/i);

    expect(panelHeader).toBeInTheDocument();
    expect(panelThreadList).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    const { container } = render(
      <ActivityThreadPanelBody {...mockActivityThreadPanelBodyBodyProp} />,
      { wrapper: MemoryRouter }
    );

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();
  });
});

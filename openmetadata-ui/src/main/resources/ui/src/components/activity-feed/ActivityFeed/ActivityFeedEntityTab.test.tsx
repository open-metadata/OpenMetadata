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
import { fireEvent, render, screen } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import ActivityFeedEntityTab from './ActivityFeedEntityTab';

const TABLE_LINK = '<#E::table::svc.db.schema.customers>';
let mockIsAiMode = true;
let mockSubTab: string | undefined;

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockIsAiMode,
}));

jest.mock('react-router-dom', () => ({
  useParams: () => ({ subTab: mockSubTab }),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: () => <div data-testid="legacy-tab" />,
  })
);

jest.mock('./ActivityFeed', () => ({
  __esModule: true,
  default: ({
    entityLink,
    defaultView,
    onTaskChange,
  }: {
    entityLink: string;
    defaultView: string;
    onTaskChange: () => void;
  }) => (
    <button
      data-link={entityLink}
      data-testid="activity-feed"
      data-view={defaultView}
      onClick={onTaskChange}>
      feed
    </button>
  ),
}));

const renderTab = (entityLink = TABLE_LINK) => {
  const props = {
    entityLink,
    entityType: EntityType.TABLE as const,
    onFeedUpdate: jest.fn(),
    onUpdateEntityDetails: jest.fn(),
  };
  render(<ActivityFeedEntityTab {...props} />);

  return props;
};

describe('ActivityFeedEntityTab', () => {
  beforeEach(() => {
    mockIsAiMode = true;
    mockSubTab = undefined;
  });

  it("shows the Inbox's feed for the entity in AI mode", () => {
    renderTab();

    expect(screen.getByTestId('activity-feed')).toHaveAttribute(
      'data-link',
      TABLE_LINK
    );
    expect(screen.queryByTestId('legacy-tab')).not.toBeInTheDocument();
  });

  it('keeps the existing tab outside AI mode', () => {
    mockIsAiMode = false;
    renderTab();

    expect(screen.getByTestId('legacy-tab')).toBeInTheDocument();
  });

  // The page has not read its entity yet.
  it('keeps the existing tab until there is a link', () => {
    renderTab('');

    expect(screen.getByTestId('legacy-tab')).toBeInTheDocument();
  });

  it('opens on Tasks from the tasks route', () => {
    mockSubTab = 'tasks';
    renderTab();

    expect(screen.getByTestId('activity-feed')).toHaveAttribute(
      'data-view',
      'tasks'
    );
  });

  // A resolved task can change the entity and the tab's count.
  it('refreshes the page after a task changes', () => {
    const { onFeedUpdate, onUpdateEntityDetails } = renderTab();

    fireEvent.click(screen.getByTestId('activity-feed'));

    expect(onUpdateEntityDetails).toHaveBeenCalled();
    expect(onFeedUpdate).toHaveBeenCalled();
  });
});

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
const mockNavigate = jest.fn();

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockIsAiMode,
}));

jest.mock('react-router-dom', () => ({
  useParams: () => ({ subTab: mockSubTab }),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: (type: string, fqn: string, tab: string, subTab: string) =>
      `/${type}/${fqn}/${tab}/${subTab}`,
  },
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
    view,
    onTaskChange,
    onViewChange,
  }: {
    entityLink: string;
    view: string;
    onTaskChange: () => void;
    onViewChange: (view: string) => void;
  }) => (
    <div data-link={entityLink} data-testid="activity-feed" data-view={view}>
      <button onClick={onTaskChange}>task-changed</button>
      <button onClick={() => onViewChange('tasks')}>to-tasks</button>
    </div>
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
    mockNavigate.mockClear();
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

    fireEvent.click(screen.getByText('task-changed'));

    expect(onUpdateEntityDetails).toHaveBeenCalled();
    expect(onFeedUpdate).toHaveBeenCalled();
  });

  // The route names the view, so a switch is a link others can open.
  it('puts the chosen view in the route', () => {
    renderTab();

    expect(screen.getByTestId('activity-feed')).toHaveAttribute(
      'data-view',
      'activity'
    );

    fireEvent.click(screen.getByText('to-tasks'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/table/svc.db.schema.customers/activity_feed/tasks',
      { replace: true }
    );
  });
});

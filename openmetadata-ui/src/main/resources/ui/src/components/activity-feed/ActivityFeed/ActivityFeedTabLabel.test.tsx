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
import { render, screen } from '@testing-library/react';
import ActivityFeedTabLabel from './ActivityFeedTabLabel';

const TABLE_LINK = '<#E::table::svc.db.schema.customers>';
let mockIsAiMode = true;
const mockUseActivityFeedCounts = jest.fn();

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockIsAiMode,
}));

let mockTaskStatus = 'open';

jest.mock('./useTaskStatusParam', () => ({
  useTaskStatusParam: () => [mockTaskStatus, jest.fn()],
}));

jest.mock('./useActivityFeedCounts', () => ({
  useActivityFeedCounts: (...args: unknown[]) =>
    mockUseActivityFeedCounts(...args),
}));

jest.mock('../../common/TabsLabel/TabsLabel.component', () => ({
  __esModule: true,
  default: ({ name, count }: { name: string; count?: number }) => (
    <span data-testid="tab-label">{`${name}:${count ?? 'none'}`}</span>
  ),
}));

const renderLabel = (entityLink = TABLE_LINK) =>
  render(
    <ActivityFeedTabLabel
      count={40}
      entityLink={entityLink}
      id="activity_feed"
      name="Activity"
    />
  );

describe('ActivityFeedTabLabel', () => {
  beforeEach(() => {
    mockIsAiMode = true;
    mockTaskStatus = 'open';
    mockUseActivityFeedCounts.mockReturnValue({
      activityCount: { total: 20, isCapped: false },
      taskCounts: { all: 27, open: 19, closed: 8 },
    });
  });

  it('counts what the feed shows in AI mode: its cards and open tasks', () => {
    renderLabel();

    expect(screen.getByTestId('tab-label')).toHaveTextContent('Activity:39');
    expect(mockUseActivityFeedCounts).toHaveBeenCalledWith(
      TABLE_LINK,
      expect.objectContaining({
        startTs: expect.any(Number),
        endTs: expect.any(Number),
      })
    );
  });

  // The Tasks view's Status is in the URL, so the page's count follows it.
  it('counts the tasks of the chosen Status', () => {
    mockTaskStatus = 'closed';
    renderLabel();

    expect(screen.getByTestId('tab-label')).toHaveTextContent('Activity:28');
  });

  it('shows no count until the activity arrives', () => {
    mockUseActivityFeedCounts.mockReturnValue({
      activityCount: undefined,
      taskCounts: { all: 0, open: 0, closed: 0 },
    });
    renderLabel();

    expect(screen.getByTestId('tab-label')).toHaveTextContent('Activity:none');
  });

  it("keeps the page's count outside AI mode", () => {
    mockIsAiMode = false;
    renderLabel();

    expect(screen.getByTestId('tab-label')).toHaveTextContent('Activity:40');
    expect(mockUseActivityFeedCounts).not.toHaveBeenCalled();
  });

  it("keeps the page's count until the entity is read", () => {
    renderLabel('');

    expect(screen.getByTestId('tab-label')).toHaveTextContent('Activity:40');
    expect(mockUseActivityFeedCounts).not.toHaveBeenCalled();
  });
});

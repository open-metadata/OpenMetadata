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
import {
  OwnedAndFollowed,
  TrackedAsset,
  useOwnedAndFollowed,
} from '../../../../hooks/useOwnedAndFollowed';
import YoursAndFollowedWidget from './YoursAndFollowedWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../Common/TopicWidget/TopicCard', () => ({
  __esModule: true,
  default: ({
    action,
    children,
    emptyState,
    isError,
    status,
    summary,
  }: {
    action?: { label: string; onPress: () => void };
    children?: React.ReactNode;
    emptyState?: { title: string; action?: { label: string } };
    isError?: boolean;
    status?: { label: string };
    summary: React.ReactNode;
  }) => (
    <section>
      <p data-testid="summary">{summary}</p>
      {status && <span data-testid="status">{status.label}</span>}
      {action && (
        <button data-testid="action" onClick={action.onPress}>
          {action.label}
        </button>
      )}
      {isError && <span data-testid="card-error" />}
      {emptyState && <div data-testid="empty-state">{emptyState.title}</div>}
      {children}
    </section>
  ),
}));

jest.mock('../Common/TopicWidget/TrackedAssetList', () => ({
  __esModule: true,
  default: ({
    assets,
    dataTestId,
  }: {
    assets: TrackedAsset[];
    dataTestId: string;
  }) => (
    <ul data-testid={dataTestId}>
      {assets.map((asset) => (
        <li key={asset.id}>{asset.name}</li>
      ))}
    </ul>
  ),
}));

jest.mock('../../../../hooks/useOwnedAndFollowed', () => ({
  useOwnedAndFollowed: jest.fn(),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn((selector) =>
    selector({ currentUser: { id: 'user-1', name: 'ada' } })
  ),
}));

const mockHook = useOwnedAndFollowed as jest.MockedFunction<
  typeof useOwnedAndFollowed
>;

const asset = (id: string): TrackedAsset => ({
  entityType: 'table',
  fullyQualifiedName: id,
  hasChanged: false,
  id,
  name: id,
});

const STATE: OwnedAndFollowed = {
  changedCount: 12,
  followed: [asset('f1'), asset('f2')],
  followedTotal: 48,
  isError: false,
  isLoading: false,
  owned: [asset('o1')],
  ownedTotal: 31,
  refetch: jest.fn(),
};

const renderWidget = (state: Partial<OwnedAndFollowed> = {}) => {
  mockHook.mockReturnValue({ ...STATE, ...state });

  return render(
    <YoursAndFollowedWidget widgetKey="KnowledgePanel.YoursAndFollowed-1" />
  );
};

describe('YoursAndFollowedWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  // The counts used to be the length of the five-row page on screen.
  it('reports the real totals, not the rows on screen', () => {
    renderWidget();

    expect(
      screen.getByTestId('yours-and-followed-filter-owned-count')
    ).toHaveTextContent('31');
    expect(
      screen.getByTestId('yours-and-followed-filter-following-count')
    ).toHaveTextContent('48');
    expect(screen.getByTestId('summary')).toHaveTextContent(
      'message.count-followed-assets-changed {"count":12}'
    );
    expect(screen.getByTestId('status')).toHaveTextContent(
      'message.count-changed {"count":12}'
    );
  });

  it('lists the owned assets and opens them on the user profile', () => {
    renderWidget();

    expect(screen.getByTestId('owned-assets')).toHaveTextContent('o1');
    expect(screen.queryByTestId('followed-assets')).toBeNull();

    fireEvent.click(screen.getByTestId('action'));

    expect(mockNavigate).toHaveBeenCalledWith('/users/ada/mydata');
  });

  // The footer used to navigate to the landing page it is already on.
  it('switches to the followed assets and opens them on the user profile', () => {
    renderWidget();

    fireEvent.click(screen.getByTestId('yours-and-followed-filter-following'));

    expect(screen.getByTestId('followed-assets')).toHaveTextContent('f1f2');
    expect(screen.queryByTestId('owned-assets')).toBeNull();

    fireEvent.click(screen.getByTestId('action'));

    expect(mockNavigate).toHaveBeenCalledWith('/users/ada/following');
  });

  it('opens on the followed assets when the user owns nothing', () => {
    renderWidget({ owned: [], ownedTotal: 0 });

    expect(screen.getByTestId('followed-assets')).toBeInTheDocument();
    expect(screen.queryByTestId('owned-assets')).toBeNull();
  });

  it('shows the empty state when the user owns and follows nothing', () => {
    renderWidget({
      changedCount: 0,
      followed: [],
      followedTotal: 0,
      owned: [],
      ownedTotal: 0,
    });

    expect(screen.getByTestId('empty-state')).toHaveTextContent(
      'message.nothing-owned-or-followed-yet'
    );
    expect(screen.queryByTestId('status')).toBeNull();
    expect(screen.queryByTestId('yours-and-followed-filter-chips')).toBeNull();
  });

  it('hands the card its error and withholds the counts', () => {
    renderWidget({ isError: true });

    expect(screen.getByTestId('card-error')).toBeInTheDocument();
    expect(screen.queryByTestId('status')).toBeNull();
    expect(screen.queryByTestId('yours-and-followed-filter-chips')).toBeNull();
    expect(screen.queryByTestId('owned-assets')).toBeNull();
  });
});

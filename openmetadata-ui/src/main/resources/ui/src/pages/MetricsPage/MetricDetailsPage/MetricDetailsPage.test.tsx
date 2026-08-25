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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MetricDetailsProps } from '../../../components/Metric/MetricDetails/MetricDetails.interface';
import { ROUTES } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import {
  addMetricFollower,
  getMetricByFqn,
  patchMetric,
  removeMetricFollower,
  restoreMetric,
} from '../../../rest/metricsAPI';
import { METRIC_DEFAULT_FIELDS } from '../../../rest/queries/metricQuery';
import { addToRecentViewed } from '../../../utils/RecentActivityUtils';
import { getVersionPath } from '../../../utils/RouterUtils';
import MetricDetailsPage from './MetricDetailsPage';

const mockNavigate = jest.fn();
const mockGetEntityPermissionByFqn = jest.fn();
const mockShowErrorToast = jest.fn();
const mockMetricDetails = jest.fn();

const currentUser = {
  id: 'current-user',
  name: 'current-user',
  email: 'current@example.com',
};

const metric: Metric = {
  id: 'metric-id',
  name: 'gross_margin',
  displayName: 'Gross Margin',
  fullyQualifiedName: 'finance.gross_margin',
  description: 'Approved description',
  version: 1.2,
  followers: [],
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => ({ fqn: 'finance.gross_margin' }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
  }),
}));

jest.mock('../../../rest/metricsAPI', () => ({
  addMetricFollower: jest.fn(),
  getMetricByFqn: jest.fn(),
  patchMetric: jest.fn(),
  removeMetricFollower: jest.fn(),
  restoreMetric: jest.fn(),
}));

jest.mock('../../../utils/RecentActivityUtils', () => ({
  addToRecentViewed: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

jest.mock('../../../components/Metric/MetricDetails/MetricDetails', () => ({
  __esModule: true,
  default: (props: MetricDetailsProps) => {
    mockMetricDetails(props);

    return (
      <div data-testid="metric-details">
        <span data-testid="metric-description">
          {props.metricDetails.description}
        </span>
        <span data-testid="metric-followers">
          {props.metricDetails.followers?.length ?? 0}
        </span>
        <button
          onClick={() => void props.onFollowMetric().catch(() => undefined)}>
          follow
        </button>
        <button
          onClick={() => void props.onUnFollowMetric().catch(() => undefined)}>
          unfollow
        </button>
        <button
          onClick={() =>
            void props
              .onMetricUpdate(
                {
                  ...props.metricDetails,
                  description: 'Updated description',
                },
                'description'
              )
              .catch(() => undefined)
          }>
          update
        </button>
        <button
          onClick={() => void props.onRestoreMetric().catch(() => undefined)}>
          restore
        </button>
        <button onClick={() => props.onDeleteMetric(true)}>soft delete</button>
        <button onClick={() => props.onDeleteMetric(false)}>hard delete</button>
        <button onClick={props.onVersionChange}>version</button>
      </div>
    );
  },
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MetricDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MetricDetailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntityPermissionByFqn.mockResolvedValue({
      ViewAll: true,
      ViewBasic: true,
      EditAll: true,
    });
    (getMetricByFqn as jest.Mock).mockResolvedValue(metric);
    (addMetricFollower as jest.Mock).mockResolvedValue(undefined);
    (removeMetricFollower as jest.Mock).mockResolvedValue(undefined);
    (patchMetric as jest.Mock).mockResolvedValue(metric);
    (restoreMetric as jest.Mock).mockResolvedValue(metric);
  });

  it('announces loading until permissions and the Metric are available', () => {
    mockGetEntityPermissionByFqn.mockReturnValue(new Promise(() => undefined));

    renderPage();

    expect(
      screen.getByRole('status', { name: 'label.loading' })
    ).toBeInTheDocument();
  });

  it('loads the complete contract, renders details, and records recent activity', async () => {
    renderPage();

    expect(await screen.findByTestId('metric-details')).toBeInTheDocument();
    expect(getMetricByFqn).toHaveBeenCalledWith('finance.gross_margin', {
      fields: METRIC_DEFAULT_FIELDS,
    });
    expect(METRIC_DEFAULT_FIELDS).toContain('experts');
    expect(METRIC_DEFAULT_FIELDS).toContain('metricGroup');
    expect(mockMetricDetails).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentUser, metricDetails: metric })
    );
    expect(addToRecentViewed).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: EntityType.METRIC,
        fqn: 'finance.gross_margin',
      })
    );
  });

  it('renders not-found and no-view states without mounting details', async () => {
    (getMetricByFqn as jest.Mock).mockRejectedValueOnce({
      response: { status: 404 },
    });
    const missing = renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('metric-details')).not.toBeInTheDocument();

    missing.unmount();

    mockGetEntityPermissionByFqn.mockResolvedValueOnce({
      ViewAll: false,
      ViewBasic: false,
    });
    renderPage();

    expect(
      await screen.findByText('message.no-permission-to-view')
    ).toBeInTheDocument();
    expect(getMetricByFqn).toHaveBeenCalledTimes(1);
  });

  it('routes forbidden fetches to the forbidden page', async () => {
    (getMetricByFqn as jest.Mock).mockRejectedValue({
      response: { status: 403 },
    });

    renderPage();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FORBIDDEN, {
        replace: true,
      })
    );
  });

  it('surfaces permission failures and leaves the page in a safe no-view state', async () => {
    mockGetEntityPermissionByFqn.mockRejectedValue(new Error('denied'));

    renderPage();

    expect(
      await screen.findByText('message.no-permission-to-view')
    ).toBeInTheDocument();
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'server.fetch-entity-permissions-error'
    );
  });

  it('renders a retryable Metric fetch error without duplicating it as a toast', async () => {
    (getMetricByFqn as jest.Mock).mockRejectedValue(new Error('offline'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'server.entity-details-fetch-error'
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.try-again' }));
    await waitFor(() => expect(getMetricByFqn).toHaveBeenCalledTimes(2));

    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it('optimistically follows and rolls back when the mutation fails', async () => {
    let rejectFollow: (error: Error) => void = (_error) => undefined;
    (addMetricFollower as jest.Mock).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFollow = reject;
      })
    );
    renderPage();
    await screen.findByTestId('metric-details');

    fireEvent.click(screen.getByRole('button', { name: 'follow' }));
    await waitFor(() =>
      expect(screen.getByTestId('metric-followers')).toHaveTextContent('1')
    );
    rejectFollow(new Error('follow failed'));
    await waitFor(() =>
      expect(screen.getByTestId('metric-followers')).toHaveTextContent('0')
    );

    expect(addMetricFollower).toHaveBeenCalledWith('metric-id', 'current-user');
    expect(mockShowErrorToast).toHaveBeenCalled();
  });

  it('optimistically unfollows and restores the follower when the mutation fails', async () => {
    const followedMetric = {
      ...metric,
      followers: [{ id: 'current-user', type: 'user' }],
    } as Metric;
    (getMetricByFqn as jest.Mock).mockResolvedValue(followedMetric);
    let rejectUnfollow: (error: Error) => void = (_error) => undefined;
    (removeMetricFollower as jest.Mock).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectUnfollow = reject;
      })
    );
    renderPage();
    await screen.findByTestId('metric-details');

    fireEvent.click(screen.getByRole('button', { name: 'unfollow' }));
    await waitFor(() =>
      expect(screen.getByTestId('metric-followers')).toHaveTextContent('0')
    );
    rejectUnfollow(new Error('unfollow failed'));
    await waitFor(() =>
      expect(screen.getByTestId('metric-followers')).toHaveTextContent('1')
    );

    expect(removeMetricFollower).toHaveBeenCalledWith(
      'metric-id',
      'current-user'
    );
  });

  it('reports patch failures and preserves version navigation', async () => {
    (patchMetric as jest.Mock).mockRejectedValueOnce(new Error('patch failed'));
    renderPage();
    await screen.findByTestId('metric-details');

    fireEvent.click(screen.getByRole('button', { name: 'update' }));
    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    expect(patchMetric).toHaveBeenCalledWith(
      'metric-id',
      expect.arrayContaining([
        expect.objectContaining({
          op: 'replace',
          path: '/description',
          value: 'Updated description',
        }),
      ])
    );

    fireEvent.click(screen.getByRole('button', { name: 'version' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      getVersionPath(EntityType.METRIC, 'finance.gross_margin', '1.2')
    );
  });

  it('restores a deleted Metric and synchronizes the detail cache', async () => {
    const restoredMetric = { ...metric, deleted: false, version: 1.3 };
    (getMetricByFqn as jest.Mock).mockResolvedValue({
      ...metric,
      deleted: true,
    });
    (restoreMetric as jest.Mock).mockResolvedValue(restoredMetric);

    renderPage();
    await screen.findByTestId('metric-details');
    fireEvent.click(screen.getByRole('button', { name: 'restore' }));

    await waitFor(() =>
      expect(restoreMetric).toHaveBeenCalledWith('metric-id')
    );
    await waitFor(() =>
      expect(mockMetricDetails).toHaveBeenLastCalledWith(
        expect.objectContaining({ metricDetails: restoredMetric })
      )
    );
  });

  it('optimistically marks accepted soft deletes and leaves after hard deletes', async () => {
    renderPage();
    await screen.findByTestId('metric-details');

    fireEvent.click(screen.getByRole('button', { name: 'soft delete' }));

    await waitFor(() =>
      expect(mockMetricDetails).toHaveBeenLastCalledWith(
        expect.objectContaining({
          metricDetails: expect.objectContaining({ deleted: true }),
        })
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'hard delete' }));

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.METRICS);
  });
});

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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  PipelineStatus,
  StatusType,
} from '../../../../generated/entity/data/pipeline';
import {
  LastRunStatus,
  PipelineServiceType,
  PipelineSummary,
} from '../../../../generated/type/pipelineSummary';
import {
  ALL_PIPELINES,
  usePipelineRunHistory,
  usePipelineStatus,
} from '../../../../hooks/usePipelineStatus';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import PipelineStatusWidget from './PipelineStatusWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children?: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../../../hooks/usePipelineStatus', () => ({
  ...jest.requireActual('../../../../hooks/usePipelineStatus'),
  usePipelineRunHistory: jest.fn(),
  usePipelineStatus: jest.fn(),
}));

jest.mock('../../../../utils/CustomizeMyDataPageClassBase', () => ({
  __esModule: true,
  default: { getPipelineStatusActionPath: jest.fn() },
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: (_: string, fqn: string) => `/pipeline/${fqn}`,
  getExplorePath: ({ tab }: { tab: string }) => `/explore/${tab}`,
}));

const pipeline = (name: string, lastRunStatus?: LastRunStatus) =>
  ({
    endTime: 1_700_000_128_000,
    impactedAssetsCount: 0,
    lastRunStatus,
    lastRunTime: 1_700_000_000_000,
    pipelineFqn: `airflow.${name}`,
    pipelineId: `id-${name}`,
    pipelineName: name,
    serviceType: PipelineServiceType.Airflow,
    startTime: 1_700_000_000_000,
  } as PipelineSummary);

const FAILED = pipeline('dim_user', LastRunStatus.Failed);
const SKIPPED = pipeline('dim_product', LastRunStatus.Skipped);
const SUCCESSFUL = pipeline('hive_etl', LastRunStatus.Successful);
const NEVER_RUN = pipeline('new_pipeline');

const RUNS: Record<string, PipelineStatus[]> = {
  'airflow.dim_user': [
    { executionStatus: StatusType.Successful, timestamp: 1 },
    {
      error: { errorMessage: 'permission denied for schema analytics' },
      executionStatus: StatusType.Failed,
      timestamp: 2,
    },
  ],
};

const OVERVIEW = {
  counts: {
    [ALL_PIPELINES]: 7,
    [LastRunStatus.Failed]: 1,
    [LastRunStatus.Skipped]: 1,
    [LastRunStatus.Pending]: 0,
    [LastRunStatus.Successful]: 1,
  },
  dataUpdatedAt: 0,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
  rows: {
    [ALL_PIPELINES]: [FAILED, SKIPPED, SUCCESSFUL, NEVER_RUN],
    [LastRunStatus.Failed]: [FAILED],
    [LastRunStatus.Skipped]: [SKIPPED],
    [LastRunStatus.Pending]: [],
    [LastRunStatus.Successful]: [SUCCESSFUL],
  },
};

const renderWidget = (overview: Partial<typeof OVERVIEW> = {}) => {
  (usePipelineStatus as jest.Mock).mockReturnValue({
    ...OVERVIEW,
    ...overview,
  });
  (usePipelineRunHistory as jest.Mock).mockReturnValue(RUNS);

  return render(
    <PipelineStatusWidget widgetKey="KnowledgePanel.PipelineStatus-1" />
  );
};

const rowIds = () =>
  within(screen.getByTestId('pipeline-status-rows'))
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('data-testid'));

describe('PipelineStatusWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('counts failures in the summary and the status chip', () => {
    renderWidget();

    expect(
      screen.getByText(
        'message.count-of-total-pipelines-failed-last-run {"count":1,"total":7}'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('topic-status-pipelineStatus')).toHaveTextContent(
      'message.count-failed-test {"count":1}'
    );
  });

  it('says nothing failed, with no chip, when nothing did', () => {
    renderWidget({
      counts: { ...OVERVIEW.counts, [LastRunStatus.Failed]: 0 },
    });

    expect(
      screen.getByText('message.no-pipeline-failed-last-run {"count":7}')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('topic-status-pipelineStatus')).toBeNull();
  });

  it('lists the hook’s ranked rows, then switches bucket from a chip', () => {
    renderWidget();

    expect(rowIds()).toEqual([
      'pipeline-status-row-id-dim_user',
      'pipeline-status-row-id-dim_product',
      'pipeline-status-row-id-hive_etl',
      'pipeline-status-row-id-new_pipeline',
    ]);

    fireEvent.click(screen.getByTestId('pipeline-status-filter-Skipped'));

    expect(rowIds()).toEqual(['pipeline-status-row-id-dim_product']);
  });

  it('only asks for run history of the rows on screen', () => {
    renderWidget();

    fireEvent.click(screen.getByTestId('pipeline-status-filter-Failed'));

    expect(usePipelineRunHistory).toHaveBeenLastCalledWith([
      'airflow.dim_user',
    ]);
  });

  it('labels each row with its latest status and links to the pipeline', () => {
    renderWidget();

    const failed = screen.getByTestId('pipeline-status-row-id-dim_user');

    expect(
      within(failed).getByTestId('pipeline-status-label')
    ).toHaveTextContent('label.failed');
    expect(within(failed).getByRole('link')).toHaveAttribute(
      'href',
      '/pipeline/airflow.dim_user'
    );
    expect(
      within(
        screen.getByTestId('pipeline-status-row-id-new_pipeline')
      ).getByTestId('pipeline-status-label')
    ).toHaveTextContent('label.not-run-yet');
  });

  it('shows why the latest run failed', () => {
    renderWidget();

    expect(
      within(screen.getByTestId('pipeline-status-row-id-dim_user')).getByTestId(
        'pipeline-status-error'
      )
    ).toHaveTextContent('permission denied for schema analytics');
    expect(
      within(
        screen.getByTestId('pipeline-status-row-id-hive_etl')
      ).queryByTestId('pipeline-status-error')
    ).toBeNull();
  });

  it('draws the run history strip with a spoken summary', () => {
    renderWidget();

    const strip = within(
      screen.getByTestId('pipeline-status-row-id-dim_user')
    ).getByTestId('pipeline-run-history');

    expect(strip).toHaveAttribute('role', 'img');
    expect(strip.getAttribute('aria-label')).toContain(
      'message.last-count-runs-summary'
    );
    expect(
      Array.from(strip.querySelectorAll('[data-status]')).map((bar) =>
        bar.getAttribute('data-status')
      )
    ).toEqual(expect.arrayContaining(['success', 'failed']));
  });

  it('notes how many more pipelines the bucket holds than it lists', () => {
    renderWidget();

    expect(
      screen.getByText('message.count-more-pipelines {"count":3}')
    ).toBeInTheDocument();
  });

  it('opens Explore on the pipelines tab by default', () => {
    renderWidget();

    fireEvent.click(screen.getByTestId('topic-action-pipelineStatus'));

    expect(mockNavigate).toHaveBeenCalledWith('/explore/pipelines');
  });

  it('opens the distribution’s pipeline page when it names one', () => {
    (
      customizeMyDataPageClassBase.getPipelineStatusActionPath as jest.Mock
    ).mockReturnValue('/observability/pipeline');
    renderWidget();

    fireEvent.click(screen.getByTestId('topic-action-pipelineStatus'));

    expect(mockNavigate).toHaveBeenCalledWith('/observability/pipeline');
  });

  it('shows the setup empty state before any pipeline is ingested', () => {
    renderWidget({
      counts: {
        [ALL_PIPELINES]: 0,
        [LastRunStatus.Failed]: 0,
        [LastRunStatus.Skipped]: 0,
        [LastRunStatus.Pending]: 0,
        [LastRunStatus.Successful]: 0,
      },
      rows: {
        [ALL_PIPELINES]: [],
        [LastRunStatus.Failed]: [],
        [LastRunStatus.Skipped]: [],
        [LastRunStatus.Pending]: [],
        [LastRunStatus.Successful]: [],
      },
    });

    expect(
      screen.getByTestId('topic-empty-pipelineStatus')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('pipeline-status-rows')).toBeNull();
  });

  it('shows an error body when the fetch fails', () => {
    renderWidget({ isError: true });

    expect(
      screen.getByTestId('topic-error-pipelineStatus')
    ).toBeInTheDocument();
  });
});

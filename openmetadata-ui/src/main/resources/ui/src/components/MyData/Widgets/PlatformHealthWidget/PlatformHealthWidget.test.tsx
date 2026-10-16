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
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ServiceCategory } from '../../../../enums/service.enum';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import PlatformHealthWidget from './PlatformHealthWidget';
import {
  FailingService,
  IngestionPipelineStats,
  useIngestionPipelineStats,
} from './useIngestionPipelineStats';

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

// A thin stand-in for the shell: these tests are about what the widget hands
// it, and the shell's own rendering has its own tests.
jest.mock('../Common/TopicWidget/TopicCard', () => ({
  __esModule: true,
  default: ({
    action,
    children,
    isError,
    meta,
    status,
    summary,
  }: {
    action?: { label: string };
    children?: React.ReactNode;
    isError?: boolean;
    meta?: React.ReactNode;
    status?: { label: string };
    summary: React.ReactNode;
  }) => (
    <section>
      <p data-testid="summary">{summary}</p>
      {status && <span data-testid="status">{status.label}</span>}
      {meta && <span data-testid="meta">{meta}</span>}
      {action && <span data-testid="action">{action.label}</span>}
      {isError && <span data-testid="card-error" />}
      {children}
    </section>
  ),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(),
}));

jest.mock('./useIngestionPipelineStats', () => ({
  useIngestionPipelineStats: jest.fn(),
}));

jest.mock('../../../../utils/CustomizeMyDataPageClassBase', () => ({
  __esModule: true,
  default: { getPlatformHealthInsight: jest.fn(() => null) },
}));

const mockIsEmbeddedMode = jest.fn(() => false);

jest.mock('../../../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getServiceDetailsPath: () => '/service',
    getSettingsServicesPath: () => '/settings/services',
    isEmbeddedMode: () => mockIsEmbeddedMode(),
  },
}));

jest.mock('../../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: { getServiceLogo: () => 'logo.svg' },
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: (ts: number) => `rel-${ts}`,
}));

const mockStats = useIngestionPipelineStats as jest.MockedFunction<
  typeof useIngestionPipelineStats
>;
const mockPermissions = usePermissionProvider as jest.Mock;

const failing = (id: string): FailingService => ({
  displayName: id,
  fqn: id,
  id,
  lastRunTs: 500,
  name: id,
  pipelineType: PipelineType.Metadata,
  reason: '',
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceType: 'Snowflake',
  state: 'failed',
});

const STATS: IngestionPipelineStats = {
  connectedServices: 25,
  dataUpdatedAt: 9000,
  failedServices: 12,
  failingServices: Array.from({ length: 10 }, (_, i) => failing(`svc-${i}`)),
  healthyServices: 8,
  isError: false,
  isLoading: false,
  pendingServices: 2,
  refetch: jest.fn(),
  warningServices: 3,
};

const VIEW = { ViewAll: true, ViewBasic: true };

const renderWidget = (
  stats: Partial<IngestionPipelineStats> = {},
  ingestionPipeline: Record<string, boolean> = VIEW
) => {
  mockPermissions.mockReturnValue({ permissions: { ingestionPipeline } });
  mockStats.mockReturnValue({ ...STATS, ...stats });

  return render(<PlatformHealthWidget widgetKey="KnowledgePanel.Health-1" />);
};

describe('PlatformHealthWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('permission gate', () => {
    it('opens to a non-admin who may view ingestion pipelines', () => {
      renderWidget({}, { ViewAll: false, ViewBasic: true });

      expect(mockStats).toHaveBeenCalled();
      expect(screen.getByTestId('topic-stat-failing')).toBeInTheDocument();
    });

    it('withholds the card, and the request, without that permission', () => {
      renderWidget({}, { ViewAll: false, ViewBasic: false });

      expect(mockStats).not.toHaveBeenCalled();
      expect(screen.getByTestId('summary')).toHaveTextContent(
        'message.no-permission-to-view'
      );
    });
  });

  describe('failing estate', () => {
    // The rows are only the worst ten; the count is the server's 12 + 3.
    it('counts failing services from the server tally, not the rows fetched', () => {
      renderWidget();

      expect(screen.getByTestId('summary')).toHaveTextContent(
        'message.services-failing-of-total {"count":15,"total":25}'
      );
      expect(screen.getByTestId('topic-stat-failing')).toHaveTextContent(
        'message.count-of-total-failing {"count":15,"total":25}'
      );
      expect(screen.getByTestId('view-all-failing-services')).toHaveTextContent(
        'message.view-all-count-failing-services {"count":15}'
      );
      expect(screen.getByTestId('status')).toHaveTextContent(
        'label.needs-attention'
      );
    });

    it('shows at most three rows', () => {
      renderWidget();

      expect(
        screen.getByTestId('platform-health-rows').querySelectorAll('li')
      ).toHaveLength(3);
    });

    it('reports when the data was read, not when the last failure ran', () => {
      renderWidget();

      expect(screen.getByTestId('meta')).toHaveTextContent(
        'message.updated-relative {"time":"rel-9000"}'
      );
    });
  });

  describe('health links', () => {
    // Settings > Services ignores `health`, so classic mode must not promise a
    // filter the destination drops.
    it('opens the unfiltered services list outside the connections surface', () => {
      renderWidget();

      fireEvent.click(screen.getByTestId('topic-stat-failing'));

      expect(mockNavigate).toHaveBeenCalledWith('/settings/services');
    });

    it('filters the connections listing by health where it is routed', () => {
      mockIsEmbeddedMode.mockReturnValueOnce(true);
      renderWidget();

      fireEvent.click(screen.getByTestId('view-all-failing-services'));

      expect(mockNavigate).toHaveBeenCalledWith(
        '/settings/services?health=failing'
      );
    });
  });

  it('reads healthy when nothing is failing', () => {
    renderWidget({
      failedServices: 0,
      failingServices: [],
      warningServices: 0,
    });

    expect(screen.getByTestId('summary')).toHaveTextContent(
      'message.all-services-healthy {"count":25}'
    );
    expect(screen.queryByTestId('status')).toBeNull();
    expect(screen.queryByTestId('platform-health-rows')).toBeNull();
  });

  // An error used to read as "Needs attention" over "0 of 0 services failing".
  it('gives no health verdict when the fetch fails', () => {
    renderWidget({
      connectedServices: 0,
      failedServices: 0,
      failingServices: [],
      isError: true,
      warningServices: 0,
    });

    expect(screen.getByTestId('card-error')).toBeInTheDocument();
    expect(screen.queryByTestId('status')).toBeNull();
    expect(screen.queryByTestId('meta')).toBeNull();
    expect(screen.queryByTestId('topic-stat-failing')).toBeNull();
    expect(screen.getByTestId('summary')).not.toHaveTextContent(
      'message.services-failing-of-total'
    );
  });

  it('hands the insight block the real warning count', () => {
    const Insight = jest.fn(() => null);
    (
      customizeMyDataPageClassBase.getPlatformHealthInsight as jest.Mock
    ).mockReturnValue(Insight);

    renderWidget();

    expect(Insight).toHaveBeenCalledWith(
      expect.objectContaining({
        failedServices: 12,
        isHealthy: false,
        warningServices: 3,
      }),
      expect.anything()
    );
  });
});

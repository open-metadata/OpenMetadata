/*
 *  Copyright 2025 Collate.
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

import { act, render } from '@testing-library/react';
import { AxiosError } from 'axios';
import { noop } from 'lodash';
import { WorkflowStatus } from '../../generated/governance/workflows/workflowInstance';
import { ServicesType } from '../../interface/service.interface';
import {
  setChartDataStreamConnection,
  stopChartDataStreamConnection,
} from '../../rest/DataInsightAPI';
import ServiceInsightsTab from './ServiceInsightsTab';
import { ServiceInsightsTabProps } from './ServiceInsightsTab.interface';

const SESSION_ID = 'e5f4b0e1-0000-4000-8000-0000000000ff';

jest.mock('../../rest/DataInsightAPI', () => ({
  getMultiChartsPreviewByName: jest.fn().mockResolvedValue({}),
  setChartDataStreamConnection: jest
    .fn()
    .mockResolvedValue({ sessionId: 'e5f4b0e1-0000-4000-8000-0000000000ff' }),
  stopChartDataStreamConnection: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockResolvedValue({ aggregations: { entityType: { buckets: [] } } }),
}));

jest.mock('../../rest/applicationAPI', () => ({
  getAiAutomationRuns: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn().mockReturnValue({ socket: undefined }),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest
    .fn()
    .mockReturnValue({ serviceCategory: 'databaseServices' }),
}));

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: {
    getInsightsTabWidgets: jest.fn().mockReturnValue({
      PlatformInsightsWidget: jest.fn().mockReturnValue(null),
      TotalDataAssetsWidget: jest.fn().mockReturnValue(null),
      AgentsStatusWidget: jest.fn().mockReturnValue(null),
    }),
  },
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: jest.fn().mockReturnValue('<#E::databaseService::test>'),
}));

jest.mock('../../utils/EntityIconUtils', () => ({
  getEntityIcon: jest.fn().mockReturnValue(null),
}));

const mockSetChartDataStreamConnection =
  setChartDataStreamConnection as jest.Mock;
const mockStopChartDataStreamConnection =
  stopChartDataStreamConnection as jest.Mock;

/**
 * Builds a rejected promise that records whether the consumer attached a
 * rejection handler. The tracker's own handler keeps Node from flagging the
 * rejection as unhandled inside the test runner, so `isHandled` reflects only
 * what the component under test did.
 */
const createTrackedRejection = (error: unknown) => {
  const tracker = { isHandled: false };
  const promise = Promise.reject(error);
  const originalCatch = promise.catch.bind(promise);

  originalCatch(noop);

  promise.catch = (onRejected) => {
    tracker.isHandled = true;

    return originalCatch(onRejected);
  };

  return { promise, tracker };
};

const mockProps: ServiceInsightsTabProps = {
  serviceDetails: {
    id: 'a1b2c3d4-0000-4000-8000-00000000000a',
    name: 'oracle-ui-test',
    fullyQualifiedName: 'oracle-ui-test',
  } as ServicesType,
  workflowStatesData: {
    mainInstanceState: { status: WorkflowStatus.Running },
    subInstanceStates: [],
  },
  collateAIagentsList: [],
  ingestionPipelines: [],
  isIngestionPipelineLoading: false,
  isCollateAIagentsLoading: false,
};

const renderTab = async (props?: Partial<ServiceInsightsTabProps>) => {
  let renderResult!: ReturnType<typeof render>;

  await act(async () => {
    renderResult = render(<ServiceInsightsTab {...mockProps} {...props} />);
  });

  return renderResult;
};

describe('ServiceInsightsTab', () => {
  it('should stop the chart data stream with the open session id on unmount', async () => {
    const { unmount } = await renderTab();

    expect(mockSetChartDataStreamConnection).toHaveBeenCalledTimes(1);

    await act(async () => {
      unmount();
    });

    expect(mockStopChartDataStreamConnection).toHaveBeenCalledWith(SESSION_ID);
  });

  it('should handle a rejected stream teardown so unmount raises no unhandled rejection', async () => {
    const { promise, tracker } = createTrackedRejection(
      new AxiosError('Request failed with status code 404')
    );
    mockStopChartDataStreamConnection.mockReturnValueOnce(promise);

    const { unmount } = await renderTab();

    await act(async () => {
      unmount();
    });

    expect(tracker.isHandled).toBe(true);
  });

  it('should handle a rejected stream handshake without an unhandled rejection', async () => {
    // The handshake rejection is swallowed by the async callback wrapper, so it
    // can only be observed through the process-level unhandled rejection hook,
    // which needs real timers to flush
    jest.useRealTimers();

    const unhandledReasons: unknown[] = [];
    const collectUnhandled = (reason: unknown) => unhandledReasons.push(reason);
    process.on('unhandledRejection', collectUnhandled);

    mockSetChartDataStreamConnection.mockRejectedValueOnce(
      new AxiosError('Request failed with status code 404')
    );

    await renderTab();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    process.off('unhandledRejection', collectUnhandled);
    jest.useFakeTimers();

    expect(unhandledReasons).toHaveLength(0);
  });

  it('should not open or close a stream when the workflow is not running', async () => {
    const { unmount } = await renderTab({
      workflowStatesData: {
        mainInstanceState: { status: WorkflowStatus.Finished },
        subInstanceStates: [],
      },
    });

    await act(async () => {
      unmount();
    });

    expect(mockSetChartDataStreamConnection).not.toHaveBeenCalled();
    expect(mockStopChartDataStreamConnection).not.toHaveBeenCalled();
  });
});

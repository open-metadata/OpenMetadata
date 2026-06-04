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

import {
  approveAIAsset,
  getAIGovernanceDashboard,
  getGovernanceActivity,
  getIntakeChecks,
  getPolicyStatus,
  rejectAIAsset,
  shadowBulkTriage,
  submitForReview,
} from './aiGovernanceAPI';
import APIClient from './index';

jest.mock('./index', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const mockedGet = APIClient.get as jest.Mock;
const mockedPost = APIClient.post as jest.Mock;

describe('aiGovernanceAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches intake checks with encoded FQN', async () => {
    const response = { data: { checks: [] } };
    mockedGet.mockResolvedValue(response);

    const result = await getIntakeChecks('aiApplication', 'domain/team app');

    expect(mockedGet).toHaveBeenCalledWith(
      '/aiGovernance/intakeChecks/aiApplication/name/domain%2Fteam%20app'
    );
    expect(result).toEqual(response.data);
  });

  it('posts registration state transitions', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'asset-id' } });

    await submitForReview('aiApplication', 'asset-id');
    await approveAIAsset('mcpServer', 'server-id', 'approved');
    await rejectAIAsset('llmModel', 'model-id', 'missing owner');

    expect(mockedPost).toHaveBeenNthCalledWith(
      1,
      '/aiGovernance/aiApplication/asset-id/submitForReview'
    );
    expect(mockedPost).toHaveBeenNthCalledWith(
      2,
      '/aiGovernance/mcpServer/server-id/approve',
      { comment: 'approved' }
    );
    expect(mockedPost).toHaveBeenNthCalledWith(
      3,
      '/aiGovernance/llmModel/model-id/reject',
      { comment: 'missing owner' }
    );
  });

  it('fetches dashboard, activity, and policy status', async () => {
    mockedGet.mockResolvedValue({ data: {} });

    await getAIGovernanceDashboard();
    await getGovernanceActivity({ entityType: 'aiApplication', limit: 5 });
    await getPolicyStatus('mcpServer', 'server-id');

    expect(mockedGet).toHaveBeenNthCalledWith(1, '/aiGovernance/dashboard');
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/aiGovernance/activity', {
      params: { entityType: 'aiApplication', limit: 5 },
    });
    expect(mockedGet).toHaveBeenNthCalledWith(
      3,
      '/aiGovernance/mcpServer/server-id/policyStatus'
    );
  });

  it('posts shadow bulk triage payload', async () => {
    const request = {
      action: 'Dismiss' as const,
      reason: 'duplicate',
      items: [{ entityType: 'llmModel' as const, id: 'model-id' }],
    };
    mockedPost.mockResolvedValue({ data: { results: [] } });

    await shadowBulkTriage(request);

    expect(mockedPost).toHaveBeenCalledWith(
      '/aiGovernance/shadow/bulkTriage',
      request
    );
  });
});

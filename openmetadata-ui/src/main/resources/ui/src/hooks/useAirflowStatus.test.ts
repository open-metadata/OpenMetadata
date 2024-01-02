/*
 *  Copyright 2023 Collate.
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
import { renderHook } from '@testing-library/react-hooks';

import { PipelineServiceClientResponse } from '../generated/entity/services/ingestionPipelines/pipelineServiceClientResponse';
import { getAirflowStatus } from '../rest/ingestionPipelineAPI';
import { useAirflowStatus } from './useAirflowStatus';

const mockResponse: PipelineServiceClientResponse = {
  code: 200,
  platform: 'Airflow',
  version: '1.0.0.dev01',
};

jest.mock('rest/ingestionPipelineAPI', () => ({
  getAirflowStatus: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockResponse)),
}));

describe('useAirflowStatus', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and update airflow status correctly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAirflowStatus());

    expect(result.current.isFetchingStatus).toBe(true);
    expect(result.current.isAirflowAvailable).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.reason).toBeUndefined();

    await waitForNextUpdate();

    expect(result.current.isFetchingStatus).toBe(false);
    expect(result.current.isAirflowAvailable).toBe(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.reason).toBe(mockResponse.reason);
  });

  it('should handle error case correctly', async () => {
    const mockError = new Error('Airflow status fetch failed');
    (getAirflowStatus as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(mockError)
    );

    const { result, waitForNextUpdate } = renderHook(() => useAirflowStatus());

    expect(result.current.isFetchingStatus).toBe(true);
    expect(result.current.isAirflowAvailable).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.reason).toBeUndefined();

    await waitForNextUpdate();

    expect(result.current.isFetchingStatus).toBe(false);
    expect(result.current.isAirflowAvailable).toBe(false);
    expect(result.current.error).toBe(mockError);
    expect(result.current.reason).toBeUndefined();
  });
});

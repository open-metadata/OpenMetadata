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
  Severities,
  TestCaseResolutionStatus,
} from '../../generated/tests/testCaseResolutionStatus';
import { updateTestCaseIncidentById } from '../../rest/incidentManagerAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { submitIncidentSeverity } from './IncidentManager.utils';

jest.mock('../../rest/incidentManagerAPI', () => ({
  updateTestCaseIncidentById: jest.fn(),
}));

const mockUpdate = updateTestCaseIncidentById as jest.Mock;

const INCIDENT = {
  id: 'incident-1',
  severity: Severities.Severity3,
} as TestCaseResolutionStatus;

describe('submitIncidentSeverity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should send the severity as a patch and say it went through', async () => {
    mockUpdate.mockResolvedValue({});

    await expect(
      submitIncidentSeverity(INCIDENT, Severities.Severity1)
    ).resolves.toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith('incident-1', [
      { op: 'replace', path: '/severity', value: Severities.Severity1 },
    ]);
  });

  it('should toast a failure and say it did not go through', async () => {
    mockUpdate.mockRejectedValue(new Error('failure'));

    await expect(
      submitIncidentSeverity(INCIDENT, Severities.Severity1)
    ).resolves.toBe(false);
    expect(showErrorToast).toHaveBeenCalled();
  });
});

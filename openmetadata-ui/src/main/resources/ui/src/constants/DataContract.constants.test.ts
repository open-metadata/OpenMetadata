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

import { ContractExecutionStatus } from '../generated/type/contractExecutionStatus';
import {
  CONTRACT_EXECUTION_CHART_STATUS,
  DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS,
} from './DataContract.constants';

describe('CONTRACT_EXECUTION_CHART_STATUS', () => {
  it('maps every execution status to a chart status and a label', () => {
    expect(Object.keys(CONTRACT_EXECUTION_CHART_STATUS).sort()).toEqual(
      Object.values(ContractExecutionStatus).sort()
    );
  });

  it.each([
    [ContractExecutionStatus.Success, 'success', 'label.success'],
    [ContractExecutionStatus.Failed, 'failed', 'label.failed'],
    [ContractExecutionStatus.Aborted, 'warning', 'label.aborted'],
    [
      ContractExecutionStatus.PartialSuccess,
      'warning',
      'label.partial-success',
    ],
    [ContractExecutionStatus.Running, 'info', 'label.running'],
    [ContractExecutionStatus.Queued, 'neutral', 'label.queued'],
  ])('%s is drawn as %s and named %s', (executionStatus, status, label) => {
    expect(CONTRACT_EXECUTION_CHART_STATUS[executionStatus]).toEqual({
      status,
      label,
    });
  });
});

describe('DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS', () => {
  it('keeps the bar size in core terms', () => {
    expect(DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS).toEqual({
      barMaxWidth: 12,
      radius: 6,
    });
  });
});

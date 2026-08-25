/*
 *  Copyright 2022 Collate.
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

import { cleanup, render, screen } from '@testing-library/react';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { TestIndicatorProps } from '../../Database/Profiler/TableProfiler/TableProfiler.interface';
import TestIndicator from './TestIndicator';

const mockProps: TestIndicatorProps = {
  value: 0,
  type: TestCaseStatus.Success,
};

describe('Test TestIndicator component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render without crashing', async () => {
    render(<TestIndicator {...mockProps} />);

    const testStatus = await screen.findByTestId('test-status');
    const testValue = await screen.findByTestId('test-value');

    expect(testStatus).toBeInTheDocument();
    expect(testValue).toBeInTheDocument();
  });
});

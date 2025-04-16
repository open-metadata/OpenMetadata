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
import { render, screen } from '@testing-library/react';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import { SummaryPanel } from './SummaryPanel.component';

const testCasePermission = {
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};
const mockSummary = {
  total: 10,
  success: 7,
  aborted: 2,
  failed: 1,
};

jest.mock('../../common/SummaryCard/SummaryCard.component', () => {
  return {
    SummaryCard: jest
      .fn()
      .mockImplementation(() => <div>SummaryCard.component</div>),
  };
});
jest.mock('../../../rest/testAPI', () => {
  return {
    getTestCaseExecutionSummary: jest
      .fn()
      .mockImplementation(() => Promise.resolve(mockSummary)),
  };
});

describe('SummaryPanel component', () => {
  it('component should render', async () => {
    render(<SummaryPanel testSummary={mockSummary} />);

    const summaryCards = await screen.findAllByText('SummaryCard.component');

    expect(summaryCards).toHaveLength(4);
  });

  it('Show additional summary card if showAdditionalSummary is true', async () => {
    render(<SummaryPanel showAdditionalSummary testSummary={mockSummary} />);

    const summaryCards = await screen.findAllByText('SummaryCard.component');

    expect(summaryCards).toHaveLength(6);
  });

  it('should not call getTestCaseExecutionSummary API, if testSummary data is provided', async () => {
    const mockGetTestCaseExecutionSummary =
      getTestCaseExecutionSummary as jest.Mock;
    render(<SummaryPanel testSummary={mockSummary} />);

    expect(mockGetTestCaseExecutionSummary).not.toHaveBeenCalled();
  });

  it('should not call getTestCaseExecutionSummary API, if there is no permission', async () => {
    const mockGetTestCaseExecutionSummary =
      getTestCaseExecutionSummary as jest.Mock;
    testCasePermission.ViewAll = false;
    render(<SummaryPanel testSummary={mockSummary} />);

    expect(mockGetTestCaseExecutionSummary).not.toHaveBeenCalled();
  });
});

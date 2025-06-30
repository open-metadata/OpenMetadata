/*
 *  Copyright 2024 Collate.
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
import { act, render, screen } from '@testing-library/react';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import AddDataQualityTestPage from './AddDataQualityTestPage';

const mockTable = {
  displayName: 'Test Table',
  name: 'test-table',
};

const mockParams = {
  fqn: 'sample_data.ecommerce_db.shopify.dim_address',
  dashboardType: ProfilerDashboardType.TABLE,
};

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTable)),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-fqn' }),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock(
  '../../components/DataQuality/AddDataQualityTest/AddDataQualityTestV1',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="testv1-container">AddDataQualityTestV1</div>
      )),
  })
);

const mockProps = {
  pageTitle: 'add-data-quality-tests',
};

describe('AddDataQualityTestPage', () => {
  it('renders Add DataQuality Test Page', async () => {
    await act(async () => {
      render(<AddDataQualityTestPage {...mockProps} />);
    });

    const testContainer = screen.getByTestId('testv1-container');

    expect(testContainer).toBeInTheDocument();
  });

  it('should fetch table data on mount', () => {
    render(<AddDataQualityTestPage {...mockProps} />);

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('test-fqn', {
      fields: ['testSuite', 'customMetrics', 'columns'],
    });
  });

  it('should display error toast when fetch fails', async () => {
    (getTableDetailsByFQN as jest.Mock).mockRejectedValue(
      new Error('Fetch failed')
    );
    await act(async () => {
      render(<AddDataQualityTestPage {...mockProps} />);
    });

    expect(showErrorToast).toHaveBeenCalled();
  });
});

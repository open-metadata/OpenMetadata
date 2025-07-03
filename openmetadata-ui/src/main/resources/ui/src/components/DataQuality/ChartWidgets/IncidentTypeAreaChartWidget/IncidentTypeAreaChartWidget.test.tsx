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
import '@testing-library/jest-dom/extend-expect';
import { render, screen, waitFor } from '@testing-library/react';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { fetchCountOfIncidentStatusTypeByDays } from '../../../../rest/dataQualityDashboardAPI';
import { IncidentTypeAreaChartWidgetProps } from '../../DataQuality.interface';
import IncidentTypeAreaChartWidget from './IncidentTypeAreaChartWidget.component';

jest.mock('../../../../rest/dataQualityDashboardAPI', () => ({
  fetchCountOfIncidentStatusTypeByDays: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [
        {
          stateId: '17',
          timestamp: '1729468800000',
        },
      ],
    })
  ),
}));
jest.mock('../../../Visualisations/Chart/CustomAreaChart.component', () =>
  jest.fn().mockImplementation(() => <div>CustomAreaChart.component</div>)
);

const defaultProps: IncidentTypeAreaChartWidgetProps = {
  incidentStatusType: TestCaseResolutionStatusTypes.New,
  name: 'Incident Type',
  title: 'Incident Type Area Chart Widget',
};

describe('IncidentTypeAreaChartWidget', () => {
  it('should render the component', async () => {
    render(<IncidentTypeAreaChartWidget {...defaultProps} />);

    expect(await screen.findByText(defaultProps.title)).toBeInTheDocument();
    expect(
      await screen.findByText('CustomAreaChart.component')
    ).toBeInTheDocument();
    expect((await screen.findByTestId('total-value')).textContent).toEqual(
      '17'
    );
  });

  it('should call fetchCountOfIncidentStatusTypeByDays function', async () => {
    render(<IncidentTypeAreaChartWidget {...defaultProps} />);

    expect(fetchCountOfIncidentStatusTypeByDays).toHaveBeenCalledWith(
      defaultProps.incidentStatusType,
      undefined
    );
  });

  it('should call fetchCountOfIncidentStatusTypeByDays with filters provided via props', async () => {
    const filters = {
      endTs: 1625097600000,
      startTs: 1625097600000,
      ownerFqn: 'ownerFqn',
      tags: ['tag1', 'tag2'],
      tier: ['tier1'],
    };
    const status = TestCaseResolutionStatusTypes.Assigned;
    render(
      <IncidentTypeAreaChartWidget
        {...defaultProps}
        chartFilter={filters}
        incidentStatusType={status}
      />
    );

    expect(fetchCountOfIncidentStatusTypeByDays).toHaveBeenCalledWith(
      status,
      filters
    );
  });

  it('should handle API errors gracefully', async () => {
    (fetchCountOfIncidentStatusTypeByDays as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );
    render(<IncidentTypeAreaChartWidget {...defaultProps} />);
    await waitFor(() =>
      expect(fetchCountOfIncidentStatusTypeByDays).toHaveBeenCalled()
    );

    expect(await screen.findByText(defaultProps.title)).toBeInTheDocument();
    expect(
      await screen.findByText('CustomAreaChart.component')
    ).toBeInTheDocument();
    expect((await screen.findByTestId('total-value')).textContent).toEqual('0');
  });
});

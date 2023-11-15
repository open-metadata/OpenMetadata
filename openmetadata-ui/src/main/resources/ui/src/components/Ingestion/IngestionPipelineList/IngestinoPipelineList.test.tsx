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
import React from 'react';
import { ServiceCategory } from '../../../enums/service.enum';
import { useAirflowStatus } from '../../../hooks/useAirflowStatus';
import { IngestionPipelineList } from './IngestionPipelineList.component';

const mockGetIngestinoPipelines = jest.fn();
const mockBulkDeployPipelines = jest.fn();

jest.mock(
  '../../common/error-with-placeholder/ErrorPlaceHolderIngestion',
  () => {
    return jest.fn().mockImplementation(() => <p>Airflow not available</p>);
  }
);

jest.mock('../../../hooks/useAirflowStatus', () => ({
  ...jest.requireActual('../../../hooks/useAirflowStatus'),
  useAirflowStatus: jest.fn().mockImplementation(() => ({
    isAirflowAvailable: false,
    isFetchingStatus: true,
  })),
}));

jest.mock('../../../components/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>);
});

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  deployIngestionPipelineById: mockBulkDeployPipelines,
  getIngestionPipelines: mockGetIngestinoPipelines,
}));

describe('IngestionPipelineList component', () => {
  it('component should show loader until get status of airflow', () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: true,
    }));

    render(
      <IngestionPipelineList serviceName={ServiceCategory.DASHBOARD_SERVICES} />
    );

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('component should show error placeholder for airflow not available', () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: false,
    }));

    render(
      <IngestionPipelineList serviceName={ServiceCategory.DASHBOARD_SERVICES} />
    );

    expect(screen.getByText('Airflow not available')).toBeInTheDocument();
  });
});

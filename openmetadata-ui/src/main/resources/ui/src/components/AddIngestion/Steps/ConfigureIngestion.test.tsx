/*
 *  Copyright 2021 Collate
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

import { findAllByText, findByTestId, render } from '@testing-library/react';
import React from 'react';
import { ServiceCategory } from '../../../enums/service.enum';
import { ConfigureIngestionProps } from '../addIngestion.interface';
import ConfigureIngestion from './ConfigureIngestion';

jest.mock('../../common/FilterPattern/FilterPattern', () => {
  return jest.fn().mockImplementation(() => <div>FilterPattern.component</div>);
});

jest.mock('../../common/toggle-switch/ToggleSwitchV1', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>ToggleSwitchV1.component</div>);
});

const mockConfigureIngestion: ConfigureIngestionProps = {
  ingestionName: '',
  dashboardFilterPattern: {
    include: [],
    exclude: [],
  },
  chartFilterPattern: {
    include: [],
    exclude: [],
  },
  schemaFilterPattern: {
    include: [],
    exclude: [],
  },
  tableFilterPattern: {
    include: [],
    exclude: [],
  },
  topicFilterPattern: {
    include: [],
    exclude: [],
  },
  includeView: false,
  enableDataProfiler: false,
  ingestSampleData: false,
  showDashboardFilter: false,
  showSchemaFilter: false,
  showTableFilter: false,
  showTopicFilter: false,
  showChartFilter: false,
  handleIncludeView: jest.fn(),
  handleEnableDataProfiler: jest.fn(),
  handleIngestSampleData: jest.fn(),
  getIncludeValue: jest.fn(),
  getExcludeValue: jest.fn(),
  handleShowFilter: jest.fn(),
  onCancel: jest.fn(),
  onNext: jest.fn(),
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
};

describe('Test ConfigureIngestion component', () => {
  it('ConfigureIngestion component should render', async () => {
    const { container } = render(
      <ConfigureIngestion {...mockConfigureIngestion} />
    );

    const configureIngestionContainer = await findByTestId(
      container,
      'configure-ingestion-container'
    );

    const backButton = await findByTestId(container, 'back-button');
    const nextButton = await findByTestId(container, 'next-button');
    const filterPatternComponents = await findAllByText(
      container,
      'FilterPattern.component'
    );
    const toggleSwitchs = await findAllByText(
      container,
      'ToggleSwitchV1.component'
    );

    expect(configureIngestionContainer).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(filterPatternComponents.length).toBe(2);
    expect(toggleSwitchs.length).toBe(3);
  });
});

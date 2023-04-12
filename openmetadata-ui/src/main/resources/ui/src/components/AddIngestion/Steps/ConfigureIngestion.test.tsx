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

import { findAllByText, findByTestId, render } from '@testing-library/react';
import React from 'react';
import { FormSubmitType } from '../../../enums/form.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  PipelineType,
  ProfileSampleType,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  AddIngestionState,
  ConfigureIngestionProps,
} from '../addIngestion.interface';
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
  pipelineType: PipelineType.Metadata,
  formType: FormSubmitType.EDIT,
  getIncludeValue: jest.fn(),
  getExcludeValue: jest.fn(),
  handleShowFilter: jest.fn(),
  onCancel: jest.fn(),
  onNext: jest.fn(),
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  onChange: jest.fn(),
  data: {
    showDatabaseFilterField: true,
    ingestionName: '',
    databaseFilterPattern: {
      includes: [],
      excludes: [],
    },
    dashboardFilterPattern: {
      includes: [],
      excludes: [],
    },
    chartFilterPattern: {
      includes: [],
      excludes: [],
    },
    schemaFilterPattern: {
      includes: [],
      excludes: [],
    },
    tableFilterPattern: {
      includes: [],
      excludes: [],
    },
    topicFilterPattern: {
      includes: [],
      excludes: [],
    },
    pipelineFilterPattern: {
      includes: [],
      excludes: [],
    },
    mlModelFilterPattern: {
      includes: [],
      excludes: [],
    },
    includeLineage: false,
    includeView: false,
    includeTags: false,

    queryLogDuration: 1,
    resultLimit: 100,
    stageFileLocation: '',
    markDeletedTables: false,
    markDeletedDashboards: true,
    markDeletedTopics: true,
    markDeletedMlModels: true,
    markDeletedPipelines: true,
    showDashboardFilter: false,
    showDatabaseFilter: false,
    showSchemaFilter: false,
    showTableFilter: false,
    showTopicFilter: false,
    showChartFilter: false,
    showPipelineFilter: false,
    showMlModelFilter: false,
    profileSample: 1,
    profileSampleType: ProfileSampleType.Percentage,
    enableDebugLog: false,
    ingestSampleData: false,
    databaseServiceNames: [''],
    threadCount: 5,
    timeoutSeconds: 43200,
    useFqnFilter: false,
    confidence: 80,
  } as unknown as AddIngestionState,
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
    const toggleSwitch = await findAllByText(
      container,
      'ToggleSwitchV1.component'
    );

    expect(configureIngestionContainer).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(filterPatternComponents).toHaveLength(3);
    expect(toggleSwitch).toHaveLength(6);
  });
});

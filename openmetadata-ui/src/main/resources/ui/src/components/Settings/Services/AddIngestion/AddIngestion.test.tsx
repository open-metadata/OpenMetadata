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

import { findByTestId, findByText, render } from '@testing-library/react';
import { FormSubmitType } from '../../../../enums/form.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import AddIngestion from './AddIngestion.component';
import { AddIngestionProps } from './IngestionWorkflow.interface';

const mockAddIngestionProps: AddIngestionProps = {
  activeIngestionStep: 1,
  setActiveIngestionStep: jest.fn(),
  serviceData: {
    name: 'serviceName',
    connection: {
      config: {
        database: 'testDb',
        ingestAllDatabases: false,
      },
    },
  },
  handleCancelClick: jest.fn(),
  serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
  onAddIngestionSave: jest.fn(),
  handleViewServiceClick: jest.fn(),
  pipelineType: PipelineType.Metadata,
  heading: 'add ingestion',
  status: FormSubmitType.ADD,
  onFocus: jest.fn(),
};

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ ingestionFQN: 'test' }),
}));

jest.mock('@rjsf/core', () => ({
  Form: jest.fn().mockImplementation(() => <div>RJSF_Form.component</div>),
}));

jest.mock('../Ingestion/IngestionStepper/IngestionStepper.component', () => {
  return jest.fn().mockImplementation(() => <div>IngestionStepper</div>);
});

jest.mock('./Steps/ScheduleInterval', () => {
  return jest.fn().mockImplementation(() => <div>ScheduleInterval</div>);
});

jest.mock('../Ingestion/IngestionWorkflowForm/IngestionWorkflowForm', () => {
  return jest.fn().mockImplementation(() => <div>Ingestion workflow form</div>);
});

jest.mock('../../../../utils/SchedularUtils', () => ({
  getScheduleOptionsFromSchedules: jest.fn().mockReturnValue([]),
  getRaiseOnErrorFormField: jest.fn().mockReturnValue({}),
}));

describe('Test AddIngestion component', () => {
  it('AddIngestion component should render', async () => {
    const { container } = render(<AddIngestion {...mockAddIngestionProps} />);

    const addIngestionContainer = await findByTestId(
      container,
      'add-ingestion-container'
    );
    const configureIngestion = await findByText(
      container,
      'Ingestion workflow form'
    );

    expect(addIngestionContainer).toBeInTheDocument();
    expect(configureIngestion).toBeInTheDocument();
  });
});

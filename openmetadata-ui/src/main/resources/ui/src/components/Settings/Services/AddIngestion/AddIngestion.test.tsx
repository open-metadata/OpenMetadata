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

import {
  findByTestId,
  findByText,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
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
    owners: [{ id: 'service-owner-id', type: 'user' }],
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

jest.mock('./Steps/ScheduleIntervalStep', () => {
  return jest.fn().mockImplementation(({ onDeploy }) => (
    <div>
      ScheduleIntervalStep
      <button
        data-testid="mock-deploy"
        onClick={() => onDeploy?.({ cron: '0 0 * * *', retries: 0 })}>
        deploy
      </button>
    </div>
  ));
});

jest.mock('../Ingestion/IngestionWorkflowForm/IngestionWorkflowForm', () => {
  return jest.fn().mockImplementation(({ onReady, onSubmit }) => (
    <div>
      Ingestion workflow form
      <button data-testid="mock-form-ready" onClick={() => onReady?.()}>
        ready
      </button>
      <button data-testid="mock-form-submit" onClick={() => onSubmit?.({})}>
        submit
      </button>
    </div>
  ));
});

jest.mock('../../../../utils/SchedularUtils', () => ({
  getScheduleOptionsFromSchedules: jest.fn().mockReturnValue([]),
  getRaiseOnErrorFormField: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockReturnValue({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  }),
}));

// The real picker fetches users/teams; expose a button that returns a fixed
// selection so the owners wiring can be driven from tests.
jest.mock(
  '../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest.fn().mockImplementation(({ onUpdate }) => (
      <button data-testid="mock-pick-owner" onClick={() => onUpdate([])}>
        pick
      </button>
    )),
  })
);

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'current-user-id', name: 'admin' },
    theme: { primaryColor: '#0950c5' },
  }),
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

  it('should report the configure step as ready only once the workflow form mounts', async () => {
    const onStepReadyChange = jest.fn();
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        onStepReadyChange={onStepReadyChange}
      />
    );

    expect(onStepReadyChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(await screen.findByTestId('mock-form-ready'));

    expect(onStepReadyChange).toHaveBeenLastCalledWith(true);
  });

  it('should report the schedule step as ready without waiting for the workflow form', () => {
    const onStepReadyChange = jest.fn();
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        activeIngestionStep={2}
        onStepReadyChange={onStepReadyChange}
      />
    );

    expect(onStepReadyChange).toHaveBeenLastCalledWith(true);
  });

  it('should send the service owners in the create payload', async () => {
    const onAddIngestionSave = jest.fn().mockResolvedValue(undefined);
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        activeIngestionStep={2}
        onAddIngestionSave={onAddIngestionSave}
      />
    );

    fireEvent.click(await screen.findByTestId('mock-deploy'));

    expect(onAddIngestionSave).toHaveBeenCalledWith(
      expect.objectContaining({
        owners: [{ id: 'service-owner-id', type: 'user' }],
      })
    );
  });

  it('should fall back to the current user when the service has no owners', async () => {
    const onAddIngestionSave = jest.fn().mockResolvedValue(undefined);
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        activeIngestionStep={2}
        serviceData={{ name: 'serviceName' }}
        onAddIngestionSave={onAddIngestionSave}
      />
    );

    fireEvent.click(await screen.findByTestId('mock-deploy'));

    expect(onAddIngestionSave).toHaveBeenCalledWith(
      expect.objectContaining({
        owners: [{ id: 'current-user-id', type: 'user' }],
      })
    );
  });

  it('should advance to the schedule step while owners are set', async () => {
    const setActiveIngestionStep = jest.fn();
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        setActiveIngestionStep={setActiveIngestionStep}
      />
    );

    fireEvent.click(await screen.findByTestId('mock-form-submit'));

    expect(setActiveIngestionStep).toHaveBeenCalledWith(2);
  });

  it('should block the schedule step and show an error when owners are cleared', async () => {
    const setActiveIngestionStep = jest.fn();
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        setActiveIngestionStep={setActiveIngestionStep}
      />
    );

    fireEvent.click(await screen.findByTestId('mock-pick-owner'));
    fireEvent.click(await screen.findByTestId('mock-form-submit'));

    expect(setActiveIngestionStep).not.toHaveBeenCalledWith(2);
    expect(await screen.findByTestId('owners-error')).toBeInTheDocument();
  });

  it('should prefill the saved owners and send them back on edit', async () => {
    const onUpdateIngestion = jest.fn().mockResolvedValue(undefined);
    const savedOwners = [{ id: 'saved-owner-id', type: 'team' }];
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        activeIngestionStep={2}
        data={
          {
            id: 'pipeline-id',
            name: 'pipeline',
            owners: savedOwners,
            airflowConfig: {},
            sourceConfig: { config: {} },
          } as AddIngestionProps['data']
        }
        status={FormSubmitType.EDIT}
        onUpdateIngestion={onUpdateIngestion}
      />
    );

    fireEvent.click(await screen.findByTestId('mock-deploy'));

    expect(onUpdateIngestion).toHaveBeenCalledWith(
      expect.objectContaining({ owners: savedOwners }),
      expect.anything(),
      'pipeline-id',
      'pipeline'
    );
  });

  // A pipeline created through the API carries no owners. The mandatory gate
  // must not make those impossible to edit and save.
  it('should let an agent with no saved owners still be edited', async () => {
    const setActiveIngestionStep = jest.fn();
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        data={
          {
            id: 'pipeline-id',
            name: 'pipeline',
            airflowConfig: {},
            sourceConfig: { config: {} },
          } as AddIngestionProps['data']
        }
        serviceData={{ name: 'serviceName' }}
        setActiveIngestionStep={setActiveIngestionStep}
        status={FormSubmitType.EDIT}
      />
    );

    fireEvent.click(await screen.findByTestId('mock-form-submit'));

    expect(setActiveIngestionStep).toHaveBeenCalledWith(2);
    expect(screen.queryByTestId('owners-error')).not.toBeInTheDocument();
  });

  it('should not require owners for a settings pipeline', async () => {
    const setActiveIngestionStep = jest.fn();
    render(
      <AddIngestion
        {...mockAddIngestionProps}
        pipelineType={PipelineType.DataInsight}
        setActiveIngestionStep={setActiveIngestionStep}
      />
    );

    fireEvent.click(await screen.findByTestId('mock-pick-owner'));
    fireEvent.click(await screen.findByTestId('mock-form-submit'));

    expect(setActiveIngestionStep).toHaveBeenCalledWith(2);
    expect(screen.queryByTestId('owners-error')).not.toBeInTheDocument();
  });
});

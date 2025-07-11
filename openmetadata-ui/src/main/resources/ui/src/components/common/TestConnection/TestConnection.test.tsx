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
import {
  act,
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { ServiceCategory } from '../../../enums/service.enum';
import { WorkflowStatus } from '../../../generated/entity/automations/workflow';
import { ConfigData } from '../../../interface/service.interface';
import {
  addWorkflow,
  deleteWorkflowById,
  getTestConnectionDefinitionByName,
  getWorkflowById,
  triggerWorkflowById,
} from '../../../rest/workflowAPI';
import { StatusType } from '../StatusBadge/StatusBadge.interface';
import TestConnection from './TestConnection';
import {
  CREATE_WORKFLOW_PAYLOAD,
  FORM_DATA,
  TEST_CONNECTION_DEFINITION,
  WORKFLOW_DETAILS,
} from './TestConnection.mock';

const mockonValidateFormRequiredFields = jest.fn();

const mockProps = {
  isTestingDisabled: false,
  connectionType: 'Mysql',
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  getData: () => FORM_DATA as ConfigData,
  onValidateFormRequiredFields: mockonValidateFormRequiredFields,
  shouldValidateForm: false,
};

jest.mock('../../../utils/ServiceUtils', () => ({
  ...jest.requireActual('../../../utils/ServiceUtils'),
  getTestConnectionName: jest.fn().mockReturnValue('test-connection-Mysql-01'),
}));

jest.mock('./TestConnectionModal/TestConnectionModal', () =>
  jest
    .fn()
    .mockImplementation(({ isOpen }) =>
      isOpen ? <div data-testid="test-connection-modal">Modal</div> : null
    )
);

jest.mock('../../../rest/workflowAPI', () => ({
  addWorkflow: jest
    .fn()
    .mockImplementation(() => Promise.resolve(WORKFLOW_DETAILS)),
  getTestConnectionDefinitionByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(TEST_CONNECTION_DEFINITION)),
  getWorkflowById: jest
    .fn()
    .mockImplementation(() => Promise.resolve(WORKFLOW_DETAILS)),
  triggerWorkflowById: jest.fn().mockImplementation(() => Promise.resolve(200)),
  deleteWorkflowById: jest
    .fn()
    .mockImplementation(() => Promise.resolve(WORKFLOW_DETAILS)),
}));

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest
      .fn()
      .mockImplementation(() => ({ isAirflowAvailable: true })),
  })
);

jest.useFakeTimers();

describe('Test Connection Component', () => {
  it('Should render the child component', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    expect(
      screen.getByText('message.test-your-connection-before-creating-service')
    ).toBeInTheDocument();

    expect(screen.getByTestId('test-connection-btn')).toBeInTheDocument();
  });

  it('Should render the button only is showDetails is false', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} showDetails={false} />);
    });

    expect(screen.getByTestId('test-connection-button')).toBeInTheDocument();
  });

  it('Test connection button should be disabled on test connection click', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    fireEvent.click(testConnectionButton);

    expect(testConnectionButton).toBeDisabled();
  });

  it('Should fetch the connection definition on test connection click', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    fireEvent.click(testConnectionButton);

    expect(getTestConnectionDefinitionByName).toHaveBeenCalledWith(
      'Mysql.testConnectionDefinition'
    );
  });

  it('Should show the connection modal on test connection click', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    expect(screen.getByTestId('test-connection-modal')).toBeInTheDocument();
  });

  it('Should show the testing message on test connection click', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    fireEvent.click(testConnectionButton);

    expect(
      screen.getByText('message.testing-your-connection-may-take-two-minutes')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('test-connection-details-btn')
    ).toBeInTheDocument();
  });

  it('Should create, trigger and fetch the workflow on test connection click', async () => {
    jest.useFakeTimers();
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });
    const controller = new AbortController();

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    expect(addWorkflow).toHaveBeenCalledWith(
      CREATE_WORKFLOW_PAYLOAD,
      controller.signal
    );

    expect(triggerWorkflowById).toHaveBeenCalledWith(
      WORKFLOW_DETAILS.id,
      controller.signal
    );

    jest.advanceTimersByTime(2000);

    expect(getWorkflowById).toHaveBeenCalledWith(
      WORKFLOW_DETAILS.id,
      controller.signal
    );
  });

  it('Should show success message if test connection successful', async () => {
    jest.useFakeTimers();
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(2000);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByText('message.connection-test-successful')
    ).toBeInTheDocument();

    expect(screen.getByTestId('success-badge')).toBeInTheDocument();
  });

  it('Should show warning message if test connection failed and mandatory steps passed', async () => {
    jest.useFakeTimers();

    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        response: { ...WORKFLOW_DETAILS.response, status: StatusType.Failure },
      })
    );
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(2000);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByText('message.connection-test-warning')
    ).toBeInTheDocument();

    expect(screen.getByTestId('warning-badge')).toBeInTheDocument();
  });

  it('Should show fail message if create workflow API fails', async () => {
    jest.useFakeTimers();

    (addWorkflow as jest.Mock).mockImplementationOnce(() => Promise.reject());
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(2000);

    expect(
      screen.getByText('message.connection-test-failed')
    ).toBeInTheDocument();

    expect(screen.getByTestId('fail-badge')).toBeInTheDocument();
  });

  it('Should show fail message if trigger workflow API fails', async () => {
    jest.useFakeTimers();

    (triggerWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(2000);

    expect(
      screen.getByText('message.connection-test-failed')
    ).toBeInTheDocument();

    expect(screen.getByTestId('fail-badge')).toBeInTheDocument();
  });

  it.skip('Should timeout message after two minutes', async () => {
    jest.useFakeTimers();

    (addWorkflow as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        status: WorkflowStatus.Pending,
      })
    );

    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        status: WorkflowStatus.Pending,
      })
    );
    render(<TestConnection {...mockProps} />);

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
      jest.advanceTimersByTime(120000);
    });

    expect(
      screen.getByText('message.test-connection-taking-too-long.default')
    ).toBeInTheDocument();

    // 59 since it will make this amount of call, and after timeout it should not make more api calls
    expect(getWorkflowById).toHaveBeenCalledTimes(59);
    expect(getWorkflowById).not.toHaveBeenCalledTimes(60);
  });

  it('Should not show the connection status modal if test connection definition API fails', async () => {
    (getTestConnectionDefinitionByName as jest.Mock).mockImplementationOnce(
      () => Promise.reject()
    );

    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    fireEvent.click(testConnectionButton);

    expect(getTestConnectionDefinitionByName).toHaveBeenCalledWith(
      'Mysql.testConnectionDefinition'
    );

    expect(
      screen.queryByTestId('test-connection-modal')
    ).not.toBeInTheDocument();

    // add workflow API should not get called
    expect(addWorkflow).not.toHaveBeenCalled();
  });

  it('Test connection button should be disabled is airflow is not available', async () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      isAirflowAvailable: false,
    }));

    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    expect(testConnectionButton).toBeDisabled();
  });

  it('Should render the configure airflow message if airflow is not available', async () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      isAirflowAvailable: false,
    }));

    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    expect(screen.getByTestId('airflow-doc-link')).toBeInTheDocument();
  });

  it('Test connection button with showDetails false should be disabled is airflow is not available', async () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      isAirflowAvailable: false,
    }));
    await act(async () => {
      render(<TestConnection {...mockProps} showDetails={false} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-button');

    expect(testConnectionButton).toBeDisabled();
  });

  it('Should render the failed badge and message if mandatory steps fails', async () => {
    jest.useFakeTimers();
    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        response: {
          ...WORKFLOW_DETAILS.response,
          steps: [
            {
              name: 'CheckAccess',
              passed: false,
              message: null,
              mandatory: true,
            },
            {
              name: 'GetSchemas',
              passed: false,
              message: null,
              mandatory: true,
            },
            {
              name: 'GetTables',
              passed: false,
              message: null,
              mandatory: true,
            },
            {
              name: 'GetViews',
              passed: true,
              message: null,
              mandatory: false,
            },
          ],
          status: StatusType.Failure,
        },
      })
    );
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(2000);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByText('message.connection-test-failed')
    ).toBeInTheDocument();

    expect(screen.getByTestId('fail-badge')).toBeInTheDocument();
  });

  it('Should validate the form before testing the connect', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} shouldValidateForm />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    fireEvent.click(testConnectionButton);

    expect(mockonValidateFormRequiredFields).toHaveBeenCalled();
  });

  it('Validate the form and do not initiate the testing of the connection if the required fields are not filled in.', async () => {
    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          shouldValidateForm
          onValidateFormRequiredFields={jest
            .fn()
            .mockImplementationOnce(() => false)}
        />
      );
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    fireEvent.click(testConnectionButton);

    expect(addWorkflow).not.toHaveBeenCalled();
  });

  it('Should delete the workflow if workflow failed to trigger', async () => {
    (triggerWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(204)
    );
    jest.useFakeTimers();
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const controller = new AbortController();

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    expect(addWorkflow).toHaveBeenCalledWith(
      CREATE_WORKFLOW_PAYLOAD,
      controller.signal
    );

    expect(triggerWorkflowById).toHaveBeenCalledWith(
      WORKFLOW_DETAILS.id,
      controller.signal
    );

    jest.advanceTimersByTime(2000);

    // delete api should be called
    expect(deleteWorkflowById).toHaveBeenCalledWith(WORKFLOW_DETAILS.id, true);
  });
});

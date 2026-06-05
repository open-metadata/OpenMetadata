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
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { act } from 'react';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { ServiceCategory } from '../../../enums/service.enum';
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
  CREATE_WORKFLOW_PAYLOAD_WITH_RUNNER,
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

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Tooltip: jest.fn().mockImplementation(({ children, title }) => (
    <div>
      <span data-testid="tooltip">{title}</span>
      {children}
    </div>
  )),
}));

jest.mock('../../../utils/ServiceUtils', () => ({
  ...jest.requireActual('../../../utils/ServiceUtils'),
  getTestConnectionName: jest.fn().mockReturnValue('test-connection-Mysql-01'),
}));

jest.mock('./TestConnectionModal/TestConnectionModal', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        connectionDisplayName,
        errorMessage,
        hostIp,
        isConnectionTimeout,
        isOpen,
        onCancel,
        onConfirm,
        onTestConnection,
      }) =>
        isOpen ? (
          <div data-testid="test-connection-modal">
            Modal
            <span data-testid="connection-display-name">
              {connectionDisplayName}
            </span>
            {errorMessage?.description && (
              <span data-testid="connection-error-message">
                {errorMessage.description}
              </span>
            )}
            {isConnectionTimeout && (
              <span data-testid="connection-timeout-message">{hostIp}</span>
            )}
            <button onClick={onCancel}>Cancel Modal</button>
            <button onClick={onConfirm}>Confirm Modal</button>
            <button onClick={onTestConnection}>Retry Modal</button>
          </div>
        ) : null
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
  beforeEach(() => {
    (addWorkflow as jest.Mock).mockImplementation(() =>
      Promise.resolve(WORKFLOW_DETAILS)
    );
    (getTestConnectionDefinitionByName as jest.Mock).mockImplementation(() =>
      Promise.resolve(TEST_CONNECTION_DEFINITION)
    );
    (getWorkflowById as jest.Mock).mockImplementation(() =>
      Promise.resolve(WORKFLOW_DETAILS)
    );
    (triggerWorkflowById as jest.Mock).mockImplementation(() =>
      Promise.resolve(200)
    );
    (deleteWorkflowById as jest.Mock).mockImplementation(() =>
      Promise.resolve(WORKFLOW_DETAILS)
    );
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: true,
    }));
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('Should render the child component', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const connectionCard = screen.getByTestId('test-connection-card');
    const testConnectionButton = screen.getByTestId('test-connection-btn');

    expect(
      screen.getByText('message.ready-to-test-connection')
    ).toBeInTheDocument();

    expect(
      screen.getByText('message.test-connection-unlocks-next-step')
    ).toBeInTheDocument();

    expect(screen.getByTestId('ready-badge')).toBeInTheDocument();
    expect(connectionCard).toHaveClass('tw:border-utility-brand-300');
    expect(testConnectionButton).toBeInTheDocument();
  });

  it('Should show missing required field count before testing', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} missingRequiredFieldsCount={4} />);
    });

    expect(
      screen.getByText('message.fill-required-fields-then-test-connection')
    ).toBeInTheDocument();
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

  it('Should show Snowflake account domain in the connection modal', async () => {
    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          connectionType="Snowflake"
          getData={() =>
            ({
              account: 'fsad.us-east-1.gcp',
            } as ConfigData)
          }
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    expect(screen.getByTestId('connection-display-name')).toHaveTextContent(
      'fsad.us-east-1.gcp.snowflakecomputing.com'
    );
  });

  it('Should keep full Snowflake domains without appending another suffix', async () => {
    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          connectionType="Snowflake"
          getData={() =>
            ({
              account: ' fsad.snowflakecomputing.com ',
            } as ConfigData)
          }
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    expect(screen.getByTestId('connection-display-name')).toHaveTextContent(
      'fsad.snowflakecomputing.com'
    );
  });

  it('Should recompute the connection display name from latest form data when opening the modal', async () => {
    let account = '';
    const getData = jest.fn(() => ({ account } as ConfigData));

    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          connectionType="Snowflake"
          getData={getData}
        />
      );
    });

    account = 'fresh-account';

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    expect(screen.getByTestId('connection-display-name')).toHaveTextContent(
      'fresh-account.snowflakecomputing.com'
    );
  });

  it('Should not preserve Snowflake host substrings outside the hostname', async () => {
    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          connectionType="Snowflake"
          getData={() =>
            ({
              account: 'https://example.com/snowflakecomputing.com',
            } as ConfigData)
          }
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    expect(screen.getByTestId('connection-display-name')).toHaveTextContent(
      'https://example.com/snowflakecomputing.com.snowflakecomputing.com'
    );
  });

  it('Should fall back to service name for the connection modal title', async () => {
    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          getData={() => ({} as ConfigData)}
          serviceName="warehouse-prod"
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    expect(screen.getByTestId('connection-display-name')).toHaveTextContent(
      'warehouse-prod'
    );
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

  it('Should create workflow with ingestionRunner when extraInfo is provided', async () => {
    jest.useFakeTimers();
    await act(async () => {
      render(<TestConnection {...mockProps} extraInfo="custom-runner-name" />);
    });
    const controller = new AbortController();

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    expect(addWorkflow).toHaveBeenCalledWith(
      CREATE_WORKFLOW_PAYLOAD_WITH_RUNNER,
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

  it('Should create workflow with ingestionRunner when ingestionRunner is present in formData', async () => {
    jest.useFakeTimers();
    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          getData={() =>
            ({
              ...FORM_DATA,
              ingestionRunner: 'custom-runner-name',
            } as ConfigData)
          }
        />
      );
    });
    const controller = new AbortController();

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      fireEvent.click(testConnectionButton);
    });

    expect(addWorkflow).toHaveBeenCalledWith(
      CREATE_WORKFLOW_PAYLOAD_WITH_RUNNER,
      controller.signal
    );
  });

  it('Should create workflow without ingestionRunner field when ingestionRunner is not in formData and in extraInfo', async () => {
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
      screen.getByText('message.test-connection-verified')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.test-connection-ready-count')
    ).toBeInTheDocument();

    expect(screen.getByTestId('success-badge')).toBeInTheDocument();
    expect(screen.getByTestId('test-connection-card')).toHaveClass(
      'tw:border-utility-success-200'
    );
  });

  it('Should show warning message if test connection failed and mandatory steps passed', async () => {
    jest.useFakeTimers();
    const onTestConnectionStatusChange = jest.fn();

    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        response: { ...WORKFLOW_DETAILS.response, status: StatusType.Failure },
      })
    );
    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          onTestConnectionStatusChange={onTestConnectionStatusChange}
        />
      );
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
    expect(screen.getByTestId('test-connection-card')).toHaveClass(
      'tw:border-utility-warning-200'
    );
    expect(onTestConnectionStatusChange).toHaveBeenLastCalledWith(true);
  });

  it('Should allow progress when definition-required steps pass and optional steps fail', async () => {
    jest.useFakeTimers();
    const onTestConnectionStatusChange = jest.fn();

    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        response: {
          ...WORKFLOW_DETAILS.response,
          steps: [
            {
              name: 'CheckAccess',
              passed: true,
              message: null,
              mandatory: true,
            },
            {
              name: 'GetSchemas',
              passed: true,
              message: null,
              mandatory: true,
            },
            {
              name: 'GetTables',
              passed: true,
              message: null,
              mandatory: true,
            },
            {
              name: 'GetViews',
              passed: false,
              message: null,
              mandatory: true,
            },
          ],
          status: StatusType.Failure,
        },
      })
    );
    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          onTestConnectionStatusChange={onTestConnectionStatusChange}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    jest.advanceTimersByTime(2000);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByText('message.connection-test-warning')
    ).toBeInTheDocument();
    expect(onTestConnectionStatusChange).toHaveBeenLastCalledWith(true);
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
      await screen.findByText('message.connection-test-failed')
    ).toBeInTheDocument();

    expect(screen.getByTestId('fail-badge')).toBeInTheDocument();
    expect(screen.getByTestId('test-connection-card')).toHaveClass(
      'tw:border-utility-error-200'
    );
  });

  it('Should show the unexpected response message for 500 workflow failures', async () => {
    jest.useFakeTimers();

    (addWorkflow as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({ status: 500 })
    );
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    jest.advanceTimersByTime(2000);

    expect(
      await screen.findByTestId('connection-error-message')
    ).toHaveTextContent('server.unexpected-response');
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
    expect(
      screen.getAllByText('label.platform-service-client-unavailable').length
    ).toBeGreaterThan(0);
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

  it('Should start testing when required field validation succeeds', async () => {
    const onValidateFormRequiredFields = jest.fn().mockReturnValue(true);

    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          shouldValidateForm
          onValidateFormRequiredFields={onValidateFormRequiredFields}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    expect(onValidateFormRequiredFields).toHaveBeenCalled();
    expect(addWorkflow).toHaveBeenCalled();
  });

  it('Should close the modal and abort when cancel is clicked', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    expect(screen.getByTestId('test-connection-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel Modal'));
    });

    expect(
      screen.queryByTestId('test-connection-modal')
    ).not.toBeInTheDocument();
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

  it('Should skip deleting workflow when failed trigger returns an empty workflow id', async () => {
    const deleteCallCount = (deleteWorkflowById as jest.Mock).mock.calls.length;

    (addWorkflow as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        id: '',
      })
    );
    (triggerWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(204)
    );

    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    expect((deleteWorkflowById as jest.Mock).mock.calls).toHaveLength(
      deleteCallCount
    );
  });

  it('Should keep polling when workflow has not completed yet', async () => {
    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        status: 'Running',
        response: {
          ...WORKFLOW_DETAILS.response,
          status: 'Running',
        },
      })
    );

    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();

    jest.clearAllTimers();
  });

  it('Should fail and delete the workflow when polling fails', async () => {
    (getWorkflowById as jest.Mock).mockRejectedValueOnce(new Error('failed'));

    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(
      screen.getByText('message.connection-test-failed')
    ).toBeInTheDocument();
    expect(deleteWorkflowById).toHaveBeenCalledWith(WORKFLOW_DETAILS.id, true);
  });

  it('Should evaluate legacy result required flags when definition has no required steps', async () => {
    (getTestConnectionDefinitionByName as jest.Mock).mockImplementationOnce(
      () =>
        Promise.resolve({
          ...TEST_CONNECTION_DEFINITION,
          steps: [],
        })
    );
    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        response: {
          ...WORKFLOW_DETAILS.response,
          steps: [
            {
              name: 'LegacyStep',
              passed: true,
              message: null,
              mandatory: true,
            },
          ],
          status: 'Successful',
        },
      })
    );

    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(
      await screen.findByText('message.test-connection-verified')
    ).toBeInTheDocument();
  });

  it('Should evaluate legacy optional result failures when definition has no optional steps', async () => {
    const onTestConnectionStatusChange = jest.fn();

    (getTestConnectionDefinitionByName as jest.Mock).mockImplementationOnce(
      () =>
        Promise.resolve({
          ...TEST_CONNECTION_DEFINITION,
          steps: [
            {
              name: 'CheckAccess',
              description: 'Check access',
              mandatory: true,
            },
          ],
        })
    );
    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        response: {
          ...WORKFLOW_DETAILS.response,
          steps: [
            {
              name: 'CheckAccess',
              passed: true,
              message: null,
              mandatory: true,
            },
            {
              name: 'LegacyOptional',
              passed: false,
              message: null,
              mandatory: false,
            },
          ],
          status: 'Failed',
        },
      })
    );

    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          onTestConnectionStatusChange={onTestConnectionStatusChange}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(
      await screen.findByText('message.connection-test-warning')
    ).toBeInTheDocument();
    expect(onTestConnectionStatusChange).toHaveBeenLastCalledWith(true);
  });

  it('Should show timeout copy when workflow never completes', async () => {
    (addWorkflow as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        status: 'Running',
      })
    );
    (getWorkflowById as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        status: 'Running',
        response: {
          ...WORKFLOW_DETAILS.response,
          status: 'Running',
        },
      })
    );

    await act(async () => {
      render(<TestConnection {...mockProps} hostIp="10.0.0.1" />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    await act(async () => {
      jest.advanceTimersByTime(180000);
    });

    expect(
      await screen.findByTestId('connection-timeout-message')
    ).toHaveTextContent('10.0.0.1');
  });

  it('Should reopen details and retry from the modal actions', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(
      await screen.findByText('message.test-connection-verified')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Modal'));
    });

    expect(
      screen.queryByTestId('test-connection-modal')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-details-btn'));
    });

    expect(screen.getByTestId('test-connection-modal')).toBeInTheDocument();

    const addWorkflowCallCount = (addWorkflow as jest.Mock).mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByText('Retry Modal'));
    });

    expect(addWorkflow).toHaveBeenCalledTimes(addWorkflowCallCount + 1);
  });

  it('Should notify parent when test connection status changes', async () => {
    const onTestConnectionStatusChange = jest.fn();
    jest.useFakeTimers();

    await act(async () => {
      render(
        <TestConnection
          {...mockProps}
          onTestConnectionStatusChange={onTestConnectionStatusChange}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-connection-btn'));
    });

    jest.advanceTimersByTime(2000);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(onTestConnectionStatusChange).toHaveBeenLastCalledWith(true);
  });
});

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
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceCategory } from 'enums/service.enum';
import {
  StatusType,
  WorkflowStatus,
} from 'generated/api/automations/createWorkflow';
import { ConfigData } from 'interface/service.interface';
import React from 'react';
import {
  addWorkflow,
  getTestConnectionDefinitionByName,
  getWorkflowById,
  triggerWorkflowById,
} from 'rest/workflowAPI';
import TestConnection from './TestConnection';
import {
  CREATE_WORKFLOW_PAYLOAD,
  FORM_DATA,
  TEST_CONNECTION_DEFINITION,
  WORKFLOW_DETAILS,
} from './TestConnection.mock';

const mockProps = {
  isTestingDisabled: false,
  connectionType: 'Mysql',
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  formData: FORM_DATA as ConfigData,
};

jest.mock('utils/ServiceUtils', () => ({
  ...jest.requireActual('utils/ServiceUtils'),
  getTestConnectionName: jest.fn().mockReturnValue('test-connection-Mysql-01'),
}));

jest.mock('./TestConnectionModal/TestConnectionModal', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="test-connection-modal">Modal</div>)
);

jest.mock('rest/workflowAPI', () => ({
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
}));

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

    await act(async () => {
      userEvent.click(testConnectionButton);
    });

    expect(testConnectionButton).toBeDisabled();
  });

  it('Should fetch the connection definition on test connection click', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
    });

    expect(getTestConnectionDefinitionByName).toHaveBeenCalledWith('Mysql');
  });

  it('Should show the connection modal on test connection click', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
    });

    expect(screen.getByTestId('test-connection-modal')).toBeInTheDocument();
  });

  it('Should show the testing message on test connection click', async () => {
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
    });

    expect(
      screen.getByText('message.testing-your-connection-may-take-two-minutes')
    ).toBeInTheDocument();
  });

  it('Should create, trigger and fetch the workflow on test connection click', async () => {
    jest.useFakeTimers();
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
    });

    expect(addWorkflow).toHaveBeenCalledWith(CREATE_WORKFLOW_PAYLOAD);

    expect(triggerWorkflowById).toHaveBeenCalledWith(WORKFLOW_DETAILS.id);

    jest.advanceTimersByTime(2000);

    expect(getWorkflowById).toHaveBeenCalledWith(WORKFLOW_DETAILS.id);
  });

  it('Should show success message if test connection successful', async () => {
    jest.useFakeTimers();
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(2000);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByText('message.connection-test-successful')
    ).toBeInTheDocument();

    expect(screen.getByTestId('success-badge')).toBeInTheDocument();
  });

  it('Should show fail message if test connection failed', async () => {
    jest.useFakeTimers();

    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        response: { ...WORKFLOW_DETAILS.response, status: StatusType.Failed },
      })
    );
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(2000);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByText('message.connection-test-failed')
    ).toBeInTheDocument();

    expect(screen.getByTestId('fail-badge')).toBeInTheDocument();
  });

  it('Should show fail message if create workflow API fails', async () => {
    jest.useFakeTimers();

    (addWorkflow as jest.Mock).mockImplementationOnce(() => Promise.reject());
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
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
      userEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(2000);

    expect(
      screen.getByText('message.connection-test-failed')
    ).toBeInTheDocument();

    expect(screen.getByTestId('fail-badge')).toBeInTheDocument();
  });

  it('Should timeout message after two minutes', async () => {
    jest.useFakeTimers();

    (getWorkflowById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...WORKFLOW_DETAILS,
        status: WorkflowStatus.Pending,
      })
    );
    await act(async () => {
      render(<TestConnection {...mockProps} />);
    });

    const testConnectionButton = screen.getByTestId('test-connection-btn');

    await act(async () => {
      userEvent.click(testConnectionButton);
    });

    jest.advanceTimersByTime(120000);

    expect(
      screen.getByText('message.test-connection-taking-too-long')
    ).toBeInTheDocument();
  });
});

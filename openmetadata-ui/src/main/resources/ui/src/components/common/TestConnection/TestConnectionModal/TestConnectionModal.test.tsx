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
import { fireEvent, render, screen } from '@testing-library/react';
import TestConnectionModal from './TestConnectionModal';

jest.mock('../../InlineAlert/InlineAlert', () => {
  return jest.fn().mockReturnValue(<p>InlineAlert</p>);
});

const onCancelMock = jest.fn();
const onConfirmMock = jest.fn();

const testConnectionStep = [
  {
    name: 'Step 1',
    description: 'Description 1',
    mandatory: true,
  },
  { name: 'Step 2', description: 'Description 2', mandatory: true },
];
const testConnectionStepResult = [
  { name: 'Step 1', passed: true, mandatory: true },
  {
    name: 'Step 2',
    passed: false,
    message: 'Error message',
    mandatory: true,
  },
];

const mockOnTestConnection = jest.fn();
const mockHandleCloseErrorMessage = jest.fn();

const commonProps = {
  isOpen: true,
  isConnectionTimeout: false,
  isTestingConnection: false,
  progress: 10,
  testConnectionStep,
  testConnectionStepResult,
  onCancel: onCancelMock,
  onConfirm: onConfirmMock,
  onTestConnection: mockOnTestConnection,
  handleCloseErrorMessage: mockHandleCloseErrorMessage,
};

describe('TestConnectionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should render the modal title', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getByText('label.connection-status')).toBeInTheDocument();
  });

  it('Should render the steps and their results', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getByText('label.establish-connection')).toBeInTheDocument();
    expect(screen.getAllByText('Step 2').length).toBeGreaterThan(0);
  });

  it('Should render the success icon for a passing step', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getAllByTestId('success-badge').length).toBeGreaterThan(0);
  });

  it('Should render the fail icon for a failing step', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getAllByTestId('fail-badge').length).toBeGreaterThan(0);
  });

  it('Should render the awaiting status for a step being tested', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        isTestingConnection
        testConnectionStepResult={[]}
      />
    );

    expect(screen.getAllByText('label.queued')).toHaveLength(1);
  });

  it('Should call onCancel when the cancel button is clicked', () => {
    render(<TestConnectionModal {...commonProps} isTestingConnection />);
    const cancelButton = screen.getByText('label.cancel');

    fireEvent.click(cancelButton);

    expect(onCancelMock).toHaveBeenCalled();
  });

  it('Should call onCancel from the header close button while testing', () => {
    render(<TestConnectionModal {...commonProps} isTestingConnection />);

    fireEvent.click(screen.getByTestId('test-connection-close'));

    expect(onCancelMock).toHaveBeenCalled();
  });

  it('Should call onConfirm when the confirm button is clicked', () => {
    render(<TestConnectionModal {...commonProps} />);
    const okButton = screen.getByText('label.done');

    fireEvent.click(okButton);

    expect(onConfirmMock).toHaveBeenCalled();
  });

  it('Should call onConfirm from the header close button after testing', () => {
    render(<TestConnectionModal {...commonProps} />);

    fireEvent.click(screen.getByTestId('test-connection-close'));

    expect(onConfirmMock).toHaveBeenCalled();
  });

  it('Should render the progress bar with proper value', () => {
    render(<TestConnectionModal {...commonProps} progress={90} />);
    const progressBarValue = screen.getByTestId('progress-bar-value');

    expect(progressBarValue).toBeInTheDocument();

    expect(progressBarValue).toHaveTextContent('90%');
  });

  it('Should render the timeout widget if "isConnectionTimeout" is true', () => {
    render(
      <TestConnectionModal {...commonProps} isConnectionTimeout progress={90} />
    );

    expect(
      screen.getByTestId('test-connection-timeout-widget')
    ).toBeInTheDocument();
  });

  it('Should render the timeout message with host IP', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        isConnectionTimeout
        hostIp="10.0.0.1"
        progress={90}
      />
    );

    expect(
      screen.getByText(/message.test-connection-taking-too-long.withIp/)
    ).toBeInTheDocument();
  });

  it('Try again button should work', async () => {
    render(
      <TestConnectionModal {...commonProps} isConnectionTimeout progress={90} />
    );

    const tryAgainButton = screen.getByTestId('try-again-button');

    expect(tryAgainButton).toBeInTheDocument();

    fireEvent.click(tryAgainButton);

    expect(mockOnTestConnection).toHaveBeenCalled();
  });

  it('should not show error message component if error message is not passed', async () => {
    render(<TestConnectionModal {...commonProps} />);

    const errorComponent = screen.queryByText('InlineAlert');

    expect(errorComponent).not.toBeInTheDocument();
  });

  it('should show error message component if error message is passed', async () => {
    render(
      <TestConnectionModal
        {...commonProps}
        errorMessage={{
          description: 'Error description',
          subDescription: 'Error sub description',
        }}
      />
    );

    const errorComponent = screen.getByText('InlineAlert');

    expect(errorComponent).toBeInTheDocument();
  });

  it('should split steps into a connection gate and capability checks', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getByTestId('connection-gate-phase')).toBeInTheDocument();
    expect(screen.getByTestId('capability-checks-phase')).toBeInTheDocument();
    expect(screen.getByText('label.establish-connection')).toBeInTheDocument();
    expect(
      screen.getByText('label.capability-check-plural')
    ).toBeInTheDocument();
  });

  it('should mark capability checks as "Didn\'t run" when the gate fails', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: false, mandatory: true },
        ]}
      />
    );

    expect(
      screen.getAllByText('message.connection-not-established', {
        exact: false,
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('label.skipped')).not.toBeInTheDocument();
  });

  it('should render the raw connection log with a copy action', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(
      screen.getByText('message.show-raw-connection-log-lines')
    ).toBeInTheDocument();
    expect(screen.getByTestId('copy-log-button')).toBeInTheDocument();
    expect(screen.queryByTestId('copy-raw-log-button')).not.toBeInTheDocument();
  });

  it('should let the user collapse and reopen an auto-expanded capability step log', () => {
    render(<TestConnectionModal {...commonProps} />);

    const step = screen.getByTestId('test-connection-step-Step 2');
    const stepToggle = step.querySelector('button') as HTMLButtonElement;

    expect(screen.getByText('Error message')).toBeInTheDocument();

    fireEvent.click(stepToggle);

    expect(screen.queryByText('Error message')).not.toBeInTheDocument();

    fireEvent.click(stepToggle);

    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('should expand the connection gate details', () => {
    render(<TestConnectionModal {...commonProps} />);

    fireEvent.click(
      screen
        .getByTestId('connection-gate-phase')
        .querySelector('button') as HTMLButtonElement
    );

    expect(screen.getByText('label.resolve-host')).toBeInTheDocument();
    expect(screen.getByText('label.open-socket')).toBeInTheDocument();
    expect(screen.getByText('label.authenticate')).toBeInTheDocument();
    expect(screen.getByText('label.open-session')).toBeInTheDocument();
  });

  it('should show and hide raw connection logs', () => {
    render(<TestConnectionModal {...commonProps} />);

    fireEvent.click(screen.getByText('message.show-raw-connection-log-lines'));

    expect(screen.getByTestId('raw-connection-log')).toHaveTextContent(
      'Error message'
    );

    fireEvent.click(screen.getByText('message.hide-raw-connection-log-lines'));

    expect(screen.queryByTestId('raw-connection-log')).not.toBeInTheDocument();
  });

  it('should show optional failures as warnings when required steps pass', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
          { name: 'GetQueries', description: 'Queries', mandatory: false },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: true, mandatory: true },
          { name: 'GetSchemas', passed: true, mandatory: true },
          { name: 'GetQueries', passed: false, mandatory: false },
        ]}
      />
    );

    expect(
      screen.getByText('message.connection-test-warning')
    ).toBeInTheDocument();
  });
});

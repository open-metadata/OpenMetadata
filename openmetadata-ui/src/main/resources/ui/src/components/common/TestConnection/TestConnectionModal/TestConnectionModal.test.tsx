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
import { Status } from '../../../../generated/entity/automations/workflow';
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

  it('should render the running icon and label for a step with status Running', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        isTestingConnection
        testConnectionStepResult={[
          {
            name: 'Step 2',
            passed: false,
            mandatory: true,
            status: Status.Running,
          },
        ]}
      />
    );

    expect(screen.getByTestId('running-badge')).toBeInTheDocument();
    expect(screen.getByText('label.running-ellipsis')).toBeInTheDocument();
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
    render(
      <TestConnectionModal
        {...commonProps}
        isTestingConnection
        progress={90}
        testConnectionStepResult={[
          { name: 'Step 1', passed: true, mandatory: true },
        ]}
      />
    );
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

  it('should let the user expand and collapse a capability step log', () => {
    render(<TestConnectionModal {...commonProps} />);

    const step = screen.getByTestId('test-connection-step-Step 2');
    const stepToggle = step.querySelector('button') as HTMLButtonElement;

    expect(screen.queryByText('Error message')).not.toBeInTheDocument();

    fireEvent.click(stepToggle);

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

  it('should auto-expand gate banner when testing starts', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        isTestingConnection
        testConnectionStepResult={[]}
      />
    );

    expect(screen.getAllByTestId('gate-step-pill')).toHaveLength(4);
  });

  it('should show all gate step pills as running when testing and no result', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        isTestingConnection
        testConnectionStepResult={[]}
      />
    );

    const pills = screen.getAllByTestId('gate-step-pill');

    expect(pills).toHaveLength(4);

    pills.forEach((pill) => {
      expect(
        pill.className.includes('border-utility-brand-200') ||
          pill.classList.toString().includes('brand')
      ).toBeTruthy();
    });
  });

  it('should show all gate step pills as passed when gate step passes', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: true, mandatory: true },
          { name: 'GetSchemas', passed: true, mandatory: true },
        ]}
      />
    );

    fireEvent.click(
      screen
        .getByTestId('connection-gate-phase')
        .querySelector('button') as HTMLButtonElement
    );

    const pills = screen.getAllByTestId('gate-step-pill');

    expect(pills).toHaveLength(4);

    pills.forEach((pill) => {
      expect(pill.className).toContain('success');
    });
  });

  it('should hide the gate card when gate step fails', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
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
      screen.queryByTestId('connection-gate-phase')
    ).not.toBeInTheDocument();
  });

  it('should show and hide raw connection logs', () => {
    render(<TestConnectionModal {...commonProps} />);

    fireEvent.click(screen.getByText('message.show-raw-connection-log-lines'));

    const rawLog = screen.getByTestId('raw-connection-log');

    expect(rawLog).toHaveTextContent('Error message');

    expect(rawLog).not.toHaveTextContent('> Step 2');

    fireEvent.click(screen.getByText('message.hide-raw-connection-log-lines'));

    expect(screen.queryByTestId('raw-connection-log')).not.toBeInTheDocument();
  });

  it('should show executedCommand with > prefix in raw log', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        testConnectionStepResult={[
          {
            name: 'Step 1',
            passed: true,
            mandatory: true,
            executedCommand: 'SELECT 1',
            message: 'Connected (12 ms)',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText('message.show-raw-connection-log-lines'));

    const rawLog = screen.getByTestId('raw-connection-log');

    expect(rawLog).toHaveTextContent('> SELECT 1');
    expect(rawLog).toHaveTextContent('Connected (12 ms)');
    expect(rawLog).not.toHaveTextContent('> Step 1');
  });

  it('should render all lines of a SQLAlchemy multi-line errorLog in error color', () => {
    // Real SQLAlchemy format: truly empty line between SQL comment and SELECT
    const multiLineError = [
      '(pymysql.err.OperationalError) (1142, "SELECT command denied")',
      '[SQL: /* {"app": "OpenMetadata"} */',
      '',
      'SELECT `argument` from mysql.general_log limit 1;',
      ']',
      '(Background on this error at: https://sqlalche.me/e/20/e3q8)',
    ].join('\n');

    render(
      <TestConnectionModal
        {...commonProps}
        testConnectionStepResult={[
          {
            name: 'Step 1',
            passed: false,
            mandatory: true,
            errorLog: multiLineError,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText('message.show-raw-connection-log-lines'));

    const rawLog = screen.getByTestId('raw-connection-log');
    const errorSpans = rawLog.querySelectorAll('.tw\\:text-utility-error-300');

    expect(errorSpans.length).toBe(6);
    expect(errorSpans[0]).toHaveTextContent('OperationalError');
    expect(errorSpans[1]).toHaveTextContent('[SQL:');
    expect(errorSpans[3]).toHaveTextContent('SELECT');
    expect(errorSpans[4]).toHaveTextContent(']');
    expect(errorSpans[5]).toHaveTextContent('sqlalche.me');
  });

  it('should render step 2 success message in success color even after step 1 error', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        testConnectionStepResult={[
          {
            name: 'Step 1',
            passed: false,
            mandatory: true,
            errorLog: 'ConnectionError: refused',
          },
          {
            name: 'Step 2',
            passed: true,
            mandatory: true,
            message: 'Connection successful',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText('message.show-raw-connection-log-lines'));

    const rawLog = screen.getByTestId('raw-connection-log');

    const successSpan = Array.from(
      rawLog.querySelectorAll('.tw\\:text-utility-success-300')
    ).find((el) => el.textContent?.includes('Connection successful'));

    expect(successSpan).toBeInTheDocument();

    const errorSpans = Array.from(
      rawLog.querySelectorAll('.tw\\:text-utility-error-300')
    );

    expect(
      errorSpans.find((el) => el.textContent?.includes('Connection successful'))
    ).toBeUndefined();
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

  it('should hide gate card when API errors before workflow runs (no step results)', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[]}
      />
    );

    expect(
      screen.queryByTestId('connection-gate-phase')
    ).not.toBeInTheDocument();
  });

  it('should show Edit Connection and Retry Test buttons when test fails', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: false, mandatory: true },
        ]}
      />
    );

    expect(screen.getByTestId('edit-connection-button')).toBeInTheDocument();
    expect(screen.getByTestId('retry-test-button')).toBeInTheDocument();
  });

  it('should call onConfirm when Edit Connection is clicked', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: false, mandatory: true },
        ]}
      />
    );

    fireEvent.click(screen.getByTestId('edit-connection-button'));

    expect(onConfirmMock).toHaveBeenCalled();
  });

  it('should call onTestConnection when Retry Test is clicked', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: false, mandatory: true },
        ]}
      />
    );

    fireEvent.click(screen.getByTestId('retry-test-button'));

    expect(mockOnTestConnection).toHaveBeenCalled();
  });

  it('should render the remediation card when the gate step fails', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          {
            name: 'CheckAccess',
            passed: false,
            errorLog: 'Connection refused',
            mandatory: true,
          },
        ]}
      />
    );

    expect(
      screen.getByTestId('connection-remediation-card')
    ).toBeInTheDocument();
  });

  it('should render the remediation card when a required capability step fails', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: true, mandatory: true },
          {
            name: 'GetSchemas',
            passed: false,
            errorLog: 'Schema access denied',
            mandatory: true,
          },
        ]}
      />
    );

    expect(
      screen.getByTestId('connection-remediation-card')
    ).toBeInTheDocument();
  });

  it('should not render the remediation card when test succeeds', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: true, mandatory: true },
          { name: 'GetSchemas', passed: true, mandatory: true },
        ]}
      />
    );

    expect(
      screen.queryByTestId('connection-remediation-card')
    ).not.toBeInTheDocument();
  });

  it('should hide gate card and show remediation card when required capability step fails', () => {
    render(
      <TestConnectionModal
        {...commonProps}
        progress={100}
        testConnectionStep={[
          { name: 'CheckAccess', description: 'Gate', mandatory: true },
          { name: 'GetSchemas', description: 'Schemas', mandatory: true },
        ]}
        testConnectionStepResult={[
          { name: 'CheckAccess', passed: true, mandatory: true },
          {
            name: 'GetSchemas',
            passed: false,
            errorLog: 'Schema access denied',
            mandatory: true,
          },
        ]}
      />
    );

    expect(
      screen.queryByTestId('connection-gate-phase')
    ).not.toBeInTheDocument();

    expect(
      screen.getByTestId('connection-remediation-card')
    ).toBeInTheDocument();
  });
});

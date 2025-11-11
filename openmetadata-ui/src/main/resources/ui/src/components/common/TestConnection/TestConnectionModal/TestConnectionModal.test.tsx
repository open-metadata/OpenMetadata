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
  it('Should render the modal title', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getByText('label.connection-status')).toBeInTheDocument();
  });

  it('Should render the steps and their results', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
  });

  it('Should render the success icon for a passing step', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getByTestId('success-badge')).toBeInTheDocument();
  });

  it('Should render the fail icon for a failing step', () => {
    render(<TestConnectionModal {...commonProps} />);

    expect(screen.getByTestId('fail-badge')).toBeInTheDocument();
  });

  it('Should render the awaiting status for a step being tested', () => {
    render(<TestConnectionModal {...commonProps} isTestingConnection />);

    expect(screen.getAllByText('label.awaiting-status...')).toHaveLength(2);
  });

  it('Should call onCancel when the cancel button is clicked', () => {
    render(<TestConnectionModal {...commonProps} />);
    const cancelButton = screen.getByText('Cancel');

    fireEvent.click(cancelButton);

    expect(onCancelMock).toHaveBeenCalled();
  });

  it('Should call onConfirm when the confirm button is clicked', () => {
    render(<TestConnectionModal {...commonProps} />);
    const okButton = screen.getByText('OK');

    fireEvent.click(okButton);

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
});

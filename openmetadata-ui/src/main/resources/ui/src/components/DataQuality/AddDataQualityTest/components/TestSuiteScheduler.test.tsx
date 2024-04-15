/*
 *  Copyright 2024 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import TestSuiteScheduler from './TestSuiteScheduler';

jest.mock('../../../common/CronEditor/CronEditor', () =>
  jest.fn().mockImplementation(() => <div>CronEditor.component</div>)
);

const mockProps = {
  initialData: {
    repeatFrequency: 'daily',
    enableDebugLog: false,
  },
  isLoading: false,
  onCancel: jest.fn(),
  onSubmit: jest.fn(),
  buttonProps: {
    cancelText: 'Cancel',
    okText: 'Submit',
  },
  includePeriodOptions: ['daily', 'weekly', 'monthly'],
};

describe('TestSuiteScheduler', () => {
  it('should render component with initial data', () => {
    render(<TestSuiteScheduler allowEnableDebugLog {...mockProps} />);

    expect(screen.getByText('CronEditor.component')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.getByTestId('enable-debug-log')).toBeInTheDocument();
    expect(screen.getByTestId('enable-debug-log')).not.toBeChecked();
  });

  it('should call onSubmit with correct data when form is submitted', async () => {
    render(<TestSuiteScheduler allowEnableDebugLog {...mockProps} />);

    await act(async () => {
      fireEvent.click(await screen.findByTestId('enable-debug-log'));
    });
    const submitButton = await screen.findByTestId('deploy-button');

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith({
      repeatFrequency: 'daily',
      enableDebugLog: true,
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<TestSuiteScheduler allowEnableDebugLog {...mockProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('should render component without enable debug log', () => {
    render(<TestSuiteScheduler {...mockProps} />);

    expect(screen.getByText('CronEditor.component')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.queryByTestId('enable-debug-log')).not.toBeInTheDocument();
  });
});

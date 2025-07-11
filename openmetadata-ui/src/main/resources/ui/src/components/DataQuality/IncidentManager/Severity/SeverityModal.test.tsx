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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import SeverityModal from './SeverityModal.component';

const mockProps = {
  initialSeverity: Severities.Severity1,
  onCancel: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue([]),
};

describe('SeverityModal', () => {
  it('Should render component', async () => {
    render(<SeverityModal {...mockProps} />);

    const form = await screen.findByTestId('severity-form');
    const severitySelect = await screen.findByTestId('severity-form');

    expect(form).toBeInTheDocument();
    expect(severitySelect).toBeInTheDocument();
  });

  it('Initial value should be visible', async () => {
    render(<SeverityModal {...mockProps} />);

    expect(await screen.findByText('Severity 1')).toBeInTheDocument();
  });

  it('onCancel should work', async () => {
    render(<SeverityModal {...mockProps} />);
    const cancelBtn = await screen.findByText('label.cancel');
    fireEvent.click(cancelBtn);

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('onSubmit should work', async () => {
    render(<SeverityModal {...mockProps} />);
    const submitBtn = await screen.findByText('label.save');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith(Severities.Severity1);
  });
});

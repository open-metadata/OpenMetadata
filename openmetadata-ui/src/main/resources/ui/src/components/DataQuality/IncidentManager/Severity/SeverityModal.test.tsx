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
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import SeverityModal from './SeverityModal.component';

const mockProps = {
  initialSeverity: Severities.Severity1,
  onCancel: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue([]),
};

const press = (element: HTMLElement) => {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerUp(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.click(element);
};

const pickSeverity = async (optionName: string) => {
  await act(async () => {
    press(screen.getByRole('button', { name: /label.severity/ }));
  });
  await act(async () => {
    press(screen.getByRole('option', { name: optionName }));
  });
};

describe('SeverityModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should render component', async () => {
    render(<SeverityModal {...mockProps} />);

    expect(await screen.findByTestId('severity-form')).toBeInTheDocument();
    expect(await screen.findByTestId('severity-select')).toBeInTheDocument();
  });

  it('Initial value should be visible', async () => {
    render(<SeverityModal {...mockProps} />);

    expect(
      await screen.findByRole('button', { name: /Severity 1/ })
    ).toBeInTheDocument();
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

  it('should submit the newly picked severity', async () => {
    render(<SeverityModal {...mockProps} />);

    await pickSeverity('Severity 3');
    await act(async () => {
      fireEvent.click(screen.getByText('label.save'));
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith(Severities.Severity3);
  });

  it('should submit undefined once the severity is cleared', async () => {
    render(<SeverityModal {...mockProps} />);

    await pickSeverity('label.no-entity');

    expect(
      screen.getByRole('button', { name: /label.please-select-entity/ })
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('label.save'));
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith(undefined);
  });
});

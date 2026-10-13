/*
 *  Copyright 2025 Collate.
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
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  DataContract,
  MaxLatencyUnit,
  RefreshFrequencyUnit,
  RetentionUnit,
} from '../../../generated/entity/data/dataContract';
import { mockTableData } from '../../../mocks/TableVersion.mock';
import { ContractSLAFormTab } from './ContractSLAFormTab';

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => ({ data: mockTableData }),
}));

const mockOnChange = jest.fn();
const mockOnPrev = jest.fn();

const mockContract: Partial<DataContract> = {
  sla: {
    availabilityTime: '09:30',
    maxLatency: { unit: MaxLatencyUnit.Hour, value: 2 },
    refreshFrequency: { interval: 1, unit: RefreshFrequencyUnit.Day },
    retention: { period: 30, unit: RetentionUnit.Day },
  },
};

const renderForm = (initialValues?: Partial<DataContract>) =>
  render(
    <ContractSLAFormTab
      buttonProps={{ prevLabel: 'Custom Previous' }}
      initialValues={initialValues}
      onChange={mockOnChange}
      onPrev={mockOnPrev}
    />
  );

const getNumberInput = (label: string) =>
  screen.getByRole('spinbutton', { name: label });

describe('ContractSLAFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the step header and every SLA section', () => {
    renderForm();

    expect(screen.getByText('label.sla')).toBeInTheDocument();
    expect(
      screen.getByText('message.data-contract-sla-description')
    ).toBeInTheDocument();
    expect(screen.getByText('label.refresh-frequency')).toBeInTheDocument();
    expect(screen.getByText('label.max-latency')).toBeInTheDocument();
    expect(screen.getByText('label.availability-time')).toBeInTheDocument();
    expect(screen.getByText('label.retention')).toBeInTheDocument();
    expect(screen.getByText('label.column-name')).toBeInTheDocument();
  });

  it('prefills the values of an existing SLA', () => {
    renderForm(mockContract);

    expect(getNumberInput('label.interval')).toHaveValue(1);
    expect(getNumberInput('label.value')).toHaveValue(2);
    expect(getNumberInput('label.period')).toHaveValue(30);
    expect(screen.getAllByText('label.day').length).toBeGreaterThan(0);
    expect(screen.getAllByText('label.hour').length).toBeGreaterThan(0);
  });

  it('does not report changes when it seeds the form', () => {
    renderForm(mockContract);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('reports the whole SLA when one value changes', () => {
    renderForm(mockContract);

    fireEvent.change(getNumberInput('label.interval'), {
      target: { value: '6' },
    });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      sla: {
        availabilityTime: '09:30',
        maxLatency: { unit: MaxLatencyUnit.Hour, value: 2 },
        refreshFrequency: { interval: 6, unit: RefreshFrequencyUnit.Day },
        retention: { period: 30, unit: RetentionUnit.Day },
      },
    });
  });

  it('leaves out a negative value and flags it', async () => {
    renderForm(mockContract);

    fireEvent.change(getNumberInput('label.period'), {
      target: { value: '-1' },
    });

    const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

    expect(sla.retention).toBeUndefined();
    expect(sla.refreshFrequency).toEqual({
      interval: 1,
      unit: RefreshFrequencyUnit.Day,
    });
    expect(
      await screen.findByText('message.entity-size-less-than')
    ).toBeInTheDocument();
  });

  it('goes back with the previous button and has no next button', () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Custom Previous' }));

    expect(mockOnPrev).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: /label.next/ })
    ).not.toBeInTheDocument();
  });
});

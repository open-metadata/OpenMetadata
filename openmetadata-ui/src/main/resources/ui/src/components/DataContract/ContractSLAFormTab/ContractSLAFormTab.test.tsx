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
import { Table } from '../../../generated/entity/data/table';
import { mockTableData } from '../../../mocks/TableVersion.mock';
import { ContractSLAFormTab } from './ContractSLAFormTab';

let mockTable: Table = mockTableData;

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => ({ data: mockTable }),
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
    mockTable = mockTableData;
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

  describe('round-trip preservation (non-form-shaped stored SLA)', () => {
    // The single mocked table column exposes this fully qualified name.
    const SHOP_ID_FQN = 'sample_data.ecommerce_db.shopify."dim.shop".shop_id';

    it('does not report changes when seeding non-form-shaped SLA values', () => {
      renderForm({
        sla: {
          availabilityTime: '09:00 UTC',
          columnName: SHOP_ID_FQN,
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('keeps a non-HH:mm availabilityTime when an unrelated SLA field is edited', () => {
      renderForm({
        sla: {
          availabilityTime: '09:00 UTC',
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

      // The form can represent "09:00 UTC" (it parses the HH:mm prefix), so the
      // value is preserved (normalized to "09:00") rather than removed.
      expect(sla.availabilityTime).toBe('09:00');
      expect(sla.retention).toEqual({ period: 45, unit: RetentionUnit.Day });
    });

    it('preserves an unparseable availabilityTime when an unrelated SLA field is edited', () => {
      renderForm({
        sla: {
          availabilityTime: '9 AM',
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

      // The form cannot represent "9 AM"; the stored value must survive intact.
      expect(sla.availabilityTime).toBe('9 AM');
      expect(sla.retention).toEqual({ period: 45, unit: RetentionUnit.Day });
    });

    it('normalizes a leaf-name columnName to the FQN when an unrelated SLA field is edited', () => {
      renderForm({
        sla: {
          columnName: 'shop_id',
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

      // The leaf matches a table column, so it is preserved (as the resolved FQN).
      expect(sla.columnName).toBe(SHOP_ID_FQN);
      expect(sla.retention).toEqual({ period: 45, unit: RetentionUnit.Day });
    });

    it('preserves an unmatched columnName when an unrelated SLA field is edited', () => {
      renderForm({
        sla: {
          columnName: 'DELETED_COLUMN',
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

      // No table column matches; the stored value must survive intact.
      expect(sla.columnName).toBe('DELETED_COLUMN');
      expect(sla.retention).toEqual({ period: 45, unit: RetentionUnit.Day });
    });

    it('preserves an FQN columnName when an unrelated SLA field is edited', () => {
      renderForm({
        sla: {
          columnName: SHOP_ID_FQN,
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

      expect(sla.columnName).toBe(SHOP_ID_FQN);
      expect(sla.retention).toEqual({ period: 45, unit: RetentionUnit.Day });
    });

    it('preserves unmodeled extra SLA keys when an unrelated SLA field is edited', () => {
      renderForm({
        sla: {
          customNote: 'important metadata',
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

      // ContractSLA is an open type; unknown keys must not become remove ops.
      expect(sla.customNote).toBe('important metadata');
      expect(sla.retention).toEqual({ period: 45, unit: RetentionUnit.Day });
    });

    it('resolves a leaf-name columnName to the top-level column, not a struct child with the same name', () => {
      mockTable = {
        ...mockTableData,
        columns: [
          {
            name: 'payload',
            fullyQualifiedName: 'svc.db.schema.orders.payload',
            children: [
              {
                name: 'updated_at',
                fullyQualifiedName: 'svc.db.schema.orders.payload.updated_at',
              },
            ],
          },
          {
            name: 'updated_at',
            fullyQualifiedName: 'svc.db.schema.orders.updated_at',
          },
        ],
      } as Table;
      renderForm({
        sla: {
          columnName: 'UPDATED_AT',
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

      expect(sla.columnName).toBe('svc.db.schema.orders.updated_at');
    });

    it('preserves a leaf-name columnName that only matches a struct child', () => {
      mockTable = {
        ...mockTableData,
        columns: [
          {
            name: 'payload',
            fullyQualifiedName: 'svc.db.schema.orders.payload',
            children: [
              {
                name: 'updated_at',
                fullyQualifiedName: 'svc.db.schema.orders.payload.updated_at',
              },
            ],
          },
        ],
      } as Table;
      renderForm({
        sla: {
          columnName: 'updated_at',
          retention: { period: 30, unit: RetentionUnit.Day },
        },
      });

      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

      expect(sla.columnName).toBe('updated_at');
    });
  });
});

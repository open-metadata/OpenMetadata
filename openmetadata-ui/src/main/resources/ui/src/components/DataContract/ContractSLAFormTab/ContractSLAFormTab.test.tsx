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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useTranslation } from 'react-i18next';
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
const mockOnRefreshValidityChange = jest.fn();
const minuteRefresh = {
  interval: 15,
  unit: RefreshFrequencyUnit.Minute,
};

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
      onRefreshValidityChange={mockOnRefreshValidityChange}
    />
  );

const getNumberInput = (label: string) =>
  screen.getByRole('spinbutton', { name: label });

const getRefreshIntervalInput = () =>
  screen.getByRole('textbox', { name: 'label.interval' });

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

    expect(getRefreshIntervalInput()).toHaveValue('1');
    expect(getRefreshIntervalInput()).toHaveAttribute('inputmode', 'numeric');
    expect(getNumberInput('label.value')).toHaveValue(2);
    expect(getNumberInput('label.period')).toHaveValue(30);
    expect(screen.getAllByText('label.day').length).toBeGreaterThan(0);
    expect(screen.getAllByText('label.hour').length).toBeGreaterThan(0);
  });

  it('offers minutes and preserves a loaded minute interval during other SLA edits', () => {
    renderForm({
      sla: { ...mockContract.sla, refreshFrequency: minuteRefresh },
    });

    expect(
      screen.getByTestId('refresh-frequency-unit-select')
    ).toHaveTextContent('label.minute');

    fireEvent.change(getNumberInput('label.period'), {
      target: { value: '45' },
    });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      sla: {
        ...mockContract.sla,
        refreshFrequency: minuteRefresh,
        retention: { period: 45, unit: RetentionUnit.Day },
      },
    });
  });

  it.each(['0', '15e', '15.5', '1.0', '2147483648', '-1'])(
    'keeps the last valid refresh interval when the minute draft is %s',
    async (interval) => {
      renderForm({
        sla: { ...mockContract.sla, refreshFrequency: minuteRefresh },
      });

      fireEvent.change(getRefreshIntervalInput(), {
        target: { value: interval },
      });
      fireEvent.change(getNumberInput('label.period'), {
        target: { value: '45' },
      });

      expect(getRefreshIntervalInput()).toHaveValue(interval);
      expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(false);
      expect(mockOnChange).not.toHaveBeenCalled();
      expect(
        await screen.findByText('message.integer-value-out-of-range')
      ).toBeInTheDocument();

      fireEvent.change(getRefreshIntervalInput(), {
        target: { value: '1' },
      });

      expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(true);
      expect(mockOnChange).toHaveBeenLastCalledWith({
        sla: {
          ...mockContract.sla,
          refreshFrequency: { ...minuteRefresh, interval: 1 },
          retention: { period: 45, unit: RetentionUnit.Day },
        },
      });
    }
  );

  it('reports a minimum of 1 in the validation message when 0 is entered for Minute', async () => {
    const defaultTranslation = useTranslation();
    const mockT = jest.fn((key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key
    );
    jest.mocked(useTranslation).mockReturnValue({
      ...defaultTranslation,
      t: mockT as unknown as typeof defaultTranslation.t,
    });

    try {
      renderForm({
        sla: { ...mockContract.sla, refreshFrequency: minuteRefresh },
      });

      fireEvent.change(getRefreshIntervalInput(), {
        target: { value: '0' },
      });

      expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(false);
      expect(mockOnChange).not.toHaveBeenCalled();
      expect(
        await screen.findByText(
          'message.integer-value-out-of-range:{"min":1,"max":2147483647}'
        )
      ).toBeInTheDocument();
    } finally {
      jest.mocked(useTranslation).mockReturnValue(defaultTranslation);
    }
  });

  it.each([
    '0',
    '0.25',
    '2.5',
    '2.5e1',
    '1.0',
    '15e',
    '0x2',
    '1e309',
    '-1',
    '2147483648',
  ])(
    'rejects %s for non-minute refresh units and requires a positive whole number',
    async (interval) => {
      renderForm({
        sla: {
          ...mockContract.sla,
          refreshFrequency: { interval: 1, unit: RefreshFrequencyUnit.Hour },
        },
      });

      fireEvent.change(getRefreshIntervalInput(), {
        target: { value: interval },
      });

      expect(getRefreshIntervalInput()).toHaveValue(interval);
      expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(false);
      expect(mockOnChange).not.toHaveBeenCalled();
      expect(
        await screen.findByText('message.integer-value-out-of-range')
      ).toBeInTheDocument();

      fireEvent.change(getRefreshIntervalInput(), {
        target: { value: '2' },
      });

      expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(true);
      expect(mockOnChange).toHaveBeenLastCalledWith({
        sla: {
          ...mockContract.sla,
          refreshFrequency: { interval: 2, unit: RefreshFrequencyUnit.Hour },
        },
      });
    }
  );

  it('clears the validation error and pair when an invalid refresh interval is cleared', async () => {
    renderForm({
      sla: { ...mockContract.sla, refreshFrequency: minuteRefresh },
    });

    fireEvent.change(getRefreshIntervalInput(), {
      target: { value: '0' },
    });

    expect(
      await screen.findByText('message.integer-value-out-of-range')
    ).toBeInTheDocument();

    fireEvent.change(getRefreshIntervalInput(), {
      target: { value: '' },
    });

    expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(true);

    await waitFor(() => {
      expect(
        screen.queryByText('message.integer-value-out-of-range')
      ).not.toBeInTheDocument();
    });

    const { refreshFrequency: _refreshFrequency, ...remainingSla } =
      mockContract.sla ?? {};

    expect(mockOnChange).toHaveBeenLastCalledWith({ sla: remainingSla });
  });

  it('preserves an untouched stored zero interval when editing another SLA field', () => {
    const legacyZeroRefresh = {
      interval: 0,
      unit: RefreshFrequencyUnit.Hour,
    };

    renderForm({
      sla: { ...mockContract.sla, refreshFrequency: legacyZeroRefresh },
    });

    fireEvent.change(getNumberInput('label.period'), {
      target: { value: '45' },
    });

    expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(true);
    expect(mockOnChange).toHaveBeenLastCalledWith({
      sla: {
        ...mockContract.sla,
        refreshFrequency: legacyZeroRefresh,
        retention: { period: 45, unit: RetentionUnit.Day },
      },
    });
  });

  it('requires both interval and unit when creating a refresh frequency', async () => {
    renderForm();

    fireEvent.change(getRefreshIntervalInput(), {
      target: { value: '15' },
    });

    expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(false);
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(
      await screen.findByText('message.field-text-is-required')
    ).toBeInTheDocument();

    const unitTrigger = within(
      screen.getByTestId('refresh-frequency-unit-select')
    ).getByRole('button');
    fireEvent.pointerDown(unitTrigger);
    fireEvent.click(unitTrigger);
    const minuteOption = await screen.findByRole('option', {
      name: 'label.minute',
    });
    fireEvent.pointerDown(minuteOption);
    fireEvent.click(minuteOption);

    expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(true);
    expect(mockOnChange).toHaveBeenLastCalledWith({
      sla: {
        refreshFrequency: minuteRefresh,
      },
    });
  });

  it('requires an interval when only a refresh unit is selected', async () => {
    renderForm();

    const unitTrigger = within(
      screen.getByTestId('refresh-frequency-unit-select')
    ).getByRole('button');
    fireEvent.pointerDown(unitTrigger);
    fireEvent.click(unitTrigger);
    const hourOption = await screen.findByRole('option', {
      name: 'label.hour',
    });
    fireEvent.pointerDown(hourOption);
    fireEvent.click(hourOption);

    expect(mockOnRefreshValidityChange).toHaveBeenLastCalledWith(false);
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(
      await screen.findByText('message.field-text-is-required')
    ).toBeInTheDocument();
  });

  it('does not report changes when it seeds the form', () => {
    renderForm(mockContract);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('reports the whole SLA when one value changes', () => {
    renderForm(mockContract);

    fireEvent.change(getRefreshIntervalInput(), {
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

  it('saves the top-level column FQN when a nested child shares its name', () => {
    mockTable = {
      ...mockTableData,
      columns: [
        {
          name: 'payload',
          fullyQualifiedName: 'svc.db.schema.orders.payload',
          children: [
            {
              name: 'created_at',
              fullyQualifiedName: 'svc.db.schema.orders.payload.created_at',
            },
          ],
        },
        {
          name: 'created_at',
          fullyQualifiedName: 'svc.db.schema.orders.created_at',
        },
      ],
    } as Table;

    renderForm();
    const combobox = screen.getByRole('combobox', {
      name: 'label.column-name',
    });
    fireEvent.focus(combobox);
    fireEvent.mouseDown(combobox);
    const option = screen.getByRole('option', { name: 'created_at' });
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    const [{ sla }] = mockOnChange.mock.calls.at(-1) ?? [{}];

    expect(sla.columnName).toBe('svc.db.schema.orders.created_at');
  });
});

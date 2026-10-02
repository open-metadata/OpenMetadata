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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { compare } from 'fast-json-patch';
import {
  ContractSLA,
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

  // Regression coverage for the `>= 0` guard that admitted `null` (because
  // `null >= 0` is `true` in JavaScript). Clearing an antd InputNumber emits
  // `null`; the guard must now drop the SLA sub-object instead of emitting
  // `{ ..., value: null }` (which corrupted contracts via PATCH `replace` ops).
  describe('Cleared numeric value guards (null-input regression)', () => {
    const slaButtonProps = {
      nextLabel: 'Next',
      prevLabel: 'Prev',
      isNextVisible: true,
    };

    const getLastSla = (onChangeMock: jest.Mock): ContractSLA | undefined =>
      onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1]?.[0]?.sla;

    const renderWithSla = (onChange: jest.Mock) =>
      render(
        <ContractSLAFormTab
          buttonProps={slaButtonProps}
          initialValues={mockContract}
          onChange={onChange}
          onPrev={jest.fn()}
        />
      );

    const getSpinbutton = (name: RegExp) =>
      screen.getByRole('spinbutton', { name }) as HTMLInputElement;

    const clearField = async (name: RegExp) => {
      await act(async () => {
        fireEvent.change(getSpinbutton(name), { target: { value: '' } });
      });
    };

    const setField = async (name: RegExp, value: string) => {
      await act(async () => {
        fireEvent.change(getSpinbutton(name), { target: { value } });
      });
    };

    // Predicate shared by the JSON-patch safety tests: true when a patch op
    // replaces an SLA numeric property with `null` (the corruption shape).
    const isNullNumericReplacer = (op: {
      op: string;
      path: string;
      value?: unknown;
    }): boolean =>
      op.op === 'replace' &&
      op.value === null &&
      /^\/sla\/(maxLatency\/value|refreshFrequency\/interval|retention\/period)$/.test(
        op.path
      );

    it('omits maxLatency (not { value: null }) when the value is cleared but unit remains', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      // Confirms pre-fill happened, so clearing the value leaves the unit selected
      // (the exact sequence that exposed the `null >= 0` coercion bug).
      expect(getSpinbutton(/label.value/i).value).toBe('2');

      await clearField(/label.value/i);

      const sla = getLastSla(onChange);

      expect(sla).toBeDefined();
      expect(sla?.maxLatency).toBeUndefined();
      expect(JSON.stringify(sla)).not.toContain('null');
    });

    it('omits refreshFrequency (not { interval: null }) when the interval is cleared but unit remains', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      expect(getSpinbutton(/label.interval/i).value).toBe('1');

      await clearField(/label.interval/i);

      const sla = getLastSla(onChange);

      expect(sla).toBeDefined();
      expect(sla?.refreshFrequency).toBeUndefined();
      expect(JSON.stringify(sla)).not.toContain('null');
    });

    it('omits retention (not { period: null }) when the period is cleared but unit remains', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      expect(getSpinbutton(/label.period/i).value).toBe('30');

      await clearField(/label.period/i);

      const sla = getLastSla(onChange);

      expect(sla).toBeDefined();
      expect(sla?.retention).toBeUndefined();
      expect(JSON.stringify(sla)).not.toContain('null');
    });

    it('still emits maxLatency when value is 0 (zero stays a valid value)', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await setField(/label.value/i, '0');

      const sla = getLastSla(onChange);

      expect(sla?.maxLatency).toEqual({ unit: MaxLatencyUnit.Hour, value: 0 });
    });

    it('still emits refreshFrequency when interval is 0', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await setField(/label.interval/i, '0');

      const sla = getLastSla(onChange);

      expect(sla?.refreshFrequency).toEqual({
        interval: 0,
        unit: RefreshFrequencyUnit.Day,
      });
    });

    it('still emits retention when period is 0', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await setField(/label.period/i, '0');

      const sla = getLastSla(onChange);

      expect(sla?.retention).toEqual({ period: 0, unit: RetentionUnit.Day });
    });

    it('omits maxLatency when a negative value is entered (>= 0 guard still rejects negatives)', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await setField(/label.value/i, '-5');

      const sla = getLastSla(onChange);

      expect(sla?.maxLatency).toBeUndefined();
    });

    it('maxLatency clear yields a safe JSON patch (remove, not replace:null) via fast-json-patch compare', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await clearField(/label.value/i);

      const sla = getLastSla(onChange);
      // Reproduces AddDataContract.handleSave's `compare(filteredContract, {...formValues})`
      // against the stored SLA, the exact pipeline that produced the corrupting
      // `{op:'replace','/sla/maxLatency/value',value:null}` op on HEAD.
      const patch = compare({ sla: mockContract.sla }, { sla });

      expect(patch.find(isNullNumericReplacer)).toBeUndefined();
      expect(patch).toContainEqual({ op: 'remove', path: '/sla/maxLatency' });
    });

    it('refreshFrequency clear yields a safe JSON patch (remove, not replace:null) via fast-json-patch compare', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await clearField(/label.interval/i);

      const sla = getLastSla(onChange);
      const patch = compare({ sla: mockContract.sla }, { sla });

      expect(patch.find(isNullNumericReplacer)).toBeUndefined();
      expect(patch).toContainEqual({
        op: 'remove',
        path: '/sla/refreshFrequency',
      });
    });

    it('retention clear yields a safe JSON patch (remove, not replace:null) via fast-json-patch compare', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await clearField(/label.period/i);

      const sla = getLastSla(onChange);
      const patch = compare({ sla: mockContract.sla }, { sla });

      expect(patch.find(isNullNumericReplacer)).toBeUndefined();
      expect(patch).toContainEqual({ op: 'remove', path: '/sla/retention' });
    });
  });
});

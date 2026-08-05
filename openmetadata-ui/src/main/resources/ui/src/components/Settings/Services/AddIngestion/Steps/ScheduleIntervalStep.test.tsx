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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../../constants/Schedular.constants';
import { LOADING_STATE } from '../../../../../enums/common.enum';
import { ScheduleIntervalHandle } from './ScheduleInterval.interface';
import ScheduleIntervalStep from './ScheduleIntervalStep';

jest.mock('./ScheduleIntervalV1', () =>
  jest
    .fn()
    .mockImplementation(({ value, onChange, disabled, onValidityChange }) => (
      <div data-testid="schedule-interval-v1">
        <span data-testid="cron-value">{value ?? 'UNDEFINED'}</span>
        <span data-testid="cron-disabled">{String(Boolean(disabled))}</span>
        <button
          data-testid="set-weekly-btn"
          onClick={() => onChange?.('0 0 * * 0')}>
          weekly
        </button>
        <button
          data-testid="set-on-demand-btn"
          onClick={() => {
            // Mirrors the real component, which drops any custom cron error
            // when the schedular card changes.
            onValidityChange?.(true);
            onChange?.(undefined);
          }}>
          on demand
        </button>
        <button
          data-testid="clear-custom-cron-btn"
          onClick={() => {
            onValidityChange?.(false);
            onChange?.('');
          }}>
          clear custom cron
        </button>
      </div>
    ))
);

const mockOnDeploy = jest.fn();
const mockOnBack = jest.fn();
const mockOnFocus = jest.fn();

const renderStep = (
  props: Partial<Parameters<typeof ScheduleIntervalStep>[0]> = {},
  ref?: React.Ref<ScheduleIntervalHandle>
) =>
  render(
    <ScheduleIntervalStep
      defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
      ref={ref}
      status={LOADING_STATE.INITIAL}
      onBack={mockOnBack}
      onDeploy={mockOnDeploy}
      onFocus={mockOnFocus}
      {...props}
    />
  );

describe('ScheduleIntervalStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the scheduler along with the retries and raise on error fields', () => {
    renderStep();

    expect(screen.getByTestId('schedule-interval-v1')).toBeInTheDocument();
    expect(screen.getByTestId('retries')).toBeInTheDocument();
    expect(screen.getByTestId('raise-on-error')).toBeInTheDocument();
  });

  it('should seed the default schedule when adding a new pipeline', () => {
    renderStep();

    expect(screen.getByTestId('cron-value')).toHaveTextContent(
      DEFAULT_SCHEDULE_CRON_DAILY
    );
  });

  it('should keep an empty cron in edit mode so the pipeline stays on demand', () => {
    renderStep({ isEditMode: true, initialData: { cron: undefined } });

    expect(screen.getByTestId('cron-value')).toHaveTextContent('UNDEFINED');
  });

  it('should forward the disabled flag to the scheduler', () => {
    renderStep({ disabled: true });

    expect(screen.getByTestId('cron-disabled')).toHaveTextContent('true');
  });

  it('should submit the normalized payload when the parent triggers the handle', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep({ initialData: { retries: 3, raiseOnError: false } }, ref);

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).toHaveBeenCalledWith({
      cron: DEFAULT_SCHEDULE_CRON_DAILY,
      retries: 3,
      raiseOnError: false,
    });
  });

  it('should clamp a negative retries value to zero before deploying', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep({}, ref);

    fireEvent.change(
      within(screen.getByTestId('retries')).getByRole('spinbutton'),
      { target: { value: '-5' } }
    );

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).toHaveBeenCalledWith({
      cron: DEFAULT_SCHEDULE_CRON_DAILY,
      retries: 0,
      raiseOnError: true,
    });
  });

  it('should submit an undefined cron once the scheduler is switched to on demand', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep({}, ref);

    fireEvent.click(screen.getByTestId('set-on-demand-btn'));

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).toHaveBeenCalledWith({
      cron: undefined,
      retries: 0,
      raiseOnError: true,
    });
  });

  it('should submit the cron selected in the scheduler', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep({}, ref);

    fireEvent.click(screen.getByTestId('set-weekly-btn'));

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ cron: '0 0 * * 0' })
    );
  });

  it('should block the submit while the scheduler reports an unusable custom cron', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep({}, ref);

    // Clearing the custom expression is not the same as choosing On Demand, so
    // the deploy must not go through.
    fireEvent.click(screen.getByTestId('clear-custom-cron-btn'));

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).not.toHaveBeenCalled();

    // Choosing On Demand is the supported way to end up without a schedule.
    fireEvent.click(screen.getByTestId('set-on-demand-btn'));

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ cron: undefined })
    );
  });

  it('should block the submit and surface the error for a cron more frequent than an hour', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep({ initialData: { cron: '*/5 * * * *' } }, ref);

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).not.toHaveBeenCalled();
    expect(screen.getByTestId('cron-error')).toBeInTheDocument();
  });

  it('should render the action buttons only when the footer is not hidden', () => {
    const { rerender } = renderStep({ showActionButtons: false });

    expect(screen.queryByTestId('deploy-button')).not.toBeInTheDocument();

    rerender(
      <ScheduleIntervalStep
        showActionButtons
        defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
        status={LOADING_STATE.INITIAL}
        onBack={mockOnBack}
        onDeploy={mockOnDeploy}
      />
    );

    fireEvent.click(screen.getByTestId('back-button'));

    expect(mockOnBack).toHaveBeenCalled();
  });
});

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
jest.mock('../../../../../utils/i18next/i18nextUtil', () => ({
  getCurrentLocaleForConstrue: jest.fn().mockReturnValue('en-US'),
}));

jest.mock('cronstrue/i18n', () => ({
  __esModule: true,
  default: { toString: jest.fn().mockReturnValue('every day') },
}));

import { FormField, HookForm } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../../constants/Schedular.constants';
import ScheduleIntervalV1 from './ScheduleIntervalV1';

// Mirrors how consumers wire the scheduler: the cron is stored as an empty
// string when cleared, but handed back to the component as undefined.
const FormWrapper = ({
  onValidityChange,
}: {
  onValidityChange?: (isValid: boolean) => void;
}) => {
  const form = useForm<{ cron?: string }>({
    defaultValues: { cron: DEFAULT_SCHEDULE_CRON_DAILY },
  });

  return (
    <HookForm form={form} onSubmit={jest.fn()}>
      <FormField control={form.control} name="cron">
        {({ field }) => (
          <ScheduleIntervalV1
            defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
            entity="test"
            value={field.value || undefined}
            onChange={(cron) => field.onChange(cron ?? '')}
            onValidityChange={onValidityChange}
          />
        )}
      </FormField>
    </HookForm>
  );
};

describe('ScheduleIntervalV1 react-hook-form wiring', () => {
  it('switches to on demand inside an RHF FormField using the empty-string cron sentinel', () => {
    const Wrapper = () => {
      const form = useForm<{ cron?: string }>({
        defaultValues: { cron: DEFAULT_SCHEDULE_CRON_DAILY },
      });

      return (
        <HookForm form={form} onSubmit={jest.fn()}>
          <FormField control={form.control} name="cron">
            {({ field }) => (
              <>
                <div data-testid="probe">
                  {JSON.stringify(field.value ?? 'UNDEF')}
                </div>
                <ScheduleIntervalV1
                  defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
                  entity="test"
                  value={field.value || undefined}
                  onChange={(cron) => field.onChange(cron ?? '')}
                />
              </>
            )}
          </FormField>
        </HookForm>
      );
    };

    render(<Wrapper />);

    expect(screen.getByTestId('schedular-schedule')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('schedular-on-demand'));

    expect(screen.getByTestId('probe').textContent).toBe('""');
    expect(
      screen
        .getByTestId('schedular-on-demand')
        .querySelector('[data-testid="selected-indicator"]')
    ).toBeInTheDocument();
  });

  it('keeps the custom field selected and editable while a cron is being typed', () => {
    render(<FormWrapper />);

    fireEvent.click(screen.getByTestId('frequency-custom'));

    const input = screen.getByRole('textbox');

    // A half typed expression is invalid, so it is never emitted to the parent.
    // The field must still hold it instead of being reset from the stale value.
    fireEvent.change(input, { target: { value: '0 0 * *' } });

    expect(screen.getByRole('textbox')).toHaveValue('0 0 * *');
    expect(screen.getByTestId('custom-cron-error')).toBeInTheDocument();

    // Completing it emits, and the echo back from the form must not switch the
    // frequency to Daily even though the cron matches the daily pattern.
    fireEvent.change(input, { target: { value: '0 0 * * *' } });

    expect(screen.getByRole('textbox')).toHaveValue('0 0 * * *');
    expect(screen.queryByTestId('custom-cron-error')).not.toBeInTheDocument();
  });

  it('stays on the schedule card and reports a required error when the custom cron is cleared in one go', () => {
    const handleValidityChange = jest.fn();
    render(<FormWrapper onValidityChange={handleValidityChange} />);

    fireEvent.click(screen.getByTestId('frequency-custom'));

    // Select-all + backspace clears the field in a single change event. The
    // emitted empty cron comes back as undefined, which must not be mistaken
    // for an external switch to on demand.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(
      screen
        .getByTestId('schedular-schedule')
        .querySelector('[data-testid="selected-indicator"]')
    ).toBeInTheDocument();
    expect(screen.getByTestId('custom-cron-error')).toBeInTheDocument();
    expect(handleValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('drops a stale custom cron error when the frequency is switched away and back', () => {
    const handleValidityChange = jest.fn();
    render(<FormWrapper onValidityChange={handleValidityChange} />);

    fireEvent.click(screen.getByTestId('frequency-custom'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '0 0 * *' },
    });

    expect(screen.getByTestId('custom-cron-error')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('frequency-day'));
    fireEvent.click(screen.getByTestId('frequency-custom'));

    // The frequency switch restored a valid cron, so the message from the
    // previous expression must be gone with it.
    expect(screen.queryByTestId('custom-cron-error')).not.toBeInTheDocument();
    expect(handleValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('emits onChange(undefined) when the on demand card is clicked', () => {
    const handleChange = jest.fn();
    render(
      <ScheduleIntervalV1
        defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
        entity="test"
        value={DEFAULT_SCHEDULE_CRON_DAILY}
        onChange={handleChange}
      />
    );
    fireEvent.click(screen.getByTestId('schedular-on-demand'));

    expect(handleChange).toHaveBeenCalledWith(undefined);
  });
});

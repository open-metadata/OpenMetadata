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

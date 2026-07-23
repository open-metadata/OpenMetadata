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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../../constants/Schedular.constants';
import { LOADING_STATE } from '../../../../../enums/common.enum';
import { ScheduleIntervalHandle } from './ScheduleInterval.interface';
import ScheduleIntervalStep from './ScheduleIntervalStep';

const mockOnDeploy = jest.fn();

const renderStep = (ref: React.Ref<ScheduleIntervalHandle>) =>
  render(
    <ScheduleIntervalStep
      defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
      ref={ref}
      status={LOADING_STATE.INITIAL}
      onDeploy={mockOnDeploy}
    />
  );

describe('ScheduleIntervalStep with the real scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not deploy while the custom cron is empty', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep(ref);

    fireEvent.click(screen.getByTestId('frequency-custom'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

    expect(screen.getByTestId('custom-cron-error')).toBeInTheDocument();

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).not.toHaveBeenCalled();
  });

  it('should not deploy while the custom cron is malformed', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep(ref);

    fireEvent.click(screen.getByTestId('frequency-custom'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '0 0 * *' },
    });

    expect(screen.getByTestId('custom-cron-error')).toBeInTheDocument();

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).not.toHaveBeenCalled();
  });

  it('should deploy once the custom cron is valid again', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep(ref);

    fireEvent.click(screen.getByTestId('frequency-custom'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '0 3 * * *' },
    });

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ cron: '0 3 * * *' })
    );
  });

  it('should deploy with no schedule when on demand is selected', async () => {
    const ref = createRef<ScheduleIntervalHandle>();
    renderStep(ref);

    fireEvent.click(screen.getByTestId('schedular-on-demand'));

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ cron: undefined })
    );
  });
});

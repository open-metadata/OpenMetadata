/*
 *  Copyright 2026 Collate.
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
import {
  App,
  AppType,
  ScheduleTimeline,
} from '../../../../../../generated/entity/applications/app';
import ScheduleInterval from '../../../../../Settings/Services/AddIngestion/Steps/ScheduleInterval';
import AppScheduleEdit from './AppScheduleEdit';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ config: undefined }),
}));

interface ScheduleIntervalStubProps {
  onChange: (cron: string) => void;
  onValidityChange: (isValid: boolean) => void;
}

jest.mock(
  '../../../../../Settings/Services/AddIngestion/Steps/ScheduleInterval',
  () =>
    jest.fn(({ onChange, onValidityChange }: ScheduleIntervalStubProps) => (
      <>
        <button onClick={() => onChange('0 12 * * 3')}>Change schedule</button>
        <button onClick={() => onValidityChange(false)}>Make invalid</button>
      </>
    ))
);

const app = {
  name: 'SearchIndexingApplication',
  appType: AppType.Internal,
  appSchedule: {
    scheduleTimeline: ScheduleTimeline.Custom,
    cronExpression: '30 0 * * 0',
  },
} as App;

const renderEdit = (props: Partial<Parameters<typeof AppScheduleEdit>[0]>) => {
  const onSave = jest.fn();
  const onCancel = jest.fn();
  render(
    <AppScheduleEdit
      appData={app}
      isSaving={false}
      onCancel={onCancel}
      onSave={onSave}
      {...props}
    />
  );

  return { onSave, onCancel };
};

describe('AppScheduleEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts from the app's current schedule and its allowed options", () => {
    renderEdit({});

    expect(ScheduleInterval).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: '30 0 * * 0',
        defaultSchedule: '0 0 * * *',
        includePeriodOptions: undefined,
      }),
      expect.anything()
    );
  });

  it('saves the schedule the user picked', () => {
    const { onSave } = renderEdit({});

    fireEvent.click(screen.getByText('Change schedule'));
    fireEvent.click(screen.getByTestId('save-button'));

    expect(onSave).toHaveBeenCalledWith('0 12 * * 3');
  });

  it('saves an empty cron for an app that has no schedule yet', () => {
    const { onSave } = renderEdit({
      appData: { ...app, appSchedule: undefined },
    });

    expect(ScheduleInterval).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: undefined }),
      expect.anything()
    );

    fireEvent.click(screen.getByTestId('save-button'));

    expect(onSave).toHaveBeenCalledWith('');
  });

  it('blocks saving while the schedule is invalid', () => {
    const { onSave } = renderEdit({});

    act(() => {
      fireEvent.click(screen.getByText('Make invalid'));
    });

    expect(screen.getByTestId('save-button')).toBeDisabled();

    fireEvent.click(screen.getByTestId('save-button'));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('leaves without saving on cancel', () => {
    const { onSave, onCancel } = renderEdit({});

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('locks Cancel while a save is in flight', () => {
    renderEdit({ isSaving: true });

    expect(screen.getByTestId('cancel-button')).toBeDisabled();
  });
});

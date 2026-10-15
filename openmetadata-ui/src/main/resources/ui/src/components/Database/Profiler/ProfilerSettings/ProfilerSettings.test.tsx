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
import userEvent from '@testing-library/user-event';
import { EntityType } from '../../../../enums/entity.enum';
import {
  DatabaseProfilerConfig,
  ProfileSampleType,
  SampleConfigType,
} from '../../../../generated/entity/data/database';
import {
  getDatabaseSchemaProfilerConfig,
  putDatabaseSchemaProfileConfig,
} from '../../../../rest/databaseAPI';
import ProfilerSettings from './ProfilerSettings';

jest.mock('../../../../rest/databaseAPI', () => ({
  getDatabaseProfilerConfig: jest.fn(),
  getDatabaseSchemaProfilerConfig: jest.fn(),
  putDatabaseProfileConfig: jest.fn(),
  putDatabaseSchemaProfileConfig: jest.fn((_, config) =>
    Promise.resolve(config)
  ),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const buildConfig = (
  profileSample: number,
  profileSampleType = ProfileSampleType.Percentage
): DatabaseProfilerConfig => ({
  profileSampleConfig: {
    sampleConfigType: SampleConfigType.Static,
    config: { profileSample, profileSampleType },
  },
});

const renderWithConfig = async (config: DatabaseProfilerConfig) => {
  (getDatabaseSchemaProfilerConfig as jest.Mock).mockResolvedValueOnce(config);

  await act(async () => {
    render(
      <ProfilerSettings
        visible
        entityId="schema-id"
        entityType={EntityType.DATABASE_SCHEMA}
        onVisibilityChange={jest.fn()}
      />
    );
  });
};

const submit = async () => {
  await act(async () => {
    fireEvent.submit(
      document.getElementById('profiler-setting-form') as HTMLFormElement
    );
  });
};

describe('ProfilerSettings profile sample minimum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not allow a percentage below 1 on the slider or input', async () => {
    await renderWithConfig(buildConfig(60));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(screen.getByTestId('slider-input'));
    await user.keyboard('{Home}{ArrowDown}');

    expect(screen.getByTestId('slider-input')).toHaveValue('1%');
    expect(screen.getByRole('slider')).toHaveAttribute('min', '1');
  });

  // A 0 sample makes ingestion profile the full table, and configs saved
  // before the minimum existed may still hold 0.
  it.each([ProfileSampleType.Percentage, ProfileSampleType.Rows])(
    'should block saving a stored %s sample of 0 with a validation error',
    async (profileSampleType) => {
      await renderWithConfig(buildConfig(0, profileSampleType));

      await submit();

      expect(putDatabaseSchemaProfileConfig).not.toHaveBeenCalled();
      expect(
        screen.getByText('message.value-must-be-greater-than')
      ).toBeInTheDocument();
    }
  );

  it('should save a sample of 1', async () => {
    await renderWithConfig(buildConfig(1));

    await submit();

    expect(putDatabaseSchemaProfileConfig).toHaveBeenCalledWith(
      'schema-id',
      expect.objectContaining({
        profileSampleConfig: buildConfig(1).profileSampleConfig,
      })
    );
  });
});

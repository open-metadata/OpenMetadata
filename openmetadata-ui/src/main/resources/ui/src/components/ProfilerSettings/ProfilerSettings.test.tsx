/*
 *  Copyright 2023 Collate.
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
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../enums/entity.enum';
import { MOCK_SCHEMA } from './MockSchema';
import ProfilerSettings, { ProfilerSettingsProps } from './ProfilerSettings';

const mockProfilerConfig = {
  profileSample: 120,
  profileSampleType: 'ROWS',
  sampleDataCount: 5000,
  sampleDataStorageConfig: {
    bucketName: 'sggsg',
    prefix: 'hshshhs',
    overwriteData: false,
  },
};

jest.mock('../../rest/databaseAPI', () => ({
  getDatabaseProfilerConfig: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockProfilerConfig)),
  getDatabaseSchemaProfilerConfig: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockProfilerConfig)),
  putDatabaseProfileConfig: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockProfilerConfig)),
  putDatabaseSchemaProfileConfig: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockProfilerConfig)),
}));

jest.mock('../../jsons/profilerSettings.json', () => ({
  __esModule: true,
  default: MOCK_SCHEMA,
}));

const mockProps = {
  entityId: '1ec3eec7-27b3-4169-952f-3822ddfc3a3a',
  entityType: EntityType.DATABASE,
} as ProfilerSettingsProps;

describe('Test profiler setting form', () => {
  it('Should render the form with values', async () => {
    render(<ProfilerSettings {...mockProps} />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const form = document.getElementById('profiler-setting-form');
    const updateBtn = screen.getByTestId('update-btn');

    const profileSampleType = document.getElementById('root/profileSampleType');
    const profileSample = document.getElementById('root/profileSample');
    const sampleDataCount = document.getElementById('root/sampleDataCount');
    const bucketName = document.getElementById(
      'root/sampleDataStorageConfig/bucketName'
    );
    const prefix = document.getElementById(
      'root/sampleDataStorageConfig/prefix'
    );
    const overwriteData = document.getElementById(
      'root/sampleDataStorageConfig/overwriteData'
    );

    expect(form).toBeInTheDocument();
    expect(updateBtn).toBeInTheDocument();

    // this correspond to "ROWS"
    expect(profileSampleType).toHaveValue('1');
    expect(profileSample).toHaveValue(120);
    expect(sampleDataCount).toHaveValue(5000);
    expect(bucketName).toHaveValue('sggsg');
    expect(prefix).toHaveValue('hshshhs');

    expect(overwriteData).toHaveAttribute('aria-checked', 'false');
  });
});

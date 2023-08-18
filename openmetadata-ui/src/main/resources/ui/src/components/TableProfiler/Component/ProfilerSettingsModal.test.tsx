/*
 *  Copyright 2022 Collate.
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
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import { ProfilerSettingsModalProps } from '../TableProfiler.interface';
import ProfilerSettingsModal from './ProfilerSettingsModal';

jest.mock('rest/tableAPI', () => ({
  getTableProfilerConfig: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
  putTableProfileConfig: jest.fn(),
}));

const mockProps: ProfilerSettingsModalProps = {
  tableId: MOCK_TABLE.id,
  columns: MOCK_TABLE.columns || [],
  visible: true,
  onVisibilityChange: jest.fn(),
};

describe('Test ProfilerSettingsModal component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render without crashing', async () => {
    render(<ProfilerSettingsModal {...mockProps} />);

    const modal = await screen.findByTestId('profiler-settings-modal');
    const sampleContainer = await screen.findByTestId(
      'profile-sample-container'
    );
    const sqlEditor = await screen.findByTestId('sql-editor-container');
    const includeSelect = await screen.findByTestId('include-column-container');
    const excludeSelect = await screen.findByTestId('exclude-column-container');
    const partitionSwitch = await screen.findByTestId(
      'enable-partition-switch'
    );
    const intervalType = await screen.findByTestId('interval-type');
    const columnName = await screen.findByTestId('column-name');

    expect(modal).toBeInTheDocument();
    expect(sampleContainer).toBeInTheDocument();
    expect(sqlEditor).toBeInTheDocument();
    expect(includeSelect).toBeInTheDocument();
    expect(excludeSelect).toBeInTheDocument();
    expect(partitionSwitch).toBeInTheDocument();
    expect(intervalType).toBeInTheDocument();
    expect(columnName).toBeInTheDocument();
  });

  it('Interval Type and Column Name field should be disabled, when partition switch is off', async () => {
    render(<ProfilerSettingsModal {...mockProps} />);
    const partitionSwitch = await screen.findByTestId(
      'enable-partition-switch'
    );
    const intervalType = await screen.findByTestId('interval-type');
    const columnName = await screen.findByTestId('column-name');

    expect(partitionSwitch).toHaveAttribute('aria-checked', 'false');
    expect(intervalType).toHaveClass('ant-select-disabled');
    expect(columnName).toHaveClass('ant-select-disabled');
  });

  it('Interval Type and Column Name field should be enabled, when partition switch is on', async () => {
    render(<ProfilerSettingsModal {...mockProps} />);
    const partitionSwitch = await screen.findByTestId(
      'enable-partition-switch'
    );
    const intervalType = await screen.findByTestId('interval-type');
    const columnName = await screen.findByTestId('column-name');

    expect(partitionSwitch).toHaveAttribute('aria-checked', 'false');

    await act(async () => {
      fireEvent.click(partitionSwitch);
    });

    expect(partitionSwitch).toHaveAttribute('aria-checked', 'true');
    expect(intervalType).not.toHaveClass('ant-select-disabled');
    expect(columnName).not.toHaveClass('ant-select-disabled');
  });
});

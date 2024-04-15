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
  findByText,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { MOCK_TABLE } from '../../../../../mocks/TableData.mock';
import { getTableProfilerConfig } from '../../../../../rest/tableAPI';
import { ProfilerSettingsModalProps } from '../TableProfiler.interface';
import ProfilerSettingsModal from './ProfilerSettingsModal';

jest.mock('../../../../../rest/tableAPI', () => ({
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

jest.mock('../../../../../constants/profiler.constant', () => ({
  DEFAULT_INCLUDE_PROFILE: [],
  INTERVAL_TYPE_OPTIONS: [],
  INTERVAL_UNIT_OPTIONS: [],
  PROFILER_METRIC: [],
  PROFILER_MODAL_LABEL_STYLE: {},
  PROFILE_SAMPLE_OPTIONS: [],
  SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL: {},
  TIME_BASED_PARTITION: [],
}));

jest.mock('../../../../../utils/CommonUtils', () => ({
  reducerWithoutAction: jest.fn(),
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockReturnValue(<div data-testid="schema-editor" />);
});

jest.mock('../../../../common/SliderWithInput/SliderWithInput', () => {
  return jest.fn().mockReturnValue(<div data-testid="slider-input" />);
});

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
    const sampleDataCount = await screen.findByTestId(
      'sample-data-count-input'
    );

    expect(modal).toBeInTheDocument();
    expect(sampleContainer).toBeInTheDocument();
    expect(sqlEditor).toBeInTheDocument();
    expect(includeSelect).toBeInTheDocument();
    expect(excludeSelect).toBeInTheDocument();
    expect(partitionSwitch).toBeInTheDocument();
    expect(intervalType).toBeInTheDocument();
    expect(columnName).toBeInTheDocument();
    expect(sampleDataCount).toBeInTheDocument();
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

  it.skip('Interval Type and Column Name field should be enabled, when partition switch is on', async () => {
    render(<ProfilerSettingsModal {...mockProps} />);
    const partitionSwitch = await screen.findByTestId(
      'enable-partition-switch'
    );

    expect(partitionSwitch).toHaveAttribute('aria-checked', 'false');

    await act(async () => {
      fireEvent.click(partitionSwitch);
    });

    expect(await screen.findByTestId('interval-type')).not.toHaveClass(
      'ant-select-disabled'
    );
    expect(await screen.findByTestId('column-name')).not.toHaveClass(
      'ant-select-disabled'
    );
  });

  it.skip('initial values should be visible in the form', async () => {
    const tableProfilerConfig = {
      profileSample: 60.0,
      profileSampleType: 'PERCENTAGE',
      sampleDataCount: 500,
      profileQuery: 'select * from table',
      excludeColumns: ['address_id'],
      includeColumns: [
        {
          columnName: 'first_name',
        },
      ],
      partitioning: {
        enablePartitioning: true,
        partitionColumnName: 'last_name',
        partitionIntervalType: 'COLUMN-VALUE',
        partitionValues: ['test'],
      },
    };
    (getTableProfilerConfig as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ ...MOCK_TABLE, tableProfilerConfig })
    );
    render(<ProfilerSettingsModal {...mockProps} />);

    const excludeSelect = await screen.findByTestId('exclude-column-select');
    const includeSelect = await screen.findByTestId('include-column-select');
    const partitionSwitch = await screen.findByTestId(
      'enable-partition-switch'
    );
    const intervalType = await screen.findByTestId('interval-type');
    const columnName = await screen.findByTestId('column-name');

    expect(await screen.findByTestId('sample-data-count-input')).toHaveValue(
      tableProfilerConfig.sampleDataCount.toString()
    );
    expect(await screen.findByTestId('slider-input')).toHaveValue(
      `${tableProfilerConfig.profileSample}%`
    );
    expect(await screen.findByTestId('partition-value')).toHaveValue(
      tableProfilerConfig.partitioning.partitionValues[0]
    );
    expect(
      await findByText(excludeSelect, tableProfilerConfig.excludeColumns[0])
    ).toBeInTheDocument();
    expect(
      await findByText(
        includeSelect,
        tableProfilerConfig.includeColumns[0].columnName
      )
    ).toBeInTheDocument();
    expect(
      await findByText(
        intervalType,
        tableProfilerConfig.partitioning.partitionIntervalType
      )
    ).toBeInTheDocument();
    expect(
      await findByText(
        columnName,
        tableProfilerConfig.partitioning.partitionColumnName
      )
    ).toBeInTheDocument();
    expect(partitionSwitch).toHaveAttribute('aria-checked', 'true');
  });
});

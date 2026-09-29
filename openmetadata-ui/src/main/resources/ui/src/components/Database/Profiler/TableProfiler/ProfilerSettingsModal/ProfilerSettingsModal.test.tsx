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
  waitFor,
} from '@testing-library/react';
import { Column } from '../../../../../generated/entity/data/dashboardDataModel';
import {
  DataType,
  PartitionIntervalTypes,
  PartitionIntervalUnit,
  TableProfilerConfig,
} from '../../../../../generated/entity/data/table';
import { MOCK_TABLE } from '../../../../../mocks/TableData.mock';
import {
  getTableProfilerConfig,
  putTableProfileConfig,
} from '../../../../../rest/tableAPI';
import { ProfilerSettingsModalProps } from '../TableProfiler.interface';
import ProfilerSettingsModal from './ProfilerSettingsModal';

const mockShowSuccessToast = jest.fn();
const mockShowErrorToast = jest.fn();
const mockOnVisibilityChange = jest.fn();

jest.mock('../../../../../rest/tableAPI', () => ({
  getTableProfilerConfig: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
  putTableProfileConfig: jest.fn().mockResolvedValue({}),
}));

const mockProps: ProfilerSettingsModalProps = {
  tableId: MOCK_TABLE.id,
  columns: [
    { name: 'column1', dataType: DataType.String },
    { name: 'column2', dataType: DataType.Timestamp },
    { name: 'column3', dataType: DataType.Int },
  ] as unknown as Column[],
  visible: true,
  onVisibilityChange: mockOnVisibilityChange,
};

const mockTableProfilerConfig = {
  profileSample: 60.0,
  profileSampleType: 'PERCENTAGE',
  sampleDataCount: 500,
  profileQuery: 'select * from table',
  excludeColumns: ['column1'],
  includeColumns: [{ columnName: 'column2', metrics: ['column_count'] }],
  partitioning: {
    enablePartitioning: true,
    partitionColumnName: 'column1',
    partitionIntervalType: PartitionIntervalTypes.ColumnValue,
    partitionValues: ['test'],
  },
};

jest.mock('../../../../../utils/ProfilerMetricsClassBase', () => ({
  __esModule: true,
  default: {
    getProfilerMetricOptions: jest
      .fn()
      .mockReturnValue(['column_count', 'distinct_count']),
  },
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest
    .fn()
    .mockImplementation((error) => mockShowErrorToast(error)),
  showSuccessToast: jest
    .fn()
    .mockImplementation((msg) => mockShowSuccessToast(msg)),
}));

jest.mock('../../../SchemaEditor/SchemaEditor', () => {
  return jest
    .fn()
    .mockImplementation(({ onChange }: { onChange: (v: string) => void }) => (
      <button
        data-testid="schema-editor"
        onClick={() => onChange('select 1 from table')}>
        sql editor
      </button>
    ));
});

jest.mock('../../../../common/SliderWithInput/SliderWithInput', () => {
  return jest.fn().mockReturnValue(<div data-testid="slider-input" />);
});

/**
 * Renders the modal with `config` already persisted, waits for it to load, and
 * returns the payload `putTableProfileConfig` was called with after a Save.
 */
const renderAndSave = async (
  config: TableProfilerConfig,
  beforeSave?: () => Promise<void> | void
): Promise<TableProfilerConfig> => {
  (getTableProfilerConfig as jest.Mock).mockResolvedValueOnce({
    ...MOCK_TABLE,
    tableProfilerConfig: config,
  });

  await act(async () => {
    render(<ProfilerSettingsModal {...mockProps} />);
  });

  await waitFor(() => {
    expect(screen.getByTestId('interval-type')).toBeInTheDocument();
  });

  if (beforeSave) {
    await act(async () => {
      await beforeSave();
    });
  }

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
  });

  await waitFor(() => {
    expect(putTableProfileConfig).toHaveBeenCalled();
  });

  return (putTableProfileConfig as jest.Mock).mock.calls[0][1];
};

describe('Test ProfilerSettingsModal component', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', async () => {
    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('profiler-settings-modal')).toBeInTheDocument();
      expect(
        screen.getByTestId('profile-sample-container')
      ).toBeInTheDocument();
      expect(screen.getByTestId('sql-editor-container')).toBeInTheDocument();
      expect(
        screen.getByTestId('include-column-container')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('exclude-column-container')
      ).toBeInTheDocument();
      expect(screen.getByTestId('enable-partition-switch')).toBeInTheDocument();
      expect(screen.getByTestId('interval-type')).toBeInTheDocument();
      expect(screen.getByTestId('column-name')).toBeInTheDocument();
      expect(screen.getByTestId('sample-data-count-input')).toBeInTheDocument();
    });
  });

  it('should handle modal visibility', async () => {
    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('profiler-settings-modal')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(mockOnVisibilityChange).toHaveBeenCalledWith(false);
  });

  it('should load initial profiler config', async () => {
    (getTableProfilerConfig as jest.Mock).mockResolvedValueOnce({
      ...MOCK_TABLE,
      tableProfilerConfig: mockTableProfilerConfig,
    });

    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    await waitFor(() => {
      const sampleDataCount = screen.getByTestId('sample-data-count-input');

      expect(sampleDataCount).toHaveAttribute('value', '500');
    });
  });

  it('should handle sample data count change', async () => {
    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    const sampleDataCount = screen.getByTestId('sample-data-count-input');

    await act(async () => {
      fireEvent.change(sampleDataCount, { target: { value: '100' } });
    });

    await waitFor(() => {
      expect(sampleDataCount).toHaveAttribute('value', '100');
    });
  });
});

describe('ProfilerSettingsModal partitioning round-trip', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('should preserve a COLUMN-VALUE partitioning config when saved untouched', async () => {
    const payload = await renderAndSave(mockTableProfilerConfig);

    expect(payload.partitioning).toEqual({
      enablePartitioning: true,
      partitionColumnName: 'column1',
      partitionIntervalType: PartitionIntervalTypes.ColumnValue,
      partitionValues: ['test'],
    });
  });

  it('should preserve a TIME-UNIT partitioning config when saved untouched', async () => {
    const payload = await renderAndSave({
      ...mockTableProfilerConfig,
      partitioning: {
        enablePartitioning: true,
        partitionColumnName: 'column2',
        partitionIntervalType: PartitionIntervalTypes.TimeUnit,
        partitionInterval: 7,
        partitionIntervalUnit: PartitionIntervalUnit.Day,
      },
    });

    expect(payload.partitioning).toEqual({
      enablePartitioning: true,
      partitionColumnName: 'column2',
      partitionIntervalType: PartitionIntervalTypes.TimeUnit,
      partitionInterval: 7,
      partitionIntervalUnit: PartitionIntervalUnit.Day,
      partitionValues: undefined,
    });
  });

  it('should preserve an INTEGER-RANGE partitioning config when saved untouched', async () => {
    const payload = await renderAndSave({
      ...mockTableProfilerConfig,
      partitioning: {
        enablePartitioning: true,
        partitionColumnName: 'column3',
        partitionIntervalType: PartitionIntervalTypes.IntegerRange,
        partitionIntegerRangeStart: 1,
        partitionIntegerRangeEnd: 100,
      },
    });

    expect(payload.partitioning).toEqual({
      enablePartitioning: true,
      partitionColumnName: 'column3',
      partitionIntervalType: PartitionIntervalTypes.IntegerRange,
      partitionIntegerRangeStart: 1,
      partitionIntegerRangeEnd: 100,
      partitionValues: undefined,
    });
  });

  it('should preserve partitioning when only the SQL query is edited', async () => {
    // The SQL editor sits outside any `<Form>`, so editing it never reaches the
    // form's `onValuesChange` -- the path that masked the bug for fields that do.
    const payload = await renderAndSave(mockTableProfilerConfig, () => {
      fireEvent.click(screen.getByTestId('schema-editor'));
    });

    expect(payload.profileQuery).toBe('select 1 from table');
    expect(payload.partitioning).toEqual({
      enablePartitioning: true,
      partitionColumnName: 'column1',
      partitionIntervalType: PartitionIntervalTypes.ColumnValue,
      partitionValues: ['test'],
    });
  });

  it('should send the edited value when a partition field is changed', async () => {
    const payload = await renderAndSave(mockTableProfilerConfig, () => {
      fireEvent.change(screen.getByTestId('partition-value'), {
        target: { value: 'edited' },
      });
    });

    expect(payload.partitioning?.partitionValues).toEqual(['edited']);
  });

  // Documents current behaviour, not desired behaviour: a stored config with a
  // blank partition value cannot be saved at all until the field is cleared.
  it('currently blocks the save outright when a stored partition value is blank', async () => {
    (getTableProfilerConfig as jest.Mock).mockResolvedValueOnce({
      ...MOCK_TABLE,
      tableProfilerConfig: {
        ...mockTableProfilerConfig,
        partitioning: {
          enablePartitioning: true,
          partitionColumnName: 'column1',
          partitionIntervalType: PartitionIntervalTypes.ColumnValue,
          partitionValues: ['first', '', 'second'],
        },
      },
    });

    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('interval-type')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    // The blank value fails the `required` rule, so nothing is written at all
    // rather than a config with the blank entry silently dropped.
    expect(putTableProfileConfig).not.toHaveBeenCalled();
  });

  it('should send no partitioning when partitioning is disabled', async () => {
    const payload = await renderAndSave({
      ...mockTableProfilerConfig,
      partitioning: {
        ...mockTableProfilerConfig.partitioning,
        enablePartitioning: false,
      },
    });

    expect(payload.partitioning).toBeUndefined();
  });
});

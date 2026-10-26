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
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Column } from '../../../../../generated/entity/data/dashboardDataModel';
import {
  DataType,
  PartitionIntervalTypes,
  PartitionIntervalUnit,
  ProfileSampleType,
  SampleConfigType,
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

const buildStaticSampleConfig = (
  profileSample: number,
  profileSampleType = ProfileSampleType.Percentage
): TableProfilerConfig => ({
  sampleDataCount: 500,
  profileSampleConfig: {
    sampleConfigType: SampleConfigType.Static,
    config: {
      profileSample,
      profileSampleType,
    },
  },
});

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

  it('keeps one clear control, so clearing the sample value leaves the sample type and columns', async () => {
    const payload = await renderAndSave(
      {
        ...buildStaticSampleConfig(60),
        excludeColumns: mockTableProfilerConfig.excludeColumns,
      },
      () => {
        expect(
          screen.getAllByRole('button', { name: /label.clear/ })
        ).toHaveLength(1);

        fireEvent.click(screen.getByTestId('clear-slider-input'));

        expect(screen.getByTestId('percentage-input')).toBeInTheDocument();
      }
    );

    expect(payload.excludeColumns).toEqual(
      mockTableProfilerConfig.excludeColumns
    );
  });
});

describe('ProfilerSettingsModal profile-sample round-trip', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('should preserve profileSampleConfig for a non-zero percentage (control)', async () => {
    const payload = await renderAndSave(buildStaticSampleConfig(60));

    expect(payload.profileSampleConfig).toEqual({
      sampleConfigType: SampleConfigType.Static,
      config: {
        profileSample: 60,
        profileSampleType: ProfileSampleType.Percentage,
      },
    });
  });

  it('should not allow a 0 percentage because ingestion would scan the full table', async () => {
    (getTableProfilerConfig as jest.Mock).mockResolvedValueOnce({
      ...MOCK_TABLE,
      tableProfilerConfig: buildStaticSampleConfig(60),
    });

    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const input = await screen.findByTestId('slider-input');
    await user.click(input);
    await user.keyboard('{Home}{ArrowDown}');

    expect(input).toHaveValue('1%');
    expect(screen.getByRole('slider')).toHaveAttribute('min', '1');
  });

  it('should clamp a typed 0 percentage up to 1 on blur', async () => {
    const payload = await renderAndSave(buildStaticSampleConfig(60), () => {
      const input = screen.getByTestId('slider-input');
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.blur(input);
    });

    expect(payload.profileSampleConfig?.config?.profileSample).toBe(1);
  });

  it('should not allow 0 rows', async () => {
    (getTableProfilerConfig as jest.Mock).mockResolvedValueOnce({
      ...MOCK_TABLE,
      tableProfilerConfig: buildStaticSampleConfig(500, ProfileSampleType.Rows),
    });

    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const input = await screen.findByTestId('metric-number-input');
    await user.click(input);
    await user.keyboard('{Home}{ArrowDown}');

    expect(input).toHaveValue('1');
  });

  // Configs saved before the minimum existed may hold 0; saving the modal
  // untouched must write back what is stored rather than a clamped value.
  it.each([
    [ProfileSampleType.Percentage, 0],
    [ProfileSampleType.Rows, 500],
    [ProfileSampleType.Rows, 0],
  ])(
    'should round-trip a stored %s sample of %d through reload and save',
    async (profileSampleType, profileSample) => {
      const payload = await renderAndSave(
        buildStaticSampleConfig(profileSample, profileSampleType)
      );

      expect(payload.profileSampleConfig).toEqual({
        sampleConfigType: SampleConfigType.Static,
        config: { profileSample, profileSampleType },
      });
    }
  );

  it('should omit profileSampleConfig when the sample value is cleared', async () => {
    const payload = await renderAndSave(buildStaticSampleConfig(60), () => {
      fireEvent.click(screen.getByTestId('clear-slider-input'));
    });

    expect(payload.profileSampleConfig).toBeUndefined();
  });
});

describe('ProfilerSettingsModal include-column dropdowns', () => {
  // Two include rows turn the include-column container into a 160px scroll
  // box (tw:max-h-40 tw:overflow-y-auto). A dropdown rendered inside it would
  // be clipped, so the row pickers must open outside it (#35369).
  it('opens the include-column list outside the scroll clip box', async () => {
    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    await waitFor(() =>
      expect(screen.getByTestId('include-column-select')).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.add-entity' }));
    });

    const container = screen.getByTestId('include-column-container');

    await waitFor(() => {
      expect(container).toHaveClass('tw:max-h-40', 'tw:overflow-y-auto');
      expect(screen.getAllByTestId('include-column-select')).toHaveLength(2);
    });

    const [firstRow] = screen.getAllByTestId('include-column-select');
    const [trigger] = within(firstRow).getAllByRole('button');

    await act(async () => {
      fireEvent.click(trigger);
    });

    const listbox = await screen.findByRole('listbox');

    expect(container).not.toContainElement(listbox);
  });
});

describe('ProfilerSettingsModal with an interval type the form does not offer', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it.each([
    PartitionIntervalTypes.Enum,
    PartitionIntervalTypes.Injected,
    PartitionIntervalTypes.Other,
  ])(
    'should render and save a stored %s partitioning untouched',
    async (partitionIntervalType) => {
      const partitioning = {
        enablePartitioning: true,
        partitionColumnName: 'column1',
        partitionIntervalType,
      };

      const payload = await renderAndSave({
        ...mockTableProfilerConfig,
        partitioning,
      } as TableProfilerConfig);

      expect(screen.getByTestId('profiler-settings-modal')).toBeInTheDocument();
      expect(payload.partitioning).toEqual(
        expect.objectContaining(partitioning)
      );
    }
  );
});

describe('ProfilerSettingsModal when the stored config fetch fails', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('blocks the save, hides the defaults-filled form, and offers a retry', async () => {
    (getTableProfilerConfig as jest.Mock).mockRejectedValueOnce(
      new Error('Network Error')
    );

    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    // The error placeholder replaces the defaults-filled form ...
    const loadError = await screen.findByTestId('profiler-settings-load-error');

    expect(loadError).toBeInTheDocument();
    expect(loadError).toHaveTextContent(
      'server.fetch-table-profiler-config-error'
    );

    // ... so the misleading, defaults-filled form is not rendered for the
    // user to edit and save.
    expect(screen.queryByTestId('interval-type')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('sample-data-count-input')
    ).not.toBeInTheDocument();

    // The save action is gated and a retry is offered.
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // The user is told why, and nothing is written to the backend -- the
    // destructive defaults-only overwrite the bug would have produced does
    // not happen.
    expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
    expect(putTableProfileConfig).not.toHaveBeenCalled();
  });

  it('does not write a defaults-only config even when save is attempted', async () => {
    // Defence-in-depth for the disabled button: ensure no PUT is ever issued
    // after a failed load, regardless of how the save is triggered.
    (getTableProfilerConfig as jest.Mock).mockRejectedValueOnce(
      new Error('Network Error')
    );

    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    await screen.findByTestId('profiler-settings-load-error');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    expect(putTableProfileConfig).not.toHaveBeenCalled();
  });

  it('reloads the stored config and re-enables save after a successful retry', async () => {
    (getTableProfilerConfig as jest.Mock)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({
        ...MOCK_TABLE,
        tableProfilerConfig: mockTableProfilerConfig,
      });

    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    await screen.findByTestId('profiler-settings-load-error');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    });

    // The real config loads, not the defaults (sampleDataCount 500 vs 50).
    await waitFor(() => {
      expect(screen.getByTestId('interval-type')).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('profiler-settings-load-error')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('sample-data-count-input')).toHaveAttribute(
      'value',
      '500'
    );
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    await waitFor(() => {
      expect(putTableProfileConfig).toHaveBeenCalled();
    });

    // The stored config round-trips, not the defaults -- the destructive
    // overwrite the bug would have produced does not happen.
    const payload = (putTableProfileConfig as jest.Mock).mock.calls[0][1];

    expect(payload.profileQuery).toBe(mockTableProfilerConfig.profileQuery);
    expect(payload.excludeColumns).toEqual(
      mockTableProfilerConfig.excludeColumns
    );
    expect(payload.partitioning).toEqual(
      expect.objectContaining(mockTableProfilerConfig.partitioning)
    );
  });

  it('keeps the save button enabled when the config loads successfully', async () => {
    (getTableProfilerConfig as jest.Mock).mockResolvedValueOnce({
      ...MOCK_TABLE,
      tableProfilerConfig: mockTableProfilerConfig,
    });

    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('interval-type')).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('profiler-settings-load-error')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });
});

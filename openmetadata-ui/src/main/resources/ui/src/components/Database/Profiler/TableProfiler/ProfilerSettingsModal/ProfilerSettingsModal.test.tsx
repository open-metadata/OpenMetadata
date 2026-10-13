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

    expect(await screen.findByTestId('slider-input')).toHaveAttribute(
      'aria-valuemin',
      '1'
    );
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemin', '1');
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

    expect(await screen.findByTestId('metric-number-input')).toHaveAttribute(
      'aria-valuemin',
      '1'
    );
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

describe('ProfilerSettingsModal include-column dropdown popup container', () => {
  // The include-column `Select` and metrics `TreeSelect` render inside a
  // `h-max-40 overflow-y-auto` wrapper that becomes a 160px clip box once a
  // second include row exists. Once the clip box is active, mounting their
  // popups via `triggerNode.parentElement` (the helper used for every other
  // dropdown) traps them inside that scroll wrapper, so the options get cut
  // off at 160px and scroll with the tiny box. The popups must instead mount
  // OUTSIDE the clip wrapper but still INSIDE the dialog, to preserve the
  // react-aria focus/accessibility boundary. jsdom performs no layout, so the
  // visual clipping cannot be asserted directly; DOM ancestry of the open
  // popup is what produces the clip in a real browser — a popup whose nearest
  // `[data-testid="include-column-container"]` ancestor is null can never be
  // clipped by the 160px wrapper.

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    // antd appends a scroll-lock placeholder and react-aria leaves focus-scope
    // markers directly under <body> when a dropdown is open at unmount; these
    // are not part of any React root so cleanup() cannot remove them, and they
    // cross-contaminate later renders (the form never mounts). Reset <body>.
    document.body.removeAttribute('style');
    document.body.removeAttribute('class');
    document
      .querySelectorAll(
        'body > [aria-hidden="true"], body > [data-focus-scope-start]'
      )
      .forEach((el) => el.remove());
  });

  const renderModalWithTwoIncludeRows = async () => {
    await act(async () => {
      render(<ProfilerSettingsModal {...mockProps} />);
    });

    // Wait for the form to finish loading: `include-column-select` only
    // renders once `isDataLoading` flips to false after the config fetch
    // resolves. `profiler-settings-modal` (the dialog chrome) is present
    // during load too, so it cannot gate this.
    await waitFor(() => {
      expect(screen.getByTestId('include-column-select')).toBeInTheDocument();
    });

    // DEFAULT_INCLUDE_PROFILE holds a single include row, so the clip box is
    // inactive on first paint. Click the include-columns "+" button to add a
    // second row: `handleIncludeColumnsProfiler` mirrors it into state, so
    // `state.includeCol.length > 1` switches on the `h-max-40 overflow-y-auto`
    // clip wrapper.
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId('include-column-section')).getByRole(
          'button',
          { name: 'label.add' }
        )
      );
    });

    await waitFor(() => {
      const container = screen.getByTestId('include-column-container');

      expect(container.className).toMatch(/h-max-40/);
      expect(screen.getAllByTestId('include-column-select')).toHaveLength(2);
      expect(container.querySelectorAll('.ant-tree-select')).toHaveLength(2);
    });
  };

  const openDropdown = (testid: string, rowIndex = 0) => {
    const trigger = screen.getAllByTestId(testid)[rowIndex];
    const combobox = within(trigger).getByRole('combobox');

    fireEvent.mouseDown(combobox);
  };

  // Each include row holds two comboboxes: the column Select, then the metrics
  // TreeSelect.
  const openMetricsDropdown = (rowIndex = 0) => {
    const comboboxes = within(
      screen.getByTestId('include-column-container')
    ).getAllByRole('combobox');

    fireEvent.mouseDown(comboboxes[rowIndex * 2 + 1]);
  };

  // Dispatch an outside `mousedown` so rc-trigger closes any open antd
  // dropdown. This lets antd's scroll-lock effect cleanup restore <body>
  // before the next test renders, which a bare cleanup() does not flush.
  const closeOpenDropdowns = async () => {
    await act(async () => {
      fireEvent.mouseDown(document.body);
    });
  };

  // Wait for the dropdown matching `selector` to appear, assertion-check its
  // ancestry, and always close it so an open dropdown never leaks into the
  // next test. `waitFor` only gates on the dropdown *existing*; the ancestry
  // assertions run once and fail fast (so a regression does not hold the
  // dropdown open for the full `waitFor` timeout).
  const assertDropdownInsideDialogOutsideClipBox = async (selector: string) => {
    const dropdown = (await waitFor(() => {
      const el = document.querySelector(
        `${selector}:not(.ant-select-dropdown-hidden)`
      ) as HTMLElement | null;

      expect(el).toBeInTheDocument();

      return el;
    })) as HTMLElement;

    try {
      // Stays inside the dialog (focus/accessibility boundary preserved).
      expect(dropdown.closest('[data-testid="profiler-settings-modal"]')).toBe(
        screen.getByTestId('profiler-settings-modal')
      );
      // Is NOT nested inside the 160px include-column scroll clip box.
      expect(
        dropdown.closest('[data-testid="include-column-container"]')
      ).toBeNull();
    } finally {
      await closeOpenDropdowns();
    }
  };

  it('mounts the include-column Select dropdown outside the scroll clip box but inside the dialog', async () => {
    await renderModalWithTwoIncludeRows();

    await act(async () => {
      openDropdown('include-column-select');
    });

    // The include-column Select popup must NOT be nested inside the 160px
    // scroll clip box.
    await assertDropdownInsideDialogOutsideClipBox('.ant-select-dropdown');
  });

  it('mounts the metrics TreeSelect dropdown outside the scroll clip box but inside the dialog', async () => {
    await renderModalWithTwoIncludeRows();

    await act(async () => {
      openMetricsDropdown();
    });

    // The metrics TreeSelect popup must NOT be nested inside the 160px
    // scroll clip box.
    await assertDropdownInsideDialogOutsideClipBox('.ant-tree-select-dropdown');
  });

  it('keeps the non-row dropdowns mounted inside the dialog (unchanged behavior)', async () => {
    // Only the two pickers nested in the clip wrapper were moved to the dialog
    // root. The other dropdowns keep using `triggerNode.parentElement`, which
    // is correct because their trigger's parent is never the scroll clip box.
    // This guards against a sloppy fix that ports *every* dropdown to
    // document.body and re-opens the original focus-boundary regression.
    await renderModalWithTwoIncludeRows();

    await act(async () => {
      openDropdown('profile-sample');
    });

    // The profile-sample Select lives outside the include-column wrapper, so
    // its popup is never in the clip box; it must still mount inside the dialog.
    await assertDropdownInsideDialogOutsideClipBox('.ant-select-dropdown');
  });
});

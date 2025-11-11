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
import { MOCK_TABLE } from '../../../../../mocks/TableData.mock';
import { getTableProfilerConfig } from '../../../../../rest/tableAPI';
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
    { name: 'column1', dataType: 'string' },
    { name: 'column2', dataType: 'timestamp' },
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
    partitionColumnName: 'column2',
    partitionIntervalType: 'COLUMN-VALUE',
    partitionValues: ['test'],
  },
};

jest.mock('../../../../../constants/profiler.constant', () => ({
  DEFAULT_INCLUDE_PROFILE: [],
  INTERVAL_TYPE_OPTIONS: [
    { label: 'Column Value', value: 'COLUMN-VALUE' },
    { label: 'Time Unit', value: 'TIME-UNIT' },
  ],
  INTERVAL_UNIT_OPTIONS: [
    { label: 'Day', value: 'DAY' },
    { label: 'Hour', value: 'HOUR' },
  ],
  PROFILER_METRIC: ['column_count', 'distinct_count'],
  PROFILER_MODAL_LABEL_STYLE: {},
  PROFILE_SAMPLE_OPTIONS: [
    { label: 'Percentage', value: 'PERCENTAGE' },
    { label: 'Row Count', value: 'ROW_COUNT' },
  ],
  SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL: {
    'COLUMN-VALUE': ['string'],
    'TIME-UNIT': ['timestamp'],
  },
  TIME_BASED_PARTITION: ['TIME-UNIT'],
}));

jest.mock('../../../../../utils/CommonUtils', () => ({
  reducerWithoutAction: jest.fn(),
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
  return jest.fn().mockReturnValue(<div data-testid="schema-editor" />);
});

jest.mock('../../../../common/SliderWithInput/SliderWithInput', () => {
  return jest.fn().mockReturnValue(<div data-testid="slider-input" />);
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

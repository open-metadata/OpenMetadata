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

import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { HeatmapCellData } from './DimensionalityHeatmap.interface';
import { HeatmapCellTooltip } from './HeatmapCellTooltip.component';

const mockThemeColors: ThemeColors = {
  white: '#FFFFFF',
  gray: {
    300: '#D1D5DB',
    700: '#374151',
    900: '#111827',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

jest.mock('./DimensionalityHeatmap.utils', () => ({
  getStatusLabel: jest.fn((status) => `Status: ${status}`),
}));

describe('HeatmapCellTooltip', () => {
  const mockCell: HeatmapCellData = {
    date: '2025-01-15',
    status: 'success',
    dimensionValue: 'Region: US',
    result: {
      passedRows: 100,
      failedRows: 5,
      testCaseStatus: 'Success' as never,
      dimensionValues: [],
      testResultValue: [
        { name: 'Row Count', value: '105' },
        { name: 'Null Count', value: '0' },
      ],
    },
  };

  it('should render cell date as header', () => {
    render(<HeatmapCellTooltip cell={mockCell} />, { wrapper: Wrapper });

    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
  });

  it('should render dimension value', () => {
    render(<HeatmapCellTooltip cell={mockCell} />, { wrapper: Wrapper });

    expect(screen.getByText('label.dimension-value')).toBeInTheDocument();
    expect(screen.getByText('Region: US')).toBeInTheDocument();
  });

  it('should render status with translated label', () => {
    render(<HeatmapCellTooltip cell={mockCell} />, { wrapper: Wrapper });

    expect(screen.getByText('label.status')).toBeInTheDocument();
    expect(screen.getByText('Status: success')).toBeInTheDocument();
  });

  it('should render passed rows when available', () => {
    render(<HeatmapCellTooltip cell={mockCell} />, { wrapper: Wrapper });

    expect(screen.getByText('label.passed-rows')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should render failed rows when available', () => {
    render(<HeatmapCellTooltip cell={mockCell} />, { wrapper: Wrapper });

    expect(screen.getByText('label.failed-rows')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render test result values when available', () => {
    render(<HeatmapCellTooltip cell={mockCell} />, { wrapper: Wrapper });

    expect(screen.getByText('Row Count')).toBeInTheDocument();
    expect(screen.getByText('105')).toBeInTheDocument();
    expect(screen.getByText('Null Count')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should not render passed rows when undefined', () => {
    const cellWithoutPassedRows: HeatmapCellData = {
      ...mockCell,
      result: mockCell.result
        ? {
            ...mockCell.result,
            passedRows: undefined,
          }
        : undefined,
    };

    render(<HeatmapCellTooltip cell={cellWithoutPassedRows} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByText('label.passed-rows')).not.toBeInTheDocument();
  });

  it('should not render failed rows when undefined', () => {
    const cellWithoutFailedRows: HeatmapCellData = {
      ...mockCell,
      result: mockCell.result
        ? {
            ...mockCell.result,
            failedRows: undefined,
          }
        : undefined,
    };

    render(<HeatmapCellTooltip cell={cellWithoutFailedRows} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByText('label.failed-rows')).not.toBeInTheDocument();
  });

  it('should not render test result values when empty', () => {
    const cellWithoutResults: HeatmapCellData = {
      ...mockCell,
      result: mockCell.result
        ? {
            ...mockCell.result,
            testResultValue: [],
          }
        : undefined,
    };

    render(<HeatmapCellTooltip cell={cellWithoutResults} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByText('Row Count')).not.toBeInTheDocument();
  });

  it('should handle cell without result data', () => {
    const cellWithoutResult: HeatmapCellData = {
      date: '2025-01-15',
      status: 'no-data',
      dimensionValue: 'Region: EU',
    };

    render(<HeatmapCellTooltip cell={cellWithoutResult} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('Region: EU')).toBeInTheDocument();
    expect(screen.queryByText('label.passed-rows')).not.toBeInTheDocument();
    expect(screen.queryByText('label.failed-rows')).not.toBeInTheDocument();
  });

  it('should use fallback label for test result value without name', () => {
    const cellWithUnnamedValue: HeatmapCellData = {
      ...mockCell,
      result: mockCell.result
        ? {
            ...mockCell.result,
            testResultValue: [{ value: '123' }],
          }
        : undefined,
    };

    render(<HeatmapCellTooltip cell={cellWithUnnamedValue} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('label.value')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('should display dash for test result value without value', () => {
    const cellWithEmptyValue: HeatmapCellData = {
      ...mockCell,
      result: mockCell.result
        ? {
            ...mockCell.result,
            testResultValue: [{ name: 'Empty Field' }],
          }
        : undefined,
    };

    render(<HeatmapCellTooltip cell={cellWithEmptyValue} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Empty Field')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});

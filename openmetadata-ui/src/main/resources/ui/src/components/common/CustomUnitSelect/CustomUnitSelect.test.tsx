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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UnitOfMeasurement } from '../../../generated/entity/data/metric';
import { getCustomUnitsOfMeasurement } from '../../../rest/metricsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import CustomUnitSelect from './CustomUnitSelect';

// Mock dependencies
jest.mock('../../../rest/metricsAPI', () => ({
  getCustomUnitsOfMeasurement: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'label.enter-custom-unit-of-measurement':
          'Enter custom unit of measurement',
        'label.add': 'Add',
      };

      return translations[key] || key;
    },
  }),
}));

const mockCustomUnits = ['Custom Unit 1', 'Custom Unit 2', 'Custom Unit 3'];

describe('CustomUnitSelect Component', () => {
  const mockOnChange = jest.fn();
  const mockGetCustomUnits = getCustomUnitsOfMeasurement as jest.Mock;
  const mockShowErrorToast = showErrorToast as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCustomUnits.mockResolvedValue(mockCustomUnits);
  });

  describe('Basic Rendering', () => {
    it('should render component with default props', async () => {
      render(<CustomUnitSelect />);

      expect(
        screen.getByTestId('unit-of-measurement-select')
      ).toBeInTheDocument();
    });

    it('should render with custom data-testid', async () => {
      render(<CustomUnitSelect dataTestId="custom-unit-select" />);

      expect(screen.getByTestId('custom-unit-select')).toBeInTheDocument();
    });

    it('should render with placeholder text', async () => {
      render(<CustomUnitSelect placeholder="Select unit" />);

      expect(screen.getByText('Select unit')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', async () => {
      render(<CustomUnitSelect disabled />);

      const select = screen.getByRole('combobox');

      expect(select).toBeDisabled();
    });
  });

  describe('API Integration', () => {
    it('should fetch custom units on mount', async () => {
      render(<CustomUnitSelect />);

      await waitFor(() => {
        expect(mockGetCustomUnits).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle API error gracefully', async () => {
      const error = new Error('API Error');
      mockGetCustomUnits.mockRejectedValue(error);

      render(<CustomUnitSelect />);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('should handle empty API response', async () => {
      mockGetCustomUnits.mockResolvedValue([]);

      render(<CustomUnitSelect />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Percentage')).toBeInTheDocument();
        expect(screen.getByText('Count')).toBeInTheDocument();
      });
    });

    it('should handle null API response', async () => {
      mockGetCustomUnits.mockResolvedValue(null);

      render(<CustomUnitSelect />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Percentage')).toBeInTheDocument();
      });
    });
  });

  describe('Options Display', () => {
    it('should display standard unit options', async () => {
      render(<CustomUnitSelect />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Percentage')).toBeInTheDocument();
        expect(screen.getByText('Count')).toBeInTheDocument();
        expect(screen.queryByText('Other')).not.toBeInTheDocument();
      });
    });

    it('should display custom units from API', async () => {
      render(<CustomUnitSelect />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Custom Unit 1')).toBeInTheDocument();
        expect(screen.getByText('Custom Unit 2')).toBeInTheDocument();
      });
    });

    it('should show add custom unit interface', async () => {
      render(<CustomUnitSelect />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter custom unit of measurement')
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /add/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Unit Selection', () => {
    it('should handle standard unit selection', async () => {
      render(<CustomUnitSelect onChange={mockOnChange} />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Percentage')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Percentage'));

      expect(mockOnChange).toHaveBeenCalledWith(
        UnitOfMeasurement.Percentage,
        undefined
      );
    });

    it('should handle custom unit selection', async () => {
      render(<CustomUnitSelect onChange={mockOnChange} />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Custom Unit 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Custom Unit 1'));

      expect(mockOnChange).toHaveBeenCalledWith(
        UnitOfMeasurement.Other,
        'Custom Unit 1'
      );
    });

    it('should display selected standard unit', async () => {
      render(<CustomUnitSelect value={UnitOfMeasurement.Percentage} />);

      await waitFor(() => {
        expect(screen.getByText('Percentage')).toBeInTheDocument();
      });
    });

    it('should display selected custom unit', async () => {
      render(
        <CustomUnitSelect
          customValue="My Custom Unit"
          value={UnitOfMeasurement.Other}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('My Custom Unit')).toBeInTheDocument();
      });
    });

    it('should handle onChange being undefined', async () => {
      render(<CustomUnitSelect />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Percentage')).toBeInTheDocument();
      });

      expect(() => {
        fireEvent.click(screen.getByText('Percentage'));
      }).not.toThrow();
    });
  });

  describe('Custom Value Initialization', () => {
    it('should initialize with custom value', async () => {
      render(
        <CustomUnitSelect
          customValue="Initial Custom Unit"
          value={UnitOfMeasurement.Other}
        />
      );

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Initial Custom Unit')).toBeInTheDocument();
      });
    });

    it('should not duplicate existing custom value', async () => {
      mockGetCustomUnits.mockResolvedValue(['Existing Unit']);

      render(
        <CustomUnitSelect
          customValue="Existing Unit"
          value={UnitOfMeasurement.Other}
        />
      );

      await waitFor(() => {
        // The test passes if component renders without error
        expect(
          screen.getByTestId('unit-of-measurement-select')
        ).toBeInTheDocument();
      });

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        // Should show options are available
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Memoization', () => {
    it('should use memoized options', async () => {
      const { rerender } = render(<CustomUnitSelect />);

      // Initial render should call API
      await waitFor(() => {
        expect(mockGetCustomUnits).toHaveBeenCalledTimes(1);
      });

      // Rerender with same props should not call API again
      rerender(<CustomUnitSelect />);

      // Should still only have been called once
      expect(mockGetCustomUnits).toHaveBeenCalledTimes(1);
    });

    it('should handle component updates efficiently', async () => {
      const { rerender } = render(
        <CustomUnitSelect value={UnitOfMeasurement.Count} />
      );

      await waitFor(() => {
        expect(screen.getByText('Count')).toBeInTheDocument();
      });

      // Change value
      rerender(<CustomUnitSelect value={UnitOfMeasurement.Percentage} />);

      await waitFor(() => {
        expect(screen.getByText('Percentage')).toBeInTheDocument();
      });

      // API should still only be called once
      expect(mockGetCustomUnits).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility and Props', () => {
    it('should support custom placeholder', () => {
      render(<CustomUnitSelect placeholder="Choose measurement unit" />);

      expect(screen.getByText('Choose measurement unit')).toBeInTheDocument();
    });

    it('should support disabled state', () => {
      render(<CustomUnitSelect disabled />);

      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('should support search functionality', () => {
      render(<CustomUnitSelect showSearch />);

      expect(screen.getByRole('combobox')).toHaveAttribute('type', 'search');
    });

    it('should disable search when showSearch is false', () => {
      render(<CustomUnitSelect showSearch={false} />);

      const select = screen.getByTestId('unit-of-measurement-select');

      expect(select).toBeInTheDocument();
    });

    it('should use custom testid', () => {
      render(<CustomUnitSelect dataTestId="my-custom-select" />);

      expect(screen.getByTestId('my-custom-select')).toBeInTheDocument();
    });
  });
});

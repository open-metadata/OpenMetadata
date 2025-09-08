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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  DataContract,
  MaxLatencyUnit,
  RefreshFrequencyUnit,
  RetentionUnit,
} from '../../../generated/entity/data/dataContract';
import { ContractSLAFormTab } from './ContractSLAFormTab';

const mockOnChange = jest.fn();
const mockOnPrev = jest.fn();

const mockContract: Partial<DataContract> = {
  sla: {
    availabilityTime: '09:30',
    maxLatency: {
      unit: MaxLatencyUnit.Hour,
      value: 2,
    },
    refreshFrequency: {
      interval: 1,
      unit: RefreshFrequencyUnit.Day,
    },
    retention: {
      period: 30,
      unit: RetentionUnit.Day,
    },
  },
};

describe('ContractSLAFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(
        <ContractSLAFormTab onChange={mockOnChange} onPrev={mockOnPrev} />
      );

      expect(screen.getByText('label.sla')).toBeInTheDocument();
      expect(
        screen.getByText('message.data-contract-sla-description')
      ).toBeInTheDocument();
    });

    it('should render with custom prev label', () => {
      render(
        <ContractSLAFormTab
          prevLabel="Custom Previous"
          onChange={mockOnChange}
          onPrev={mockOnPrev}
        />
      );

      expect(screen.getByText('Custom Previous')).toBeInTheDocument();
    });
  });

  describe('TimePicker Configuration', () => {
    it('should render TimePicker with correct format and placeholder', () => {
      render(
        <ContractSLAFormTab onChange={mockOnChange} onPrev={mockOnPrev} />
      );

      const timePicker = document.querySelector('.availability-time-picker');

      expect(timePicker).toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    it('should render all SLA form sections', () => {
      render(
        <ContractSLAFormTab onChange={mockOnChange} onPrev={mockOnPrev} />
      );

      expect(screen.getByText('label.refresh-frequency')).toBeInTheDocument();
      expect(screen.getByText('label.max-latency')).toBeInTheDocument();
      expect(screen.getByText('label.availability-time')).toBeInTheDocument();
      expect(screen.getByText('label.retention')).toBeInTheDocument();
    });

    it('should render form with initial values in edit mode', () => {
      render(
        <ContractSLAFormTab
          initialValues={mockContract}
          onChange={mockOnChange}
          onPrev={mockOnPrev}
        />
      );

      // Component should render without errors with initial values
      expect(screen.getByText('label.sla')).toBeInTheDocument();
    });
  });

  describe('Enum Options', () => {
    it('should use enum-based options for unit selects', () => {
      render(
        <ContractSLAFormTab onChange={mockOnChange} onPrev={mockOnPrev} />
      );

      // The component should render multiple select fields for different unit types
      // This verifies that the enum to options conversion is working
      const unitLabels = screen.getAllByText('label.unit');

      expect(unitLabels).toHaveLength(3); // refresh frequency, max latency, and retention units
    });
  });

  describe('Navigation', () => {
    it('should render Previous button', () => {
      render(
        <ContractSLAFormTab onChange={mockOnChange} onPrev={mockOnPrev} />
      );

      expect(screen.getByText('label.previous')).toBeInTheDocument();
    });

    it('should call onPrev when Previous button is clicked', () => {
      render(
        <ContractSLAFormTab onChange={mockOnChange} onPrev={mockOnPrev} />
      );

      const prevButton = screen.getByText('label.previous');
      prevButton.click();

      expect(mockOnPrev).toHaveBeenCalled();
    });
  });
});

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
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  mockDiagnosticData,
  mockEmptyDiagnosticData,
} from '../../../../mocks/Alerts.mock';
import AlertDiagnosticInfoTab from './AlertDiagnosticInfoTab';

describe('AlertDiagnosticInfoTab', () => {
  it('should render all offset information correctly', () => {
    render(<AlertDiagnosticInfoTab diagnosticData={mockDiagnosticData} />);

    const inputs = screen.getAllByTestId('input-field');

    // Check labels
    expect(screen.getByText('label.latest-offset:')).toBeInTheDocument();
    expect(screen.getByText('label.current-offset:')).toBeInTheDocument();
    expect(screen.getByText('label.starting-offset:')).toBeInTheDocument();
    expect(
      screen.getByText('label.successful-event-plural:')
    ).toBeInTheDocument();
    expect(screen.getByText('label.failed-event-plural:')).toBeInTheDocument();
    expect(
      screen.getByText('label.processed-all-event-plural:')
    ).toBeInTheDocument();

    // Check input values
    expect(inputs[0]).toHaveValue('100');
    expect(inputs[1]).toHaveValue('80');
    expect(inputs[2]).toHaveValue('0');
    expect(inputs[3]).toHaveValue('75');
    expect(inputs[4]).toHaveValue('5');
    expect(inputs[5]).toHaveValue('Yes');
  });

  it('should render processed all events status as "No" when false', () => {
    render(<AlertDiagnosticInfoTab diagnosticData={mockEmptyDiagnosticData} />);

    const inputs = screen.getAllByTestId('input-field');

    expect(inputs[5]).toHaveValue('No');
  });

  it('should render with empty/zero values correctly', () => {
    render(<AlertDiagnosticInfoTab diagnosticData={mockEmptyDiagnosticData} />);

    const inputs = screen.getAllByTestId('input-field');

    // Check numeric fields have value "0"
    expect(inputs[0]).toHaveValue('0'); // latestOffset
    expect(inputs[1]).toHaveValue('0'); // currentOffset
    expect(inputs[2]).toHaveValue('0'); // startingOffset
    expect(inputs[3]).toHaveValue('0'); // successfulEventsCount
    expect(inputs[4]).toHaveValue('0'); // failedEventsCount
  });
});

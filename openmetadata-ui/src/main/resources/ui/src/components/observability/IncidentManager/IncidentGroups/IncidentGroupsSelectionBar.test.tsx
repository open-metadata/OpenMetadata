/*
 *  Copyright 2026 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import {
  Severities as CreateSeverities,
  TestCaseResolutionStatusTypes as CreateStatusTypes,
} from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import IncidentGroupsSelectionBar from './IncidentGroupsSelectionBar';

const mockOnSetStatus = jest.fn();
const mockOnSetSeverity = jest.fn();
const mockOnClearSelection = jest.fn();

// Same press sequence react-aria listens for on its triggers and items.
const press = (element: HTMLElement) => {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerUp(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.click(element);
};

const renderBar = (selectedCount = 2, isApplying = false) =>
  render(
    <IncidentGroupsSelectionBar
      isApplying={isApplying}
      selectedCount={selectedCount}
      onClearSelection={mockOnClearSelection}
      onSetSeverity={mockOnSetSeverity}
      onSetStatus={mockOnSetStatus}
    />
  );

describe('IncidentGroupsSelectionBar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should count the selected groups', () => {
    renderBar();

    expect(
      screen.getByTestId('incident-groups-selected-count')
    ).toHaveTextContent(
      '2 label.group-lowercase-plural label.selected-lowercase'
    );
  });

  it('should read a single selected group in the singular', () => {
    renderBar(1);

    expect(
      screen.getByTestId('incident-groups-selected-count')
    ).toHaveTextContent('1 label.group-lowercase label.selected-lowercase');
  });

  it('should offer only the statuses an open incident can move to', () => {
    renderBar();

    press(screen.getByTestId('incident-groups-set-status'));

    expect(screen.getByText('label.set-status-to')).toBeInTheDocument();
    expect(
      screen.getByTestId(`incident-groups-status-${CreateStatusTypes.ACK}`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`incident-groups-status-${CreateStatusTypes.Resolved}`)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`incident-groups-status-${CreateStatusTypes.New}`)
    ).not.toBeInTheDocument();

    press(
      screen.getByTestId(`incident-groups-status-${CreateStatusTypes.Assigned}`)
    );

    expect(mockOnSetStatus).toHaveBeenCalledWith(CreateStatusTypes.Assigned);
  });

  it('should report the picked severity', () => {
    renderBar();

    press(screen.getByTestId('incident-groups-set-severity'));
    press(
      screen.getByTestId(
        `incident-groups-severity-${CreateSeverities.Severity3}`
      )
    );

    expect(mockOnSetSeverity).toHaveBeenCalledWith(CreateSeverities.Severity3);
  });

  it('should clear the selection', () => {
    renderBar();

    press(screen.getByTestId('incident-groups-clear-selection'));

    expect(mockOnClearSelection).toHaveBeenCalled();
  });

  it('should hold the actions back while a change is being applied', () => {
    renderBar(2, true);

    expect(screen.getByTestId('incident-groups-set-status')).toBeDisabled();
    expect(screen.getByTestId('incident-groups-set-severity')).toBeDisabled();
  });
});

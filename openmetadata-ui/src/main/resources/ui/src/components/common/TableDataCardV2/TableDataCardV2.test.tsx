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

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TableDataCardV2 from './TableDataCardV2';

jest.mock('../../../utils/TablePureUtils', () => ({
  getUsagePercentile: jest
    .fn()
    .mockImplementation((value = 0) => `${value} value`),
}));

jest.mock('../../../utils/EntityServiceIconUtils', () => ({
  getServiceIcon: jest.fn(),
}));

jest.mock('../../Database/TableDataCardBody/TableDataCardBody', () => {
  return jest.fn().mockReturnValue(<p>TableDataCardBody</p>);
});

const mockHandleSummaryPanelDisplay = jest.fn();

jest.mock('../../Entity/EntityHeader/EntityHeader.component', () => ({
  EntityHeader: jest.fn().mockImplementation(() => <p>EntityHeader</p>),
}));

describe('Test TableDataCard Component', () => {
  it('Component should render', () => {
    const { getByTestId, getByText } = render(
      <TableDataCardV2
        handleSummaryPanelDisplay={mockHandleSummaryPanelDisplay}
        id="1"
        source={{
          id: '1',
          name: 'Name1',
          fullyQualifiedName: 'test',
        }}
      />,
      { wrapper: MemoryRouter }
    );
    const tableDataCard = getByTestId('table-data-card_test');
    const entityHeader = getByText('EntityHeader');

    expect(tableDataCard).toBeInTheDocument();
    expect(entityHeader).toBeInTheDocument();
  });

  it('should call handleSummaryPanelDisplay once when the checkbox is clicked', () => {
    mockHandleSummaryPanelDisplay.mockClear();
    render(
      <TableDataCardV2
        showCheckboxes
        checked={false}
        handleSummaryPanelDisplay={mockHandleSummaryPanelDisplay}
        id="1"
        source={{ id: '1', name: 'Name1', fullyQualifiedName: 'test' }}
      />,
      { wrapper: MemoryRouter }
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(mockHandleSummaryPanelDisplay).toHaveBeenCalledTimes(1);
  });

  it('should mark an errored card with a red border only', () => {
    render(
      <TableDataCardV2
        errorMessage="Asset already belongs to another domain"
        id="1"
        source={{ id: '1', name: 'Name1', fullyQualifiedName: 'test' }}
      />,
      { wrapper: MemoryRouter }
    );

    const card = screen.getByTestId('table-data-card_test');

    expect(card).toHaveClass('tw:border-error');
    expect(card.className).not.toMatch(/tw:bg-utility-error/);
    expect(screen.getByTestId('table-data-card-error')).toHaveTextContent(
      'Asset already belongs to another domain'
    );
  });
});

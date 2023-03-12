/*
 *  Copyright 2023 Collate.
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

import { render } from '@testing-library/react';
import React from 'react';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import {
  mockFormattedEntityData,
  mockFormattedEntityDataWithChildren,
} from '../mocks/SummaryList.mock';
import SummaryList from './SummaryList.component';

jest.mock('./SummaryListItems/SummaryListItems.component', () =>
  jest.fn().mockImplementation(({ entityDetails, isColumnsData }) => (
    <div data-testid={`SummaryListItems-${entityDetails.name}`}>
      <div>{entityDetails.name}</div>
      <div data-testid={`isColumnsData-${entityDetails.name}`}>
        {`${isColumnsData}`}
      </div>
    </div>
  ))
);

describe('SummaryList component tests', () => {
  it('No data placeholder should display when an empty array is sent as a prop', () => {
    const { getByText } = render(<SummaryList formattedEntityData={[]} />);

    const noDataPlaceholder = getByText('message.no-data-available');

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('Summary list items should render properly for given formatted entity data', () => {
    const { getByTestId } = render(
      <SummaryList formattedEntityData={mockFormattedEntityData} />
    );

    const summaryListItem1 = getByTestId('SummaryListItems-name1');
    const summaryListItem2 = getByTestId('SummaryListItems-name2');
    const isColumnData1 = getByTestId('isColumnsData-name1');
    const isColumnData2 = getByTestId('isColumnsData-name2');

    expect(summaryListItem1).toBeInTheDocument();
    expect(summaryListItem2).toBeInTheDocument();
    expect(isColumnData1).toContainHTML('false');
    expect(isColumnData2).toContainHTML('false');
  });

  it('SummaryListItem component should receive isColumnsData prop true for entityType "column"', () => {
    const { getByTestId } = render(
      <SummaryList
        entityType={SummaryEntityType.COLUMN}
        formattedEntityData={mockFormattedEntityData}
      />
    );

    const summaryListItem1 = getByTestId('SummaryListItems-name1');
    const summaryListItem2 = getByTestId('SummaryListItems-name2');
    const isColumnData1 = getByTestId('isColumnsData-name1');
    const isColumnData2 = getByTestId('isColumnsData-name2');

    expect(summaryListItem1).toBeInTheDocument();
    expect(summaryListItem2).toBeInTheDocument();
    expect(isColumnData1).toContainHTML('true');
    expect(isColumnData2).toContainHTML('true');
  });

  it('Collapse should render for entity with children', () => {
    const { getByTestId, queryByTestId } = render(
      <SummaryList formattedEntityData={mockFormattedEntityDataWithChildren} />
    );

    const collapse1 = getByTestId('name1-collapse');
    const collapse2 = queryByTestId('name2-collapse');

    expect(collapse1).toBeInTheDocument();
    expect(collapse2).toBeNull();
  });
});

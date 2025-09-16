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
import { LINEAGE_TAB_VIEW } from '../../../constants/Lineage.constants';
import { LineageLayer } from '../../../generated/settings/settings';
import CustomControlsComponent from './CustomControls.component';

const mockOnEditLineageClick = jest.fn();
const mockOnExportClick = jest.fn();
const mockHandleActiveViewTabChange = jest.fn();

jest.mock('./LineageSearchSelect/LineageSearchSelect', () =>
  jest.fn().mockReturnValue(<p>LineageSearchSelect</p>)
);

jest.mock('../../Explore/ExploreQuickFilters', () =>
  jest.fn().mockReturnValue(<p>ExploreQuickFilters</p>)
);

jest.mock('reactflow', () => ({
  Position: () => ({
    Left: 'left',
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
  }),
  MarkerType: () => ({
    Arrow: 'arrow',
    ArrowClosed: 'arrowclosed',
  }),
}));

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    onLineageEditClick: mockOnEditLineageClick,
    onExportClick: mockOnExportClick,
    activeLayer: [LineageLayer.ColumnLevelLineage],
  })),
}));

describe('CustomControls', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls onEditLinageClick on Edit Lineage button click', () => {
    const { getByText } = render(
      <CustomControlsComponent
        activeViewTab={LINEAGE_TAB_VIEW.DIAGRAM_VIEW}
        handleActiveViewTabChange={mockHandleActiveViewTabChange}
        onlyShowTabSwitch={false}
      />
    );

    // check LineageSearchSelect is visible
    expect(getByText('LineageSearchSelect')).toBeInTheDocument();

    // check ExploreQuickFilters is visible
    expect(getByText('ExploreQuickFilters')).toBeInTheDocument();
  });
});

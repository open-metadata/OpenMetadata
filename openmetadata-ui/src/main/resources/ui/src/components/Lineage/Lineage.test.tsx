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
import { render, screen } from '@testing-library/react';
import { EntityType } from '../../enums/entity.enum';
import { Table } from '../../generated/entity/data/table';
import { useLineageStore } from '../../hooks/useLineageStore';
import { MOCK_EXPLORE_SEARCH_RESULTS } from '../Explore/Explore.mock';
import Lineage from './Lineage.component';
import LineageMap from './LineageMap/LineageMap.component';

const mockEntity = MOCK_EXPLORE_SEARCH_RESULTS.hits.hits[0]._source;

jest.mock('../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn(),
}));

jest.mock('../Entity/EntityLineage/CustomControls.component', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="custom-controls" />),
}));

jest.mock('./LineageMap/LineageMap.component', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="lineage-map" />),
}));

describe('Lineage Component', () => {
  const defaultProps = {
    entity: mockEntity as Table,
    deleted: false,
    hasEditAccess: true,
    entityType: EntityType.TABLE,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useLineageStore as unknown as jest.Mock).mockReturnValue({
      isEditMode: false,
    });
  });

  it('renders the scene-backed map in the lineage container', () => {
    render(<Lineage {...defaultProps} />);

    expect(screen.getByTestId('lineage-details')).toBeInTheDocument();
    expect(screen.getByTestId('lineage-container')).toHaveAttribute(
      'id',
      'lineage-container'
    );
    expect(screen.getByTestId('custom-controls')).toBeInTheDocument();
    expect(screen.getByTestId('lineage-map')).toBeInTheDocument();
  });

  it('passes entity context to the scene map', () => {
    render(<Lineage {...defaultProps} />);

    const lineageMapMock = LineageMap as jest.MockedFunction<typeof LineageMap>;
    const mapProps = lineageMapMock.mock.calls[0][0];

    expect(mapProps).toEqual(
      expect.objectContaining({
        entity: mockEntity,
        entityType: EntityType.TABLE,
        hasEditAccess: true,
        isPlatformLineage: undefined,
      })
    );
  });

  it('uses the platform header without entity controls for platform lineage', () => {
    render(
      <Lineage
        {...defaultProps}
        isPlatformLineage
        platformHeader={<div data-testid="platform-header" />}
      />
    );

    expect(screen.getByTestId('platform-header')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-controls')).not.toBeInTheDocument();
  });

  it('applies edit mode class when edit mode is active', () => {
    (useLineageStore as unknown as jest.Mock).mockReturnValue({
      isEditMode: true,
    });

    render(<Lineage {...defaultProps} />);

    expect(screen.getByTestId('custom-controls').parentElement).toHaveClass(
      'lineage-header-edit-mode'
    );
  });

  it('keeps the scene map mounted when controls are hidden', () => {
    render(<Lineage {...defaultProps} showControls={false} />);

    expect(screen.queryByTestId('custom-controls')).not.toBeInTheDocument();
    expect(screen.getByTestId('lineage-map')).toBeInTheDocument();
  });
});

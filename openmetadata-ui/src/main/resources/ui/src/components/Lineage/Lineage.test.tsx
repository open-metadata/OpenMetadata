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
import EntityLineageCanvas from './EntityLineageCanvas/EntityLineageCanvas';
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

jest.mock('./EntityLineageCanvas/EntityLineageCanvas', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="entity-lineage-canvas" />),
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
    (useLineageStore as unknown as jest.Mock).mockReturnValue({});
  });

  it('renders the classic lineage canvas on an asset page', () => {
    render(<Lineage {...defaultProps} />);

    expect(screen.getByTestId('lineage-details')).toBeInTheDocument();
    expect(screen.getByTestId('lineage-container')).toHaveAttribute(
      'id',
      'lineage-container'
    );
    expect(screen.getByTestId('custom-controls')).toBeInTheDocument();
    expect(screen.getByTestId('entity-lineage-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('lineage-map')).not.toBeInTheDocument();
  });

  it('passes entity context to the asset canvas', () => {
    render(<Lineage {...defaultProps} />);

    const canvasMock = EntityLineageCanvas as jest.MockedFunction<
      typeof EntityLineageCanvas
    >;

    expect(canvasMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        entity: mockEntity,
        entityType: EntityType.TABLE,
        hasEditAccess: true,
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
    expect(screen.getByTestId('lineage-map')).toBeInTheDocument();
    expect(
      screen.queryByTestId('entity-lineage-canvas')
    ).not.toBeInTheDocument();
    expect(LineageMap).toHaveBeenCalledWith(
      expect.objectContaining({ isPlatformLineage: true }),
      expect.anything()
    );
  });

  it('keeps the canvas mounted when controls are hidden', () => {
    render(<Lineage {...defaultProps} showControls={false} />);

    expect(screen.queryByTestId('custom-controls')).not.toBeInTheDocument();
    expect(screen.getByTestId('entity-lineage-canvas')).toBeInTheDocument();
  });
});

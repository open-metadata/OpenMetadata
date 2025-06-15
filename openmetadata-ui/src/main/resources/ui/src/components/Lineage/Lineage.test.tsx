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
import { MOCK_EXPLORE_SEARCH_RESULTS } from '../Explore/Explore.mock';
import Lineage from './Lineage.component';
import { EntityLineageResponse } from './Lineage.interface';

const entityLineage: EntityLineageResponse | undefined = {
  entity: {
    name: 'fact_sale',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
    id: '5a1947bb-84eb-40de-a5c5-2b7b80c834c3',
    type: 'table',
  },
  nodes: [
    {
      name: 'dim_location',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_location',
      id: '30e9170c-0e07-4e55-bf93-2d2dfab3a36e',
      type: 'table',
    },
    {
      name: 'dim_address_clean',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address_clean',
      id: '6059959e-96c8-4b61-b905-fc5d88b33293',
      type: 'table',
    },
  ],
  edges: [
    {
      toEntity: {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_location',
        id: '30e9170c-0e07-4e55-bf93-2d2dfab3a36e',
        type: 'table',
      },
      fromEntity: {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
        id: '5a1947bb-84eb-40de-a5c5-2b7b80c834c3',
        type: 'table',
      },
      sqlQuery: '',
      source: 'Manual',
    },
    {
      toEntity: {
        fullyQualifiedName: 'mlflow_svc.eta_predictions',
        id: 'b81f6bad-42f3-4216-8505-cf6f0c0a8897',
        type: 'mlmodel',
      },
      fromEntity: {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
        id: '5a1947bb-84eb-40de-a5c5-2b7b80c834c3',
        type: 'table',
      },
    },
    {
      toEntity: {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
        id: '5a1947bb-84eb-40de-a5c5-2b7b80c834c3',
        type: 'table',
      },
      fromEntity: {
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address_clean',
        id: '6059959e-96c8-4b61-b905-fc5d88b33293',
        type: 'table',
      },
      sqlQuery: '',
      source: 'Manual',
    },
  ],
};

jest.mock('../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    tracedNodes: [],
    tracedColumns: [],
    activeLayer: [],
    entityLineage: entityLineage,
    updateEntityData: jest.fn(),
    init: true,
  })),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: 'pathname' }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    fqn: 'fqn',
  }),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../Entity/EntityLineage/CustomControls.component', () => {
  return jest.fn().mockImplementation(() => {
    return <p>Controls Component</p>;
  });
});

describe('Lineage', () => {
  const mockProps = {
    entity: MOCK_EXPLORE_SEARCH_RESULTS.hits.hits[0]._source,
    deleted: false,
    hasEditAccess: true,
    entityType: EntityType.TABLE,
  };

  beforeEach(() => {
    render(<Lineage {...mockProps} />);
  });

  it('renders Lineage component', () => {
    const customControlsComponent = screen.getByText('Controls Component');
    const lineageComponent = screen.getByTestId('lineage-container');

    expect(lineageComponent).toBeInTheDocument();
    expect(customControlsComponent).toBeInTheDocument();
  });
});

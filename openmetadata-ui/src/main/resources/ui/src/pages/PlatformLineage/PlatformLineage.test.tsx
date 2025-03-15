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
import { EntityType } from '../../enums/entity.enum';
import { LineageLayer } from '../../generated/configuration/lineageSettings';
import PlatformLineage from './PlatformLineage';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => ({
    entityType: EntityType.DATABASE_SERVICE,
    fqn: 'test-fqn',
  })),
  useHistory: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchData: jest.fn(),
}));

jest.mock('../../rest/domainAPI');
jest.mock('../../rest/serviceAPI');
jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-fqn' }),
}));

jest.mock('../../components/Lineage/Lineage.component', () => {
  return jest.fn().mockReturnValue(<p>EntityLineage.component</p>);
});

jest.mock('../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    onLineageEditClick: jest.fn(),
    onExportClick: jest.fn(),
    activeLayer: [LineageLayer.EntityLineage],
  })),
}));

jest.mock('react-helmet-async', () => ({
  HelmetProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('PlatformLineage', () => {
  it('renders platform lineage component with search controls', async () => {
    render(<PlatformLineage />);

    expect(screen.getByTestId('search-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('search-entity-select')).toBeInTheDocument();
  });
});

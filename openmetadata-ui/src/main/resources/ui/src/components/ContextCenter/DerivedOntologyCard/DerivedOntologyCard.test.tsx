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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getContextMemoryById } from '../../../rest/contextMemoryAPI';
import DerivedOntologyCard from './DerivedOntologyCard.component';

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getContextMemoryById: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn((_type: string, fqn: string) => `/mock/${fqn}`),
  },
}));

const mockGetContextMemoryById = getContextMemoryById as jest.Mock;

const DERIVED_TERM = {
  id: 'gt-1',
  type: 'glossaryTerm',
  name: 'CustomerChurn',
  displayName: 'Customer Churn',
  fullyQualifiedName: 'MyGlossary.CustomerChurn',
};

const REUSED_METRIC = {
  id: 'mt-1',
  type: 'metric',
  name: 'RetentionRate',
  displayName: 'Retention Rate',
  fullyQualifiedName: 'Metrics.RetentionRate',
};

describe('DerivedOntologyCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders derived and reused entity links after fetch', async () => {
    mockGetContextMemoryById.mockResolvedValue({
      id: 'mem-1',
      name: 'churn-memory',
      derivedEntities: [DERIVED_TERM],
      reusedEntities: [REUSED_METRIC],
    });

    render(
      <MemoryRouter>
        <DerivedOntologyCard memoryId="mem-1" />
      </MemoryRouter>
    );

    expect(await screen.findByText('Customer Churn')).toBeInTheDocument();
    expect(screen.getByText('Retention Rate')).toBeInTheDocument();
    expect(mockGetContextMemoryById).toHaveBeenCalledWith(
      'mem-1',
      'derivedEntities,reusedEntities'
    );
  });

  it('renders empty state when no entities exist', async () => {
    mockGetContextMemoryById.mockResolvedValue({
      id: 'mem-2',
      name: 'empty-memory',
      derivedEntities: [],
      reusedEntities: [],
    });

    render(
      <MemoryRouter>
        <DerivedOntologyCard memoryId="mem-2" />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('message.no-derived-ontology')
    ).toBeInTheDocument();
  });

  it('renders empty state when fields are absent from response', async () => {
    mockGetContextMemoryById.mockResolvedValue({
      id: 'mem-3',
      name: 'no-fields-memory',
    });

    render(
      <MemoryRouter>
        <DerivedOntologyCard memoryId="mem-3" />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('message.no-derived-ontology')
    ).toBeInTheDocument();
  });

  it('links each entity to its detail page', async () => {
    mockGetContextMemoryById.mockResolvedValue({
      id: 'mem-4',
      name: 'link-memory',
      derivedEntities: [DERIVED_TERM],
      reusedEntities: [],
    });

    render(
      <MemoryRouter>
        <DerivedOntologyCard memoryId="mem-4" />
      </MemoryRouter>
    );

    const link = await screen.findByTestId('ontology-entity-gt-1');

    expect(link).toHaveAttribute('href', '/mock/MyGlossary.CustomerChurn');
  });
});

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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Type } from '../../generated/api/rdf/sparqlResponse';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAuth } from '../../hooks/authHooks';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { getGlossaryTerms } from '../../rest/glossaryAPI';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import { runGlossarySparqlQuery, runSparqlQuery } from '../../rest/rdfAPI';
import OntologyVisualQueryBuilder from './OntologyVisualQueryBuilder';

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest.fn(),
}));

jest.mock('../../rest/ontologyAPI', () => ({
  listRelationshipTypes: jest.fn(),
}));

jest.mock('../../rest/rdfAPI', () => ({
  runGlossarySparqlQuery: jest.fn(),
  runSparqlQuery: jest.fn(),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockListRelationshipTypes = listRelationshipTypes as jest.MockedFunction<
  typeof listRelationshipTypes
>;
const mockGetGlossaryTerms = getGlossaryTerms as jest.MockedFunction<
  typeof getGlossaryTerms
>;
const mockRunSparqlQuery = runSparqlQuery as jest.MockedFunction<
  typeof runSparqlQuery
>;
const mockRunGlossarySparqlQuery =
  runGlossarySparqlQuery as jest.MockedFunction<typeof runGlossarySparqlQuery>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const antiMoneyLaunderingTerm: GlossaryTerm = {
  id: 'aml-id',
  name: 'AntiMoneyLaundering',
  displayName: 'Anti-Money Laundering',
  description: '',
  fullyQualifiedName: 'FinancialRiskCompliance.Compliance.AntiMoneyLaundering',
  glossary: { id: 'glossary-id', type: 'glossary' },
};
const knowYourCustomerTerm: GlossaryTerm = {
  id: 'kyc-id',
  name: 'KnowYourCustomer',
  displayName: 'Know Your Customer',
  description: '',
  fullyQualifiedName: 'FinancialRiskCompliance.Compliance.KnowYourCustomer',
  glossary: { id: 'glossary-id', type: 'glossary' },
};

const RELATION_TYPES = [
  createRelationshipTypeMock({
    name: 'relatedTo',
    displayName: 'Related To',
    rdfPredicate: 'https://open-metadata.org/ontology/relatedTo',
  }),
  createRelationshipTypeMock({
    name: 'partOf',
    displayName: 'Part Of',
    rdfPredicate: 'https://open-metadata.org/ontology/partOf',
  }),
];

describe('OntologyVisualQueryBuilder component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isAdminUser: false,
      isFirstTimeUser: false,
    });
    mockListRelationshipTypes.mockResolvedValue({
      data: RELATION_TYPES,
      paging: { total: RELATION_TYPES.length },
    });
    mockGetGlossaryTerms.mockResolvedValue({
      data: [antiMoneyLaunderingTerm, knowYourCustomerTerm],
      paging: { total: 2 },
    });
    mockRunSparqlQuery.mockResolvedValue({
      format: 'json',
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 12,
      parsed: {
        head: { vars: ['concept'] },
        results: {
          bindings: [
            {
              concept: {
                type: Type.URI,
                value: 'https://open-metadata.org/entity/glossaryTerm/result',
              },
            },
          ],
        },
      },
    });
    mockRunGlossarySparqlQuery.mockResolvedValue({
      format: 'json',
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 12,
      parsed: {
        head: { vars: ['concept'] },
        results: {
          bindings: [
            {
              concept: {
                type: Type.URI,
                value: 'https://open-metadata.org/entity/glossaryTerm/result',
              },
            },
          ],
        },
      },
    });
  });

  it('allows the relationship and target term to be selected', async () => {
    render(
      <OntologyVisualQueryBuilder selectedGlossaryIds={['glossary-id']} />
    );

    await waitFor(() =>
      expect(screen.getByText('Anti-Money Laundering')).toBeVisible()
    );

    expect(screen.getByTestId('ontology-generated-sparql')).toHaveTextContent(
      'FinancialRiskCompliance.Compliance.AntiMoneyLaundering'
    );

    fireEvent.click(
      screen.getByRole('button', { name: /label\.relationship-type/ })
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Part Of' }));

    const targetSelector = screen.getByRole('combobox', {
      name: 'label.target-term',
    });

    expect(targetSelector).toHaveValue('Anti-Money Laundering');

    fireEvent.click(screen.getByRole('button', { name: 'Show options' }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Know Your Customer' })
    );

    expect(screen.getByTestId('ontology-generated-sparql')).toHaveTextContent(
      '<https://open-metadata.org/ontology/partOf>'
    );
    expect(screen.getByTestId('ontology-generated-sparql')).toHaveTextContent(
      'FinancialRiskCompliance.Compliance.KnowYourCustomer'
    );

    fireEvent.click(screen.getByTestId('ontology-builder-run'));

    await waitFor(() =>
      expect(mockRunGlossarySparqlQuery).toHaveBeenCalledWith(
        'glossary-id',
        expect.objectContaining({
          query: expect.stringContaining(
            'FinancialRiskCompliance.Compliance.KnowYourCustomer'
          ),
        })
      )
    );

    expect(await screen.findByTestId('ontology-builder-result')).toBeVisible();
  });

  it('hands the generated query to onEditAsSparql', async () => {
    const onEditAsSparql = jest.fn();
    render(
      <OntologyVisualQueryBuilder
        selectedGlossaryIds={['glossary-id']}
        onEditAsSparql={onEditAsSparql}
      />
    );

    await waitFor(() =>
      expect(screen.getByText('Anti-Money Laundering')).toBeVisible()
    );

    fireEvent.click(screen.getByTestId('ontology-builder-edit-as-sparql'));

    expect(onEditAsSparql).toHaveBeenCalledWith(
      expect.stringContaining(
        'FinancialRiskCompliance.Compliance.AntiMoneyLaundering'
      )
    );
  });

  it('hides the Edit as SPARQL action when no handler is provided', async () => {
    render(
      <OntologyVisualQueryBuilder selectedGlossaryIds={['glossary-id']} />
    );

    await waitFor(() =>
      expect(screen.getByText('Anti-Money Laundering')).toBeVisible()
    );

    expect(
      screen.queryByTestId('ontology-builder-edit-as-sparql')
    ).not.toBeInTheDocument();
  });

  it('derives the initial selection from the loaded ontology graph', async () => {
    render(
      <OntologyVisualQueryBuilder
        graphData={{
          nodes: [
            {
              id: 'aml-id',
              label: 'Anti-Money Laundering',
              type: 'glossaryTerm',
              fullyQualifiedName:
                'FinancialRiskCompliance.Compliance.AntiMoneyLaundering',
            },
            {
              id: 'kyc-id',
              label: 'Know Your Customer',
              type: 'glossaryTerm',
              fullyQualifiedName:
                'FinancialRiskCompliance.Compliance.KnowYourCustomer',
            },
          ],
          edges: [
            {
              from: 'aml-id',
              to: 'kyc-id',
              label: 'Part Of',
              relationType: 'partOf',
            },
          ],
        }}
        relationTypes={RELATION_TYPES}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /label\.relationship-type/ })
      ).toHaveTextContent('Part Of')
    );

    expect(screen.getByText('Know Your Customer')).toBeVisible();
    expect(mockListRelationshipTypes).not.toHaveBeenCalled();
    expect(mockGetGlossaryTerms).not.toHaveBeenCalled();
  });
});

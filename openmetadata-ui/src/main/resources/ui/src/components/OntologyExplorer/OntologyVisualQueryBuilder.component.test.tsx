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

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { Type } from '../../generated/api/rdf/sparqlResponse';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Ontology } from '../../generated/entity/data/ontology';
import {
  AxiomType,
  ExpressionKind,
  OntologyAxiom,
  Provenance,
} from '../../generated/entity/data/ontologyAxiom';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../generated/entity/data/ontologyConcept';
import { useAuth } from '../../hooks/authHooks';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import APIClient from '../../rest/axiosClient';
import { getGlossaryTerms } from '../../rest/glossaryAPI';
import {
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
  listRelationshipTypes,
} from '../../rest/ontologyAPI';
import { runGlossarySparqlQuery, runSparqlQuery } from '../../rest/rdfAPI';
import { renderWithQueryClient as render } from '../../test/unit/test-utils';
import OntologyVisualQueryBuilder from './OntologyVisualQueryBuilder';

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest.fn(),
}));

jest.mock('../../rest/ontologyAPI', () => ({
  listOntologyAxioms: jest.fn(),
  listOntologyConcepts: jest.fn(),
  listOntologyProperties: jest.fn(),
  listRelationshipTypes: jest.fn(),
}));

jest.mock('../../rest/rdfAPI', () => ({
  ...jest.requireActual<typeof import('../../rest/rdfAPI')>(
    '../../rest/rdfAPI'
  ),
  runGlossarySparqlQuery: jest.fn(),
  runSparqlQuery: jest.fn(),
}));

jest.mock('../../rest/axiosClient', () => ({ post: jest.fn() }));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockListRelationshipTypes = listRelationshipTypes as jest.MockedFunction<
  typeof listRelationshipTypes
>;
const mockListOntologyConcepts = listOntologyConcepts as jest.MockedFunction<
  typeof listOntologyConcepts
>;
const mockListOntologyProperties =
  listOntologyProperties as jest.MockedFunction<typeof listOntologyProperties>;
const mockListOntologyAxioms = listOntologyAxioms as jest.MockedFunction<
  typeof listOntologyAxioms
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

const nativeOntology: Ontology = {
  id: 'native-owner',
  name: 'Retail',
  fullyQualifiedName: 'Retail',
  iri: 'urn:retail',
  namespace: 'urn:retail:',
};
const nativeConcepts = ['Customer', 'Party', 'Organization'].map(
  (name): OntologyConcept => ({
    id: name,
    name,
    fullyQualifiedName: `Retail.${name}`,
    iri: `urn:retail:${name}`,
    conceptType: OntologyConceptType.OwlClass,
    ontology: { id: nativeOntology.id, type: 'ontology' },
  })
);
const subclass: OntologyAxiom = {
  id: 'subclass',
  name: 'subclass',
  fullyQualifiedName: 'Retail.subclass',
  displayName: 'Customer is a Party',
  description: '',
  axiomType: AxiomType.SubclassOf,
  subjectIri: 'urn:retail:Customer',
  expressions: [
    { kind: ExpressionKind.NamedClass, classIri: 'urn:retail:Party' },
  ],
  provenance: Provenance.Manual,
  ontology: { id: nativeOntology.id, type: 'ontology' },
};

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

  it('queries native selections through the owner endpoint and reports a missing active release', async () => {
    mockListOntologyConcepts.mockResolvedValue({
      data: nativeConcepts,
      paging: { total: 3 },
    });
    mockListOntologyProperties.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockListOntologyAxioms.mockResolvedValue({
      data: [
        subclass,
        {
          ...subclass,
          id: 'disjoint',
          name: 'disjoint',
          fullyQualifiedName: 'Retail.disjoint',
          axiomType: AxiomType.DisjointWith,
          expressions: [
            {
              kind: ExpressionKind.NamedClass,
              classIri: 'urn:retail:Organization',
            },
          ],
        },
      ],
      paging: { total: 2 },
    });
    const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;
    post.mockResolvedValue({
      headers: { 'content-type': 'application/sparql-results+json' },
      data: JSON.stringify({
        head: { vars: ['concept', 'label'] },
        results: {
          bindings: [
            {
              concept: { type: Type.URI, value: 'urn:retail:Customer' },
              label: { type: Type.Literal, value: 'Customer result' },
            },
          ],
        },
      }),
    });
    render(<OntologyVisualQueryBuilder ontology={nativeOntology} />);
    const target = await screen.findByRole('combobox', {
      name: 'label.concept',
    });
    await waitFor(() => expect(target).toHaveValue('Party'));

    expect(
      screen.getByText('message.ontology-native-builder-scope')
    ).toBeVisible();
    expect(
      screen.queryByTestId('ontology-builder-find-metrics')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-builder-find-any')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /label\.relationship-type/ })
    );
    fireEvent.click(await screen.findByRole('option', { name: /disjoint/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Show options' }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Organization' })
    );
    const generated = screen.getByTestId('ontology-generated-sparql');

    expect(generated).toHaveTextContent(
      'VALUES ?target { <urn:retail:Organization> }'
    );
    expect(generated).toHaveTextContent('?concept owl:disjointWith ?target');
    expect(generated).not.toHaveTextContent('GlossaryTerm');
    expect(generated).not.toHaveTextContent('fullyQualifiedName');

    fireEvent.click(screen.getByTestId('ontology-builder-run'));

    expect(await screen.findByText('Customer result')).toBeVisible();
    expect(post).toHaveBeenCalledWith(
      '/ontologies/native-owner/sparql',
      {
        query: expect.stringContaining(
          'VALUES ?target { <urn:retail:Organization> }'
        ),
        format: 'json',
        inference: 'none',
      },
      expect.anything()
    );
    expect(mockRunGlossarySparqlQuery).not.toHaveBeenCalled();
    expect(mockRunSparqlQuery).not.toHaveBeenCalled();

    post.mockRejectedValue(
      new AxiosError('Ontology has no active release', '409')
    );
    fireEvent.click(screen.getByTestId('ontology-builder-run'));

    expect(
      await screen.findByText('Ontology has no active release')
    ).toBeVisible();
    expect(screen.queryByText('Customer result')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-builder-result')
    ).not.toBeInTheDocument();
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

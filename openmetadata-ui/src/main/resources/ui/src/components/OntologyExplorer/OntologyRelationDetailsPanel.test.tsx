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
import { ObjectKind } from '../../generated/api/data/ontologyInferenceExplanationRequest';
import { ProjectionState } from '../../generated/api/rdf/rdfStatus';
import { EntityStatus, Provenance } from '../../generated/type/termRelation';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { explainOntologyInference } from '../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../rest/rdfAPI';
import { MergedEdge } from './OntologyExplorer.interface';
import { OntologyRelationDetailsPanel } from './OntologyRelationDetailsPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  explainOntologyInference: jest.fn(),
}));
jest.mock('../../rest/rdfAPI', () => ({
  fetchRdfConfig: jest.fn(),
}));

const mockExplainOntologyInference =
  explainOntologyInference as jest.MockedFunction<
    typeof explainOntologyInference
  >;
const mockFetchRdfConfig = fetchRdfConfig as jest.MockedFunction<
  typeof fetchRdfConfig
>;

const AUTHORED_EDGE: MergedEdge = {
  createdAt: 1_700_000_000_000,
  createdBy: 'ontology-editor',
  from: 'source-id',
  id: 'relationship-id',
  isBidirectional: false,
  provenance: Provenance.Manual,
  relationType: 'partOf',
  status: EntityStatus.Draft,
  to: 'target-id',
};

const NODES = [
  {
    glossaryId: 'glossary-id',
    id: 'source-id',
    label: 'Source term',
    type: 'glossaryTerm',
  },
  {
    glossaryId: 'glossary-id',
    id: 'target-id',
    label: 'Target term',
    type: 'glossaryTerm',
  },
];

describe('OntologyRelationDetailsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders persisted relationship metadata and authored-edge controls', () => {
    render(
      <OntologyRelationDetailsPanel
        isEditable
        edge={AUTHORED_EDGE}
        isSaving={false}
        nodes={NODES}
        relationshipTypes={[createRelationshipTypeMock({ name: 'partOf' })]}
        onClose={jest.fn()}
        onDelete={jest.fn()}
        onUpdate={jest.fn()}
      />
    );

    expect(screen.getByText('Source term')).toBeInTheDocument();
    expect(screen.getByText('Target term')).toBeInTheDocument();
    expect(screen.getByText('ontology-editor')).toBeInTheDocument();
    expect(screen.getByTestId('relation-type-select')).toBeInTheDocument();
    expect(
      screen.getByTestId('relation-provenance-select')
    ).toBeInTheDocument();
    expect(screen.getByTestId('relation-status-select')).toBeInTheDocument();
  });

  it('keeps inferred relationships read-only', () => {
    render(
      <OntologyRelationDetailsPanel
        edge={{ ...AUTHORED_EDGE, provenance: Provenance.Inferred }}
        isEditable={false}
        isSaving={false}
        nodes={NODES}
        relationshipTypes={[]}
        onClose={jest.fn()}
        onDelete={jest.fn()}
        onUpdate={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('relation-type-select')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('relation-provenance-select')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('relation-status-select')
    ).not.toBeInTheDocument();
  });

  it('loads a scoped typed explanation for an inferred relationship', async () => {
    const relationshipType = createRelationshipTypeMock({ name: 'partOf' });
    mockFetchRdfConfig.mockResolvedValue({
      askCollateEnabled: false,
      baseUri: 'https://rdf.example.test/',
      enabled: true,
      inference: {
        availableLevels: ['CUSTOM'],
        defaultLevel: 'CUSTOM',
        enabled: true,
      },
      projectionState: ProjectionState.Ready,
      storageType: 'fuseki',
    });
    mockExplainOntologyInference.mockResolvedValue({
      asserted: false,
      explanations: [
        {
          graphUri: 'https://rdf.example.test/graph/inferred/rule/glossary-id',
          rule: {
            displayName: 'Part hierarchy closure',
            name: 'part-closure',
            ruleBody: 'CONSTRUCT WHERE',
          },
          tripleCount: 12,
        },
      ],
      glossary: { id: 'glossary-id', type: 'glossary' },
      inferred: true,
      statement: {
        objectIri: 'https://rdf.example.test/entity/glossaryTerm/target-id',
        objectKind: ObjectKind.IRI,
        predicateIri: relationshipType.rdfPredicate,
        subjectIri: 'https://rdf.example.test/entity/glossaryTerm/source-id',
      },
    });

    render(
      <OntologyRelationDetailsPanel
        edge={{ ...AUTHORED_EDGE, provenance: Provenance.Inferred }}
        isEditable={false}
        isSaving={false}
        nodes={NODES}
        relationshipTypes={[relationshipType]}
        onClose={jest.fn()}
        onDelete={jest.fn()}
        onUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('load-inference-explanation'));

    await waitFor(() =>
      expect(mockExplainOntologyInference).toHaveBeenCalledWith({
        glossaryId: 'glossary-id',
        statement: {
          objectIri: 'https://rdf.example.test/entity/glossaryTerm/target-id',
          objectKind: ObjectKind.IRI,
          predicateIri: relationshipType.rdfPredicate,
          subjectIri: 'https://rdf.example.test/entity/glossaryTerm/source-id',
        },
      })
    );

    expect(screen.getByText('Part hierarchy closure')).toBeInTheDocument();
  });

  it('requires confirmation before deleting the selected stable edge', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(
      <OntologyRelationDetailsPanel
        isEditable
        edge={AUTHORED_EDGE}
        isSaving={false}
        nodes={NODES}
        relationshipTypes={[]}
        onClose={jest.fn()}
        onDelete={onDelete}
        onUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('delete-relation-btn'));

    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-delete-relation-btn'));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(AUTHORED_EDGE));
  });
});

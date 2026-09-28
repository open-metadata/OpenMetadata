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
import {
  ObjectKind,
  OntologyInferenceExplanation,
} from '../../generated/api/data/ontologyInferenceExplanation';
import { ProjectionState, RDFStatus } from '../../generated/api/rdf/rdfStatus';
import {
  Category,
  PaletteKey,
  RelationshipType,
} from '../../generated/entity/data/relationshipType';
import { Provenance } from '../../generated/type/termRelation';
import { explainOntologyInference } from '../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../rest/rdfAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { MergedEdge, OntologyNode } from './OntologyExplorer.interface';
import OntologyInferenceExplanationPanel from './OntologyInferenceExplanationPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  explainOntologyInference: jest.fn(),
}));

jest.mock('../../rest/rdfAPI', () => ({
  fetchRdfConfig: jest.fn(),
}));

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('formatted-date'),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockFetchRdfConfig = fetchRdfConfig as jest.MockedFunction<
  typeof fetchRdfConfig
>;
const mockExplain = explainOntologyInference as jest.MockedFunction<
  typeof explainOntologyInference
>;

const nodes: OntologyNode[] = [
  {
    glossaryId: 'glossary-id',
    id: 'source-id',
    label: 'Account',
    type: 'glossaryTerm',
  },
  { id: 'target-id', label: 'Customer', type: 'glossaryTerm' },
];

const relationshipType: RelationshipType = {
  category: Category.Custom,
  characteristics: [],
  crossGlossaryAllowed: false,
  description: 'Related concepts',
  displayName: 'Related to',
  fullyQualifiedName: 'relatedTo',
  id: 'relationship-type-id',
  name: 'relatedTo',
  paletteKey: PaletteKey.Blue,
  rdfPredicate: 'https://example.com/relatedTo',
  systemDefined: false,
};

const edge: MergedEdge = {
  from: 'source-id',
  isBidirectional: false,
  provenance: Provenance.Inferred,
  relationType: 'relatedTo',
  to: 'target-id',
};

const rdfStatus = (
  overrides: Partial<RDFStatus> = {},
  inferenceEnabled = true
): RDFStatus => ({
  askCollateEnabled: false,
  baseUri: 'https://om.example.com',
  enabled: true,
  inference: {
    availableLevels: [],
    defaultLevel: 'rdfs',
    enabled: inferenceEnabled,
  },
  projectionState: ProjectionState.Ready,
  storageType: 'memory',
  ...overrides,
});

const explanation = (
  overrides: Partial<OntologyInferenceExplanation> = {}
): OntologyInferenceExplanation => ({
  asserted: false,
  explanations: [
    {
      graphUri: 'urn:graph:1',
      lastMaterializedAt: 1,
      rule: {
        description: 'Transitive closure',
        displayName: 'Transitivity',
        name: 'transitivity',
        ruleBody: '?a ?p ?b . ?b ?p ?c -> ?a ?p ?c',
      },
      tripleCount: 3,
    },
    {
      graphUri: 'urn:graph:2',
      rule: { name: 'symmetry', ruleBody: '?a ?p ?b -> ?b ?p ?a' },
      tripleCount: 1,
    },
  ],
  glossary: { id: 'glossary-id', type: 'glossary' },
  inferred: true,
  statement: {
    objectIri: 'o',
    objectKind: ObjectKind.IRI,
    predicateIri: 'p',
    subjectIri: 's',
  },
  ...overrides,
});

const renderPanel = (edgeOverrides: Partial<MergedEdge> = {}) =>
  render(
    <OntologyInferenceExplanationPanel
      edge={{ ...edge, ...edgeOverrides }}
      nodes={nodes}
      relationshipTypes={[relationshipType]}
    />
  );

const load = () =>
  fireEvent.click(screen.getByTestId('load-inference-explanation'));

describe('OntologyInferenceExplanationPanel', () => {
  it('renders nothing for edges that are not inferred', () => {
    const { container } = renderPanel({ provenance: Provenance.Manual });

    expect(container).toBeEmptyDOMElement();
  });

  it('disables loading when the edge cannot be resolved to a statement', () => {
    renderPanel({ relationType: 'unknown' });

    expect(screen.getByTestId('load-inference-explanation')).toBeDisabled();
  });

  it('reports inference as disabled without asking for an explanation', async () => {
    mockFetchRdfConfig.mockResolvedValue(rdfStatus({}, false));
    renderPanel();

    load();

    expect(
      await screen.findByText('label.inference label.disabled')
    ).toBeInTheDocument();
    expect(mockExplain).not.toHaveBeenCalled();
  });

  it('loads and renders the explanation, building IRIs from the base URI', async () => {
    mockFetchRdfConfig.mockResolvedValue(rdfStatus());
    mockExplain.mockResolvedValue(explanation());
    renderPanel();

    load();

    expect(await screen.findByText('label.rule-plural: 2')).toBeInTheDocument();
    expect(screen.getByText('label.inference: label.yes')).toBeInTheDocument();
    expect(screen.getByText('Transitivity')).toBeInTheDocument();
    expect(screen.getByText('Transitive closure')).toBeInTheDocument();
    expect(screen.getByText('symmetry')).toBeInTheDocument();
    expect(screen.getByText('label.count: 3')).toBeInTheDocument();
    expect(
      screen.getByText('label.last-updated: formatted-date')
    ).toBeInTheDocument();
    expect(formatDateTime).toHaveBeenCalledTimes(1);
    expect(mockExplain).toHaveBeenCalledWith({
      glossaryId: 'glossary-id',
      statement: {
        objectIri: 'https://om.example.com/entity/glossaryTerm/target-id',
        objectKind: ObjectKind.IRI,
        predicateIri: relationshipType.rdfPredicate,
        subjectIri: 'https://om.example.com/entity/glossaryTerm/source-id',
      },
    });
  });

  it('keeps a trailing slash on the base URI and reports no rules', async () => {
    mockFetchRdfConfig.mockResolvedValue(
      rdfStatus({ baseUri: 'https://om.example.com/' })
    );
    mockExplain.mockResolvedValue(
      explanation({ explanations: [], inferred: false })
    );
    renderPanel();

    load();

    expect(await screen.findByText('label.rule-plural: 0')).toBeInTheDocument();
    expect(screen.getByText('label.inference: label.no')).toBeInTheDocument();
    expect(screen.getByText('label.no-data')).toBeInTheDocument();
    expect(mockExplain).toHaveBeenCalledWith(
      expect.objectContaining({
        statement: expect.objectContaining({
          subjectIri: 'https://om.example.com/entity/glossaryTerm/source-id',
        }),
      })
    );
  });

  it('clears a loaded explanation when the edge changes', async () => {
    mockFetchRdfConfig.mockResolvedValue(rdfStatus());
    mockExplain.mockResolvedValue(explanation());
    const { rerender } = renderPanel();

    load();
    await screen.findByText('label.rule-plural: 2');

    rerender(
      <OntologyInferenceExplanationPanel
        edge={{ ...edge, from: 'target-id', to: 'source-id' }}
        nodes={nodes}
        relationshipTypes={[relationshipType]}
      />
    );

    expect(screen.queryByText('label.rule-plural: 2')).not.toBeInTheDocument();
  });

  it('toasts when loading fails', async () => {
    mockFetchRdfConfig.mockRejectedValue(new Error('boom'));
    renderPanel();

    load();

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );
  });
});

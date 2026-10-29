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
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  CONCEPT_NODE_TYPE,
  ISOLATED_CONCEPT_NODE_TYPE,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { OntologyGraphData } from '../../../OntologyExplorer/OntologyExplorer.interface';
import AllOntologiesGraphView from './AllOntologiesGraphView';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: jest.fn().mockReturnValue({ canEditAll: false }),
  })
);

jest.mock('../../../OntologyExplorer/OntologyGraphG6', () => ({
  __esModule: true,
  default: () => <div data-testid="graph-canvas" />,
}));

const concept = (
  id: string,
  label: string,
  glossaryId: string,
  group: string,
  isIsolated = false
) => ({
  id,
  label,
  glossaryId,
  group,
  type: isIsolated ? ISOLATED_CONCEPT_NODE_TYPE : CONCEPT_NODE_TYPE,
});

const graph: OntologyGraphData = {
  nodes: [
    concept('p', 'Patient', 'fhir', 'FHIR'),
    concept('r', 'Record', 'fhir', 'FHIR'),
    concept('e', 'Employee', 'hr', 'HR', true),
  ],
  edges: [
    {
      from: 'p',
      to: 'r',
      label: 'broader',
      relationType: 'broader',
      edgeKind: 'ontology',
    },
  ],
};

const renderTree = () =>
  render(
    <AllOntologiesGraphView
      graph={graph}
      isFetching={false}
      models={[]}
      surface="tree"
      onEditConcept={jest.fn()}
      onRefresh={jest.fn()}
      onSelectedConceptChange={jest.fn()}
    />
  );

describe('AllOntologiesGraphView tree', () => {
  afterEach(() => {
    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it.each([false, true])(
    'names every ontology, including one with only unconnected concepts (AI mode: %s)',
    (isAiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);
      renderTree();

      expect(screen.getAllByText('FHIR').length).toBeGreaterThan(0);
      expect(screen.getByText('HR')).toBeInTheDocument();
      expect(screen.getAllByText('Employee').length).toBeGreaterThan(0);
    }
  );
});

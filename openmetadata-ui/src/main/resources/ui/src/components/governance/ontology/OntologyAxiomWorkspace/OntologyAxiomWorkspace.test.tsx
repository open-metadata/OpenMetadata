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
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  AxiomType,
  OntologyAxiom,
  Provenance,
} from '../../../../generated/entity/data/ontologyAxiom';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../../generated/entity/data/ontologyConcept';
import { getOntologyWorkingValidation } from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyAxiomWorkspace from './OntologyAxiomWorkspace';

const concept = (id: string): OntologyConcept =>
  ({
    id,
    name: id,
    displayName: `${id} Record`,
    iri: `https://x.org/fhir/${id}`,
    conceptType: OntologyConceptType.SkosConcept,
  } as OntologyConcept);

const axiom = (id: string, provenance: Provenance): OntologyAxiom =>
  ({
    id,
    name: id,
    axiomType: AxiomType.ObjectPropertyAssertion,
    subjectIri: 'https://x.org/fhir/Patient',
    propertyIri: 'http://www.w3.org/2004/02/skos/core#broader',
    targetIri: 'https://x.org/fhir/Clinical',
    expressions: [],
    provenance,
  } as unknown as OntologyAxiom);

const disjoint = {
  id: 'rule',
  name: 'rule',
  axiomType: AxiomType.DisjointWith,
  subjectIri: 'https://x.org/fhir/Patient',
  expressions: [
    { kind: 'NAMED_CLASS', classIri: 'https://x.org/fhir/Clinical' },
  ],
  provenance: Provenance.Manual,
  description: '',
} as unknown as OntologyAxiom;

const mockModel = {
  concepts: [concept('Patient'), concept('Clinical')],
  properties: [],
  axioms: [
    axiom('imported', Provenance.Imported),
    axiom('manual', Provenance.Manual),
    disjoint,
    {
      ...axiom('unrelated', Provenance.Manual),
      subjectIri: 'https://x.org/fhir/Unknown',
    },
  ],
};

const clash = {
  code: 'DISJOINT_CLASH',
  message: 'Patient is disjoint with its ancestor Clinical',
  conceptIds: ['Patient', 'Clinical'],
};

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioModel',
  () => ({
    useOntologyStudioModel: () => ({
      model: mockModel,
      relations: [],
      isError: false,
      refetch: jest.fn(),
    }),
  })
);
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: { ontologyAxiom: { Create: true } },
  }),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => ({
      isLoading: false,
      hasViewAccess: true,
      canEditAll: true,
      canDelete: false,
    }),
  })
);
jest.mock('../../../../rest/ontologyAPI', () => ({
  getOntologyWorkingValidation: jest.fn(),
  restoreOntologyDefinition: jest.fn(),
}));
jest.mock(
  '../OntologyAxiomEditor/OntologyAxiomEditor',
  () =>
    ({ onSaved }: { onSaved?: (axiom: unknown) => void }) =>
      (
        <button
          data-testid="axiom-editor"
          onClick={() => onSaved?.({ id: 'new', name: 'new' })}>
          save
        </button>
      )
);

const ontology = { id: 'o', name: 'fhir' } as Ontology;

describe('OntologyAxiomWorkspace', () => {
  beforeEach(() => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      violations: [],
    });
  });

  it('reads each constraint as a sentence with names, not IRIs', async () => {
    renderWithQueryClient(<OntologyAxiomWorkspace ontology={ontology} />);

    const [, first, , rule] = await screen.findAllByRole('row');

    expect(first).toHaveTextContent(
      'Patient Record → broader → Clinical Record'
    );
    expect(first).toHaveTextContent('label.imported-from-rdf');
    expect(first).not.toHaveTextContent('https://');
    expect(rule).toHaveTextContent(
      'Patient Record label.can-never-also-be-lowercase Clinical Record'
    );
    expect(rule).toHaveTextContent('label.created-by-user');
    expect(rule).toHaveTextContent('—');
    expect(
      screen.queryByRole('columnheader', { name: 'label.name' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-definition-summary')).toHaveTextContent(
      'label.n-of-m'
    );
  });

  it('opens the constraint subject on the graph', async () => {
    const onOpenConcept = jest.fn();
    renderWithQueryClient(
      <OntologyAxiomWorkspace
        ontology={ontology}
        onOpenConcept={onOpenConcept}
      />
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'label.show-on-graph' }))[0]
    );

    expect(onOpenConcept).toHaveBeenCalledWith('Patient');
  });

  it('marks every constraint valid once a clean run answers', async () => {
    renderWithQueryClient(<OntologyAxiomWorkspace ontology={ontology} />);

    await waitFor(() =>
      screen
        .getAllByTestId('ontology-constraint-status')
        .forEach((cell) => expect(cell).toHaveTextContent('label.valid'))
    );

    expect(getOntologyWorkingValidation).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId('ontology-constraint-expand')
    ).not.toBeInTheDocument();
  });

  it('re-runs validation after a constraint is saved, so the result never goes stale', async () => {
    renderWithQueryClient(<OntologyAxiomWorkspace ontology={ontology} />);
    await waitFor(() =>
      screen
        .getAllByTestId('ontology-constraint-status')
        .forEach((cell) => expect(cell).toHaveTextContent('label.valid'))
    );

    fireEvent.click(screen.getByTestId('ontology-add-axiom'));
    fireEvent.click(await screen.findByTestId('axiom-editor'));

    await waitFor(() =>
      expect(getOntologyWorkingValidation).toHaveBeenCalledTimes(2)
    );
  });

  describe('with a clash', () => {
    beforeEach(() => {
      (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
        valid: false,
        violations: [clash],
      });
    });

    it('marks the clashing relationships and rule as conflicts', async () => {
      renderWithQueryClient(<OntologyAxiomWorkspace ontology={ontology} />);

      await waitFor(() =>
        expect(
          screen.getAllByTestId('ontology-constraint-expand')
        ).toHaveLength(3)
      );

      expect(
        screen
          .getAllByTestId('ontology-constraint-status')
          .map((cell) => cell.textContent)
      ).toEqual([
        'label.conflict',
        'label.conflict',
        'label.conflict',
        'label.valid',
      ]);

      expect(
        screen.getByTestId('ontology-constraints-conflicts-banner')
      ).toHaveTextContent('message.ontology-conflicts-need-resolving');
    });

    it('explains a clash and opens the rule and the relationship', async () => {
      const onOpenConcept = jest.fn();
      renderWithQueryClient(
        <OntologyAxiomWorkspace
          ontology={ontology}
          onOpenConcept={onOpenConcept}
        />
      );

      fireEvent.click(
        (await screen.findAllByTestId('ontology-constraint-expand'))[0]
      );
      const detail = screen.getByTestId('ontology-constraint-conflict-detail');

      expect(detail).toHaveTextContent(
        'message.ontology-constraint-clashes-with'
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'label.open-the-relationship' })
      );

      expect(onOpenConcept).toHaveBeenCalledWith('Patient');

      fireEvent.click(
        screen.getByRole('button', { name: 'label.open-the-rule' })
      );

      expect(await screen.findByTestId('axiom-editor')).toBeInTheDocument();
    });

    it('opens filtered to conflicts when asked', async () => {
      renderWithQueryClient(
        <OntologyAxiomWorkspace initialStatus="conflict" ontology={ontology} />
      );

      await waitFor(() =>
        expect(
          screen.queryAllByTestId('ontology-constraint-status')
        ).toHaveLength(3)
      );
    });

    it('announces the conflicts in a banner that shows, opens and dismisses them', async () => {
      renderWithQueryClient(<OntologyAxiomWorkspace ontology={ontology} />);
      const banner = await screen.findByTestId(
        'ontology-constraints-conflicts-banner'
      );

      expect(screen.getAllByTestId('ontology-constraint-status')).toHaveLength(
        4
      );

      fireEvent.click(
        within(banner).getByTestId('ontology-constraints-conflicts-show')
      );

      expect(screen.getAllByTestId('ontology-constraint-status')).toHaveLength(
        3
      );
      expect(
        screen.queryByTestId('ontology-constraint-conflict-detail')
      ).not.toBeInTheDocument();

      fireEvent.click(
        within(banner).getByTestId('ontology-constraints-conflicts-resolve')
      );

      expect(
        screen.getAllByTestId('ontology-constraint-conflict-detail')
      ).toHaveLength(3);

      fireEvent.click(within(banner).getByRole('button', { name: /close/i }));

      expect(
        screen.queryByTestId('ontology-constraints-conflicts-banner')
      ).not.toBeInTheDocument();
    });
  });
});

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
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  ChangeType,
  MemberKind,
} from '../../../../generated/api/data/ontologyWorkingDiff';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { ONTOLOGY_WORKING_DIFF_QUERY_KEY } from '../../../../hooks/governance/ontology/useOntologyPublication';
import {
  getOntologyWorkingDiff,
  getOntologyWorkingValidation,
} from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyOverview from './OntologyOverview';

const mockModel = {
  axioms: [
    {
      id: 'a-1',
      axiomType: 'DISJOINT_WITH',
      subjectIri: 'urn:x:Medication',
      expressions: [{ kind: 'NAMED_CLASS', classIri: 'urn:x:Clinical' }],
    },
    {
      id: 'a-2',
      axiomType: 'SUBCLASS_OF',
      subjectIri: 'urn:x:Other',
      expressions: [],
      updatedAt: Number.MAX_SAFE_INTEGER,
    },
  ],
  concepts: [
    { id: 'med', iri: 'urn:x:Medication' },
    { id: 'clin', iri: 'urn:x:Clinical' },
  ],
  properties: [],
};

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioModel',
  () => ({
    useOntologyStudioModel: () => ({
      graph: { nodes: [], edges: [] },
      isError: false,
      isLoading: false,
      model: mockModel,
      relations: [],
    }),
  })
);

jest.mock('../../../../rest/ontologyAPI', () => ({
  getOntologyWorkingDiff: jest.fn(),
  getOntologyWorkingValidation: jest.fn(),
}));

const ontology = {
  id: 'o-1',
  name: 'Clinical',
  fullyQualifiedName: 'Clinical',
} as Ontology;

describe('OntologyOverview validation', () => {
  it('reports a failed validation as an error, never as a clean draft', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockRejectedValue(
      new Error('500')
    );
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      await screen.findByText('server.unexpected-error')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.ontology-validate-all-clean')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('message.ontology-overview-in-conflict')
    ).not.toBeInTheDocument();
  });

  it('says it is still validating until the run answers', () => {
    (getOntologyWorkingValidation as jest.Mock).mockReturnValue(
      new Promise(() => undefined)
    );
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      screen.getByTestId('ontology-overview-validation-message')
    ).toHaveTextContent('label.validating-ellipsis');
  });

  it('reads clean only once validation found no conflicts', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      violations: [],
    });
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      await screen.findByText('message.ontology-validate-all-clean')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.ontology-overview-in-conflict')
    ).toBeInTheDocument();
  });
});

describe('OntologyOverview validation breakdown', () => {
  it('counts constraints as valid, not checked and in conflict, and reviews the conflicts', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      valid: false,
      violations: [{ code: 'DISJOINT_CLASH', conceptIds: ['med', 'clin'] }],
    });
    const onOpenTab = jest.fn();
    renderWithQueryClient(
      <OntologyOverview ontology={ontology} onOpenTab={onOpenTab} />
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-overview-validation-conflict')
      ).toHaveTextContent('1label.in-conflict-lowercase')
    );

    expect(
      screen.getByTestId('ontology-overview-validation-not-checked')
    ).toHaveTextContent('1label.not-checked-lowercase');
    expect(
      screen.getByTestId('ontology-overview-validation-valid')
    ).toHaveTextContent('0label.valid-lowercase');

    fireEvent.click(screen.getByTestId('ontology-overview-review-conflicts'));

    expect(onOpenTab).toHaveBeenCalledWith('axiom', 'conflict');
  });

  it('counts every constraint as not checked until a run answers', () => {
    (getOntologyWorkingValidation as jest.Mock).mockReturnValue(
      new Promise(() => undefined)
    );
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      screen.getByTestId('ontology-overview-validation-not-checked')
    ).toHaveTextContent('2');
  });
});

describe('OntologyOverview recent changes', () => {
  beforeEach(() => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      violations: [],
    });
  });

  it('lists the newest unpublished changes and opens Review & publish', async () => {
    const onOpenPublication = jest.fn();
    (getOntologyWorkingDiff as jest.Mock).mockResolvedValue({
      data: [
        {
          changeType: ChangeType.Added,
          memberKind: MemberKind.Concept,
          entity: { id: 'c1', type: 'ontologyConcept', name: 'Nurse' },
        },
      ],
      paging: { total: 7 },
    });
    renderWithQueryClient(
      <OntologyOverview
        ontology={ontology}
        onOpenPublication={onOpenPublication}
      />
    );

    const card = await screen.findByTestId('ontology-overview-recent-changes');

    expect(card).toHaveTextContent('message.ontology-n-unpublished');
    expect(screen.getByTestId('ontology-overview-change')).toHaveTextContent(
      /label\.concept.*Nurse.*label\.added/
    );
    expect(getOntologyWorkingDiff).toHaveBeenCalledWith(
      ontology.id,
      { limit: 5 },
      expect.anything()
    );

    fireEvent.click(screen.getByTestId('ontology-overview-review-publish'));

    expect(onOpenPublication).toHaveBeenCalled();
  });

  it('leaves the card out when the page cannot open Review & publish', async () => {
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      await screen.findByText('message.ontology-validate-all-clean')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-overview-recent-changes')
    ).not.toBeInTheDocument();
    expect(getOntologyWorkingDiff).not.toHaveBeenCalled();
  });

  it('refetches the changes when a publish refreshes the working diff', async () => {
    (getOntologyWorkingDiff as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    const { queryClient } = renderWithQueryClient(
      <OntologyOverview ontology={ontology} onOpenPublication={jest.fn()} />
    );
    await screen.findByTestId('ontology-overview-recent-changes');

    expect(getOntologyWorkingDiff).toHaveBeenCalledTimes(1);

    await act(() =>
      queryClient.invalidateQueries({
        queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, ontology.id],
      })
    );

    expect(getOntologyWorkingDiff).toHaveBeenCalledTimes(2);
  });

  it('colours each change by its kind', async () => {
    (getOntologyWorkingDiff as jest.Mock).mockResolvedValue({
      data: [
        {
          changeType: ChangeType.Added,
          memberKind: MemberKind.Axiom,
          entity: { id: 'a1', type: 'ontologyAxiom', name: 'Rule one' },
        },
      ],
      paging: { total: 1 },
    });
    renderWithQueryClient(
      <OntologyOverview ontology={ontology} onOpenPublication={jest.fn()} />
    );

    const badge = await screen.findByText('label.rule');

    expect(badge.parentElement?.className).toContain('orange');
  });
});

describe('OntologyOverview details', () => {
  beforeEach(() => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      violations: [],
    });
  });

  it('lists version, namespace and people when shown on its own', async () => {
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      await screen.findByTestId('ontology-overview-namespace')
    ).toBeInTheDocument();
  });

  it('leaves the details to Settings inside the Ontology tabs', async () => {
    renderWithQueryClient(
      <OntologyOverview ontology={ontology} onOpenTab={jest.fn()} />
    );

    expect(
      await screen.findByText('message.ontology-validate-all-clean')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-overview-namespace')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('message.ontology-overview-read-only')
    ).not.toBeInTheDocument();
  });
});

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
import { Glossary } from '../../../../generated/entity/data/glossary';
import { Ontology, Stage } from '../../../../generated/entity/data/ontology';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  deleteOntology,
  listOntologyConcepts,
  listOntologyReleases,
} from '../../../../rest/ontologyAPI';
import { getEntityPermissionById } from '../../../../rest/permissionAPI';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyStudioScopeMenu from './OntologyStudioScopeMenu';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioScopes',
  () => ({
    ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY: 'ontology-studio-ontologies',
    useOntologyConceptCounts: jest
      .fn()
      .mockReturnValue({ 'ont-1': 8, 'ont-2': 1 }),
  })
);
jest.mock('../../../../rest/permissionAPI', () => ({
  getEntityPermissionById: jest.fn(),
}));
jest.mock('../../../../rest/ontologyAPI', () => ({
  deleteOntology: jest.fn(),
  listOntologyConcepts: jest.fn(),
  listOntologyReleases: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const grant = (...operations: string[]) =>
  (getEntityPermissionById as jest.Mock).mockResolvedValue({
    resource: 'ontology',
    permissions: operations.map((operation) => ({
      operation,
      access: 'allow',
    })),
  });

const ontology = {
  id: 'ont-1',
  name: 'HL7',
  displayName: 'HL7 FHIR Starter',
  fullyQualifiedName: 'HL7',
} as Ontology;
const second = {
  id: 'ont-2',
  name: 'sales',
  displayName: 'Sales Model',
  fullyQualifiedName: 'sales',
} as Ontology;
const glossary = {
  id: 'glossary-1',
  name: 'Business',
  termCount: 4,
} as Glossary;

const renderMenu = (
  props: Partial<Parameters<typeof OntologyStudioScopeMenu>[0]> = {}
) => {
  const handlers = {
    onScopeChange: jest.fn(),
    onCreateOntology: jest.fn(),
    onRetry: jest.fn(),
    onOpenSettings: jest.fn(),
    onOntologyDeleted: jest.fn(),
  };
  const { queryClient } = renderWithQueryClient(
    <OntologyStudioScopeMenu
      glossaries={[glossary]}
      label="All ontologies"
      ontologies={[ontology, second]}
      scope={{ kind: 'allOntologies' }}
      {...handlers}
      {...props}
    />
  );
  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));

  return { ...handlers, queryClient };
};

const openDeleteDialog = async (ontologyId: string) => {
  fireEvent.click(
    await screen.findByTestId(`ontology-scope-actions-${ontologyId}`)
  );
  const remove = await screen.findByTestId(
    `ontology-scope-delete-${ontologyId}`
  );
  await waitFor(() => expect(remove).not.toHaveAttribute('aria-disabled'));
  fireEvent.click(remove);

  return screen.findByTestId('ontology-delete-dialog');
};

beforeEach(() => {
  jest.clearAllMocks();
  grant();
});

it('dispatches Edit, Create and Retry once without selecting a synthetic scope', async () => {
  const onEditOntology = jest.fn(),
    onCreateOntology = jest.fn(),
    onRetry = jest.fn(),
    onScopeChange = jest.fn();
  renderWithQueryClient(
    <OntologyStudioScopeMenu
      isError
      glossaries={[]}
      label="Sales"
      ontologies={[]}
      scope={{ kind: 'allOntologies' }}
      onCreateOntology={onCreateOntology}
      onEditOntology={onEditOntology}
      onRetry={onRetry}
      onScopeChange={onScopeChange}
    />
  );
  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
  fireEvent.click(await screen.findByTestId('ontology-edit-ontology'));

  expect(onEditOntology).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
  fireEvent.click(await screen.findByTestId('ontology-create'));

  expect(onCreateOntology).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
  fireEvent.click(await screen.findByText('label.retry'));

  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onScopeChange).not.toHaveBeenCalled();
});

describe.each([
  ['classic', false],
  ['AI', true],
])('OntologyStudioScopeMenu in %s mode', (_name, isAi) => {
  beforeEach(() => {
    (useIsAiMode as jest.Mock).mockReturnValue(isAi);
  });

  afterEach(() => {
    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('lists ontologies with concept counts and selects a scope', async () => {
    const { onScopeChange } = renderMenu();

    expect(
      await screen.findByTestId('ontology-scope-all-ontologies')
    ).toHaveTextContent('2 label.ontology-plural');
    expect(screen.getAllByText('message.native-concept-count')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('ontology-scope-ont-1'));

    expect(onScopeChange).toHaveBeenCalledWith({
      kind: 'ontology',
      ontologyId: 'ont-1',
    });
  });

  it('separates the scope label from its count in the accessible name', async () => {
    renderMenu();

    const row = await screen.findByTestId('ontology-scope-all-ontologies');

    expect(
      within(row).getByTestId('ontology-scope-all-ontologies-label')
    ).toHaveTextContent(/^label\.all-entity$/);
    expect(row).toHaveAccessibleName(
      'label.all-entity, 2 label.ontology-plural'
    );
  });

  it('filters the list as the user types and says when nothing matches', async () => {
    renderMenu();
    const search = await screen.findByTestId('ontology-scope-search');

    fireEvent.change(search, { target: { value: 'sal' } });

    expect(screen.getByTestId('ontology-scope-ont-2')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-scope-ont-1')
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz' } });

    expect(screen.getByTestId('ontology-scope-no-match')).toHaveTextContent(
      'message.ontology-picker-no-match'
    );
  });

  it('keeps the new ontology, glossary, loading and retry entries', async () => {
    const { onCreateOntology, onRetry } = renderMenu({
      isError: true,
      isLoading: true,
      scope: { kind: 'glossaries' },
    });

    expect(await screen.findByText('label.loading')).toBeInTheDocument();
    expect(
      screen.getByTestId('ontology-scope-all-glossaries')
    ).toBeInTheDocument();
    expect(screen.getByTestId('glossary-1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.retry'));

    expect(onRetry).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(await screen.findByTestId('ontology-create'));

    expect(onCreateOntology).toHaveBeenCalled();
  });

  it('opens Settings from the row menu when the user can edit the ontology', async () => {
    grant('EditAll', 'Delete');
    const { onOpenSettings } = renderMenu();
    fireEvent.click(await screen.findByTestId('ontology-scope-actions-ont-1'));
    const settings = await screen.findByTestId('ontology-scope-settings-ont-1');
    await waitFor(() => expect(settings).not.toHaveAttribute('aria-disabled'));

    fireEvent.click(settings);

    expect(onOpenSettings).toHaveBeenCalledWith(ontology);
  });

  it('disables Settings and Delete for a user with neither permission', async () => {
    grant('ViewAll');
    renderMenu();
    fireEvent.click(await screen.findByTestId('ontology-scope-actions-ont-1'));

    expect(
      await screen.findByTestId('ontology-scope-settings-ont-1')
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('ontology-scope-delete-ont-1')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('deletes an ontology only after its name is typed, naming the counts', async () => {
    grant('EditAll', 'Delete');
    (listOntologyConcepts as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 12 },
    });
    (listOntologyReleases as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 3 },
    });
    (deleteOntology as jest.Mock).mockResolvedValue(undefined);
    const { onOntologyDeleted } = renderMenu();
    fireEvent.click(await screen.findByTestId('ontology-scope-actions-ont-1'));
    const remove = await screen.findByTestId('ontology-scope-delete-ont-1');
    await waitFor(() => expect(remove).not.toHaveAttribute('aria-disabled'));
    fireEvent.click(remove);

    const dialog = await screen.findByTestId('ontology-delete-dialog');

    expect(
      await within(dialog).findByText('label.concept-plural: 12')
    ).toBeVisible();
    expect(within(dialog).getByText('label.release-plural: 3')).toBeVisible();

    const confirm = screen.getByTestId('ontology-delete-confirm');

    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('ontology-delete-confirm-name'), {
      target: { value: 'HL7' },
    });

    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('ontology-delete-confirm-name'), {
      target: { value: 'HL7 FHIR Starter' },
    });

    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);

    await waitFor(() =>
      expect(onOntologyDeleted).toHaveBeenCalledWith(ontology)
    );

    expect(deleteOntology).toHaveBeenCalledWith('ont-1');
    expect(
      screen.queryByTestId('ontology-delete-dialog')
    ).not.toBeInTheDocument();
  });

  it('refreshes the review queues, since archiving withdraws the open review', async () => {
    grant('EditAll', 'Delete');
    (listOntologyConcepts as jest.Mock).mockResolvedValue({
      paging: { total: 0 },
    });
    (listOntologyReleases as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 1 },
    });
    (deleteOntology as jest.Mock).mockResolvedValue(undefined);
    const { onOntologyDeleted, queryClient } = renderMenu();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    await openDeleteDialog('ont-1');
    fireEvent.change(screen.getByTestId('ontology-delete-confirm-name'), {
      target: { value: 'HL7 FHIR Starter' },
    });
    fireEvent.click(screen.getByTestId('ontology-delete-confirm'));

    await waitFor(() => expect(onOntologyDeleted).toHaveBeenCalled());

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['ontology-review-queues'],
    });
  });

  it('warns that an open review is withdrawn only for an ontology in review', async () => {
    grant('EditAll', 'Delete');
    (listOntologyConcepts as jest.Mock).mockResolvedValue({
      paging: { total: 0 },
    });
    (listOntologyReleases as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 1 },
    });
    renderMenu({
      ontologies: [
        {
          ...ontology,
          publicationStatus: {
            latest: { stage: Stage.InReview },
          },
        } as Ontology,
        second,
      ],
    });

    const dialog = await openDeleteDialog('ont-1');

    expect(
      within(dialog).getByTestId('ontology-delete-withdraws-review')
    ).toHaveTextContent('message.ontology-delete-withdraws-review');

    fireEvent.click(screen.getByTestId('ontology-delete-cancel'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-delete-dialog')
      ).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));

    expect(
      within(await openDeleteDialog('ont-2')).queryByTestId(
        'ontology-delete-withdraws-review'
      )
    ).not.toBeInTheDocument();
  });

  it('keeps the dialog open and the ontology when the server refuses the delete', async () => {
    grant('EditAll', 'Delete');
    (listOntologyConcepts as jest.Mock).mockResolvedValue({
      paging: { total: 0 },
    });
    (listOntologyReleases as jest.Mock).mockResolvedValue({
      paging: { total: 0 },
    });
    (deleteOntology as jest.Mock).mockRejectedValue(new Error('forbidden'));
    const { onOntologyDeleted } = renderMenu();
    fireEvent.click(await screen.findByTestId('ontology-scope-actions-ont-1'));
    const remove = await screen.findByTestId('ontology-scope-delete-ont-1');
    await waitFor(() => expect(remove).not.toHaveAttribute('aria-disabled'));
    fireEvent.click(remove);
    await screen.findByTestId('ontology-delete-dialog');
    fireEvent.change(screen.getByTestId('ontology-delete-confirm-name'), {
      target: { value: 'HL7 FHIR Starter' },
    });
    fireEvent.click(screen.getByTestId('ontology-delete-confirm'));

    await waitFor(() =>
      expect(screen.getByTestId('ontology-delete-confirm')).toBeEnabled()
    );

    expect(onOntologyDeleted).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-delete-dialog')).toBeVisible();
  });
});

describe('concept count wording', () => {
  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  it('reads one concept in the singular and eight in the plural', async () => {
    renderMenu();

    expect(await screen.findByText('8 concepts')).toBeInTheDocument();
    expect(screen.getByText('1 concept')).toBeInTheDocument();
  });
});

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
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Layer } from '../../../../generated/api/data/createOntology';
import { ProjectionState } from '../../../../generated/api/rdf/rdfStatus';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { createOntology } from '../../../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../../../rest/rdfAPI';
import {
  flushReactQuery,
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyCreateDialog from './OntologyCreateDialog';

jest.mock('../../../../rest/ontologyAPI', () => ({
  createOntology: jest.fn(),
}));
jest.mock('../../../../rest/rdfAPI', () => ({ fetchRdfConfig: jest.fn() }));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (store: {
      currentUser: { id: string; name: string; displayName: string };
    }) => unknown
  ) =>
    selector({
      currentUser: { id: 'author', name: 'author', displayName: 'Author' },
    }),
}));

const mockCreateOntology = createOntology as jest.MockedFunction<
  typeof createOntology
>;
const mockFetchRdfConfig = fetchRdfConfig as jest.MockedFunction<
  typeof fetchRdfConfig
>;
const status = (baseUri: string) => ({
  aiEnabled: false,
  baseUri,
  enabled: true,
  inference: { availableLevels: [], defaultLevel: 'none', enabled: false },
  projectionState: ProjectionState.Ready,
  storageType: 'FUSEKI',
});

const renderDialog = async (
  ontologies: Ontology[] = [],
  isListKnown = true
) => {
  const onClose = jest.fn();
  const onCreated = jest.fn();
  renderWithQueryClient(
    <OntologyCreateDialog
      ontologies={isListKnown ? ontologies : undefined}
      onClose={onClose}
      onCreated={onCreated}
    />
  );

  await flushReactQuery();

  return { onClose, onCreated };
};
const nameInput = () => screen.getByTestId('ontology-create-name');
const createButton = () => screen.getByTestId('ontology-create-submit');
const openAdvanced = async (user: ReturnType<typeof userEvent.setup>) => {
  if (!screen.queryByTestId('ontology-create-id')) {
    await user.click(screen.getByTestId('ontology-create-advanced-toggle'));
  }
};
const advancedValue = (testId: string) =>
  (screen.getByTestId(testId) as HTMLInputElement).value;
const existing = (name: string, namespace: string, displayName?: string) =>
  ({
    id: name,
    name,
    displayName,
    fullyQualifiedName: name,
    iri: namespace.replace(/#$/, ''),
    namespace,
  } as Ontology);

runQueryNotificationsSynchronously();

beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

describe('OntologyCreateDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchRdfConfig.mockResolvedValue(status('https://open-metadata.org/'));
  });

  it('says nothing about Request review until a reviewer is chosen', async () => {
    await renderDialog();

    expect(
      screen.queryByText('message.ontology-reviewers-create-hint')
    ).not.toBeInTheDocument();
  });

  it('orders the fields display name, description, owners, reviewers, then a collapsed Advanced section', async () => {
    const user = userEvent.setup();
    await renderDialog();
    const dialog = screen.getByTestId('ontology-create-dialog');
    const labels = within(dialog)
      .getAllByTestId('form-item-label')
      .map((label) => label.textContent);

    expect(labels).toEqual(['label.owner-plural', 'label.reviewer-plural']);

    const position = (element: HTMLElement) =>
      Array.from(dialog.querySelectorAll('*')).indexOf(element);

    expect(position(nameInput())).toBeLessThan(
      position(screen.getByTestId('ontology-create-description'))
    );
    expect(
      position(screen.getByTestId('ontology-create-description'))
    ).toBeLessThan(position(screen.getByText('label.owner-plural')));
    expect(position(screen.getByText('label.owner-plural'))).toBeLessThan(
      position(screen.getByText('label.reviewer-plural'))
    );
    expect(position(screen.getByText('label.reviewer-plural'))).toBeLessThan(
      position(screen.getByTestId('ontology-create-advanced-toggle'))
    );
    expect(
      screen.getByTestId('ontology-create-advanced-toggle')
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('ontology-create-id')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('ontology-create-advanced-toggle'));

    expect(screen.getByTestId('ontology-create-id')).toBeVisible();
    expect(screen.getByTestId('ontology-create-iri')).toBeVisible();
    expect(screen.getByTestId('ontology-create-namespace')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'L1' })).toBeVisible();
  });

  it('shows the signed-in user as the owner chip', async () => {
    await renderDialog();

    expect(await screen.findByText('Author (label.you)')).toBeVisible();
  });

  it('keeps Create disabled until the display name has text', async () => {
    const user = userEvent.setup();
    await renderDialog();

    expect(createButton()).toBeDisabled();

    await user.type(nameInput(), '   ');

    expect(createButton()).toBeDisabled();

    await user.type(nameInput(), 'Finance');

    expect(createButton()).toBeEnabled();

    await user.clear(nameInput());

    expect(createButton()).toBeDisabled();
  });

  it('generates the ID, IRI and namespace from the display name and says they are locked', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    await openAdvanced(user);

    await waitFor(() =>
      expect(advancedValue('ontology-create-iri')).toBe(
        'https://open-metadata.org/onto/financec'
      )
    );

    expect(advancedValue('ontology-create-id')).toBe('finance-core');
    expect(advancedValue('ontology-create-namespace')).toBe(
      'https://open-metadata.org/onto/financec#'
    );
    expect(
      screen.getByText('message.ontology-identifiers-locked')
    ).toBeVisible();
  });

  it('gives names that differ only in digits their own prefix', async () => {
    const user = userEvent.setup();
    await renderDialog([
      existing('vf-guard-1', 'https://open-metadata.org/onto/vfguard1#'),
    ]);
    await openAdvanced(user);
    await user.type(nameInput(), 'VF Guard 2');

    expect(advancedValue('ontology-create-iri')).toBe(
      'https://open-metadata.org/onto/vfguard2'
    );
    expect(createButton()).toBeEnabled();
  });

  it('appends a number when the derived prefix is already taken', async () => {
    const user = userEvent.setup();
    await renderDialog([
      existing('vf-guard-37973', 'https://open-metadata.org/onto/vfguard3#'),
    ]);
    await openAdvanced(user);
    await user.type(nameInput(), 'VF Guard 38000');

    expect(advancedValue('ontology-create-iri')).toBe(
      'https://open-metadata.org/onto/vfguard32'
    );
    expect(advancedValue('ontology-create-namespace')).toBe(
      'https://open-metadata.org/onto/vfguard32#'
    );
    expect(createButton()).toBeEnabled();
  });

  it('falls back to onto when the name has no letters or digits', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await openAdvanced(user);
    await user.type(nameInput(), '!!!');

    expect(advancedValue('ontology-create-iri')).toBe(
      'https://open-metadata.org/onto/onto'
    );
  });

  it('follows an edited IRI and refuses one that is not absolute', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    await openAdvanced(user);
    await user.clear(screen.getByTestId('ontology-create-iri'));
    await user.type(
      screen.getByTestId('ontology-create-iri'),
      'https://example.org/fin'
    );

    expect(advancedValue('ontology-create-namespace')).toBe(
      'https://example.org/fin#'
    );
    expect(createButton()).toBeEnabled();

    await user.clear(screen.getByTestId('ontology-create-iri'));
    await user.type(screen.getByTestId('ontology-create-iri'), 'not an iri');

    expect(screen.getByText('message.invalid-concept-iri')).toBeVisible();
    expect(createButton()).toBeDisabled();
  });

  it('refuses a namespace a visible ontology already uses and says why', async () => {
    const user = userEvent.setup();
    await renderDialog([
      existing('support', 'https://open-metadata.org/onto/custom#'),
    ]);
    await user.type(nameInput(), 'Customer 360');
    await openAdvanced(user);
    await user.clear(screen.getByTestId('ontology-create-namespace'));
    await user.type(
      screen.getByTestId('ontology-create-namespace'),
      'https://open-metadata.org/onto/custom#'
    );

    expect(screen.getByText('message.ontology-namespace-in-use')).toBeVisible();
    expect(createButton()).toBeDisabled();
  });

  it('keeps Create disabled and says why while the ontology list is unknown', async () => {
    const user = userEvent.setup();
    await renderDialog([], false);
    await user.type(nameInput(), 'Customer 360');

    expect(
      screen.getByText('message.ontology-prefix-check-unavailable')
    ).toBeVisible();
    expect(createButton()).toBeDisabled();
  });

  it('says a name is taken, in any letter case, and sends nothing', async () => {
    const user = userEvent.setup();
    await renderDialog([
      existing(
        'finance-core',
        'https://open-metadata.org/onto/other#',
        'Finance Core'
      ),
    ]);
    await user.type(nameInput(), 'finance CORE');

    expect(screen.getByText('message.ontology-name-duplicate')).toBeVisible();
    expect(createButton()).toBeDisabled();

    await user.click(createButton());

    expect(mockCreateOntology).not.toHaveBeenCalled();
  });

  it('says a double quote is not allowed and sends nothing', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Finance "Core"');

    expect(
      screen.getByText('message.ontology-name-forbidden-character')
    ).toBeVisible();
    expect(createButton()).toBeDisabled();

    await user.click(createButton());

    expect(mockCreateOntology).not.toHaveBeenCalled();
  });

  it('asks for an ID when the display name has no Latin letters or digits, and accepts one', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Клиенты');

    expect(screen.getByText('message.ontology-name-id-required')).toBeVisible();
    expect(createButton()).toBeDisabled();

    await openAdvanced(user);
    await user.type(screen.getByTestId('ontology-create-id'), 'clients');

    expect(
      screen.queryByText('message.ontology-name-id-required')
    ).not.toBeInTheDocument();
    expect(createButton()).toBeEnabled();
  });

  it('says a 301 character name is too long and sends nothing', async () => {
    const user = userEvent.setup();
    await renderDialog();
    fireEvent.change(nameInput(), { target: { value: 'a'.repeat(301) } });

    expect(screen.getByText('message.ontology-name-too-long')).toBeVisible();
    expect(createButton()).toBeDisabled();

    await user.click(createButton());

    expect(mockCreateOntology).not.toHaveBeenCalled();
  });

  it('accepts a 256 character name', async () => {
    await renderDialog();
    fireEvent.change(nameInput(), { target: { value: 'a'.repeat(256) } });

    expect(
      screen.queryByText('message.ontology-name-too-long')
    ).not.toBeInTheDocument();
    expect(createButton()).toBeEnabled();
  });

  it('reads the base URI from the server and joins it with exactly one slash', async () => {
    mockFetchRdfConfig.mockResolvedValue(
      status('https://data.example.org/meta')
    );
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Sales');
    await openAdvanced(user);

    await waitFor(() =>
      expect(advancedValue('ontology-create-iri')).toBe(
        'https://data.example.org/meta/onto/sales'
      )
    );
  });

  it('creates the ontology with the generated identifiers, the current user as owner and the chosen layer', async () => {
    const created = { id: 'finance', name: 'finance-core' };
    mockCreateOntology.mockResolvedValue(created as never);
    const user = userEvent.setup();
    const { onCreated } = await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    await user.type(
      within(screen.getByTestId('ontology-create-description')).getByRole(
        'textbox'
      ),
      'Quarterly close'
    );
    await openAdvanced(user);
    await user.click(screen.getByRole('tab', { name: 'L1' }));
    await waitFor(() => expect(createButton()).toBeEnabled());

    await act(async () => {
      await user.click(createButton());
    });

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));

    expect(mockCreateOntology).toHaveBeenCalledTimes(1);
    expect(mockCreateOntology.mock.calls[0][0]).toMatchObject({
      name: 'finance-core',
      displayName: 'Finance Core',
      description: 'Quarterly close',
      iri: 'https://open-metadata.org/onto/financec',
      namespace: 'https://open-metadata.org/onto/financec#',
      layer: Layer.L1,
      owners: [{ id: 'author', type: 'user' }],
      reviewers: [],
    });
  });

  it('stays open and reports the failure when the server refuses the ontology', async () => {
    mockCreateOntology.mockRejectedValue(new Error('conflict'));
    const user = userEvent.setup();
    const { onCreated, onClose } = await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    await waitFor(() => expect(createButton()).toBeEnabled());

    await act(async () => {
      await user.click(createButton());
    });

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );

    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await waitFor(() => expect(createButton()).toBeEnabled());
  });

  it('turns a server name-pattern refusal into words, not the regular expression', async () => {
    mockCreateOntology.mockRejectedValue(
      Object.assign(new Error('bad'), {
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'query param name must match "^((?!::)[^>"]*$"' },
        },
      })
    );
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    await waitFor(() => expect(createButton()).toBeEnabled());

    await act(async () => {
      await user.click(createButton());
    });

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        'message.ontology-name-forbidden-character'
      )
    );
  });

  it('cannot create without a base URI and retries loading it', async () => {
    mockFetchRdfConfig.mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    const retry = await screen.findByRole('button', { name: 'label.retry' });

    expect(
      screen.getByText('message.ontology-base-uri-load-failed')
    ).toBeVisible();
    expect(createButton()).toBeDisabled();

    await act(async () => {
      fireEvent.click(retry);
    });

    await waitFor(() => expect(createButton()).toBeEnabled());
  });

  it('closes from Cancel', async () => {
    const user = userEvent.setup();
    const { onClose } = await renderDialog();

    await user.click(screen.getByTestId('ontology-create-cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

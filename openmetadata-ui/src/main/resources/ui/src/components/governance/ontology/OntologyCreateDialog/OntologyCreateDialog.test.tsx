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
    selector: (store: { currentUser: { id: string } }) => unknown
  ) => selector({ currentUser: { id: 'author' } }),
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

const renderDialog = async (ontologies: Ontology[] = []) => {
  const onClose = jest.fn();
  const onCreated = jest.fn();
  renderWithQueryClient(
    <OntologyCreateDialog
      ontologies={ontologies}
      onClose={onClose}
      onCreated={onCreated}
    />
  );

  await flushReactQuery();

  return { onClose, onCreated };
};
const nameInput = () => screen.getByTestId('ontology-create-name');
const prefixInput = () => screen.getByTestId('ontology-create-prefix');
const createButton = () => screen.getByTestId('ontology-create-submit');
const preview = () => screen.getByTestId('ontology-create-iri-preview');

runQueryNotificationsSynchronously();

beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

describe('OntologyCreateDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchRdfConfig.mockResolvedValue(status('https://open-metadata.org/'));
  });

  it('keeps Create disabled until the name has text', async () => {
    const user = userEvent.setup();
    await renderDialog();

    expect(preview()).toHaveTextContent('https://open-metadata.org/onto/onto#');
    expect(createButton()).toBeDisabled();

    await user.type(nameInput(), '   ');

    expect(createButton()).toBeDisabled();

    await user.type(nameInput(), 'Finance');

    expect(createButton()).toBeEnabled();

    await user.clear(nameInput());

    expect(createButton()).toBeDisabled();
  });

  it('derives the prefix from the first eight lowercase letters and previews the IRI live', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Finance Core');

    await waitFor(() =>
      expect(preview()).toHaveTextContent(
        'https://open-metadata.org/onto/financec#'
      )
    );

    expect(prefixInput()).toHaveAttribute('placeholder', 'financec');

    await user.type(nameInput(), ' 2');

    expect(preview()).toHaveTextContent(
      'https://open-metadata.org/onto/financec#'
    );
  });

  it('falls back to onto when the name has no letters', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), '2024 !');

    await waitFor(() =>
      expect(preview()).toHaveTextContent(
        'https://open-metadata.org/onto/onto#'
      )
    );

    expect(createButton()).toBeEnabled();
  });

  it('follows an edited prefix and refuses one that is not IRI safe', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    await user.type(prefixInput(), 'fin');

    await waitFor(() =>
      expect(preview()).toHaveTextContent('https://open-metadata.org/onto/fin#')
    );

    await user.type(prefixInput(), ' x');

    expect(screen.getByText('message.invalid-ontology-prefix')).toBeVisible();
    expect(createButton()).toBeDisabled();

    await user.clear(prefixInput());

    expect(preview()).toHaveTextContent(
      'https://open-metadata.org/onto/financec#'
    );
    expect(createButton()).toBeEnabled();
  });

  it('refuses a prefix whose namespace a visible ontology already uses', async () => {
    const user = userEvent.setup();
    await renderDialog([
      {
        id: 'support',
        name: 'Customer Support',
        fullyQualifiedName: 'CustomerSupport',
        iri: 'https://open-metadata.org/onto/customer',
        namespace: 'https://open-metadata.org/onto/customer#',
      },
    ]);
    await user.type(nameInput(), 'Customer 360');

    await waitFor(() =>
      expect(screen.getByText('message.ontology-prefix-in-use')).toBeVisible()
    );

    expect(createButton()).toBeDisabled();

    await user.type(prefixInput(), 'cust360');

    expect(
      screen.queryByText('message.ontology-prefix-in-use')
    ).not.toBeInTheDocument();
    expect(createButton()).toBeEnabled();
  });

  it.each(['.', '..', '.hidden', '-dash'])(
    'refuses the prefix %s that would escape or blur the onto namespace',
    async (prefix) => {
      const user = userEvent.setup();
      await renderDialog();
      await user.type(nameInput(), 'Finance Core');
      await user.type(prefixInput(), prefix);

      expect(screen.getByText('message.invalid-ontology-prefix')).toBeVisible();
      expect(createButton()).toBeDisabled();
    }
  );

  it('accepts a prefix with inner dots, hyphens and digits', async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    await user.type(prefixInput(), 'fin-2.v1');

    expect(
      screen.queryByText('message.invalid-ontology-prefix')
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

    await waitFor(() =>
      expect(preview()).toHaveTextContent(
        'https://data.example.org/meta/onto/sales#'
      )
    );
  });

  it('creates the ontology at the schema default layer and hands it back', async () => {
    const created = { id: 'finance', name: 'Finance Core' };
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
    await waitFor(() => expect(createButton()).toBeEnabled());

    await act(async () => {
      await user.click(createButton());
    });

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));

    expect(mockCreateOntology).toHaveBeenCalledTimes(1);
    expect(mockCreateOntology).toHaveBeenCalledWith({
      name: 'Finance Core',
      description: 'Quarterly close',
      iri: 'https://open-metadata.org/onto/financec',
      namespace: 'https://open-metadata.org/onto/financec#',
      layer: Layer.L3,
      owners: [{ id: 'author', type: 'user' }],
      reviewers: [],
    });
  });

  it('stays open and reports the failure when the server refuses the ontology', async () => {
    const failure = new Error('conflict');
    mockCreateOntology.mockRejectedValue(failure);
    const user = userEvent.setup();
    const { onCreated, onClose } = await renderDialog();
    await user.type(nameInput(), 'Finance Core');
    await waitFor(() => expect(createButton()).toBeEnabled());

    await act(async () => {
      await user.click(createButton());
    });

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await waitFor(() => expect(createButton()).toBeEnabled());
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

    await waitFor(() =>
      expect(preview()).toHaveTextContent(
        'https://open-metadata.org/onto/financec#'
      )
    );

    expect(createButton()).toBeEnabled();
  });

  it('closes from Cancel', async () => {
    const user = userEvent.setup();
    const { onClose } = await renderDialog();

    await user.click(screen.getByTestId('ontology-create-cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

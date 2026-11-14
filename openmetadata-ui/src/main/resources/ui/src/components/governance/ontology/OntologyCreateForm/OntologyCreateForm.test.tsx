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
import { Dialog } from '@openmetadata/ui-core-components';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Layer } from '../../../../generated/api/data/createOntology';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import APIClient from '../../../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyCreateForm from './OntologyCreateForm';
import {
  deriveOntologyId,
  derivePrefix,
  validateOntologyName,
} from './OntologyCreateForm.utils';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('../../../../rest/axiosClient', () => ({
  post: jest.fn(),
  patch: jest.fn(),
  get: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;
const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;

runQueryNotificationsSynchronously();

beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

const ontology = {
  id: 'sales',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
  version: 0.3,
  reviewers: [{ id: 'reviewer', type: 'user', name: 'Reviewer' }],
};

describe('OntologyCreateForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    post.mockResolvedValue({ data: { id: 'ontology-id', name: 'Sales' } });
    get.mockResolvedValue({ data: { hits: { hits: [] } } });
  });

  it('edits ontology metadata while preserving its identity and reviewers', async () => {
    const user = userEvent.setup();
    const saved = jest.fn();
    const patch = APIClient.patch as jest.MockedFunction<
      typeof APIClient.patch
    >;
    patch.mockResolvedValue({
      data: { ...ontology, displayName: 'Sales model' },
    });
    renderWithQueryClient(
      <OntologyCreateForm canEdit ontology={ontology} onSaved={saved} />
    );

    // Identifiers are read-only values with a copy button, not inputs.
    expect(screen.getByTestId('ontology-settings-name')).toHaveTextContent(
      'Sales'
    );
    expect(screen.getByTestId('ontology-settings-namespace')).toHaveTextContent(
      'urn:sales:'
    );
    expect(
      screen.queryByRole('textbox', { name: 'label.name' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('message.ontology-settings-owners-hint')
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: 'label.display-name' }),
      'Sales model'
    );
    fireEvent.submit(screen.getByTestId('ontology-create-form'));

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Sales model' })
      )
    );

    expect(patch).toHaveBeenCalledWith(
      '/ontologies/sales',
      expect.arrayContaining([
        { op: 'test', path: '/version', value: 0.3 },
        { op: 'add', path: '/displayName', value: 'Sales model' },
      ]),
      expect.anything()
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('prevents saving when the edit permission is denied', () => {
    renderWithQueryClient(
      <OntologyCreateForm
        canEdit={false}
        ontology={ontology}
        onSaved={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();
  });

  it('in the dialog layout saves through "Save changes", cancels, and keeps identifiers under Advanced', async () => {
    const user = userEvent.setup();
    const saved = jest.fn();
    const cancel = jest.fn();
    const patch = APIClient.patch as jest.MockedFunction<
      typeof APIClient.patch
    >;
    patch.mockResolvedValue({
      data: { ...ontology, description: 'Orders' },
    });
    renderWithQueryClient(
      <Dialog>
        <OntologyCreateForm
          canEdit
          layout="dialog"
          ontology={ontology}
          onCancel={cancel}
          onSaved={saved}
        />
      </Dialog>
    );

    expect(
      screen.queryByRole('textbox', { name: 'label.ontology-iri' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId('ontology-settings-advanced-toggle'));

    expect(
      screen.getByRole('textbox', { name: 'label.ontology-iri' })
    ).toBeDisabled();

    await user.type(
      screen.getByRole('textbox', { name: 'label.description' }),
      'Orders'
    );
    await user.click(
      screen.getByRole('button', { name: 'label.save-changes' })
    );

    await waitFor(() => expect(saved).toHaveBeenCalled());

    expect(patch).toHaveBeenCalledWith(
      '/ontologies/sales',
      expect.arrayContaining([
        { op: 'add', path: '/description', value: 'Orders' },
      ]),
      expect.anything()
    );

    await user.click(screen.getByRole('button', { name: 'label.cancel' }));

    expect(cancel).toHaveBeenCalled();
  });

  describe('AI mode', () => {
    beforeEach(() => (useIsAiMode as jest.Mock).mockReturnValue(true));

    afterEach(() => (useIsAiMode as jest.Mock).mockReturnValue(false));

    it('saves the settings rows and the segmented layer through a patch', async () => {
      const user = userEvent.setup();
      const saved = jest.fn();
      const patch = APIClient.patch as jest.MockedFunction<
        typeof APIClient.patch
      >;
      patch.mockResolvedValue({ data: { ...ontology, layer: Layer.L2 } });
      renderWithQueryClient(
        <OntologyCreateForm canEdit ontology={ontology} onSaved={saved} />
      );

      expect(screen.getByText('label.owner-plural')).toBeInTheDocument();
      expect(screen.getByText('label.reviewer-plural')).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: Layer.L2 }));
      fireEvent.submit(screen.getByTestId('ontology-create-form'));

      await waitFor(() => expect(saved).toHaveBeenCalled());

      expect(patch).toHaveBeenCalledWith(
        '/ontologies/sales',
        expect.arrayContaining([
          { op: 'replace', path: '/layer', value: Layer.L2 },
        ]),
        expect.anything()
      );
      expect(post).not.toHaveBeenCalled();
    });

    it('keeps name and IRI read-only in settings and gates save', () => {
      renderWithQueryClient(
        <OntologyCreateForm
          canEdit={false}
          ontology={{
            id: 'sales',
            name: 'Sales',
            fullyQualifiedName: 'Sales',
            iri: 'urn:sales',
            namespace: 'urn:sales:',
            layer: Layer.L2,
          }}
          onSaved={jest.fn()}
        />
      );

      expect(screen.queryByText('label.new-entity')).not.toBeInTheDocument();
      expect(screen.getByTestId('ontology-settings-iri')).toHaveTextContent(
        'urn:sales'
      );
      expect(
        screen.queryByRole('textbox', { name: 'label.ontology-iri' })
      ).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: Layer.L2 })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();
    });
  });
});

describe('create helpers', () => {
  const taken =
    (...prefixes: string[]) =>
    (prefix: string) =>
      prefixes.includes(prefix);

  it('keeps digits so names that differ only in a number get their own prefix', () => {
    expect(derivePrefix('VF Guard 1')).toBe('vfguard1');
    expect(derivePrefix('VF Guard 2')).toBe('vfguard2');
  });

  it('appends a number until the prefix is free', () => {
    expect(derivePrefix('VF Guard 37973', taken('vfguard3'))).toBe('vfguard32');
    expect(derivePrefix('VF Guard 37973', taken('vfguard3', 'vfguard32'))).toBe(
      'vfguard33'
    );
  });

  it('falls back to onto for a name with no letters or digits', () => {
    expect(derivePrefix('--!')).toBe('onto');
    expect(derivePrefix('--!', taken('onto'))).toBe('onto2');
  });

  it('derives a kebab-cased ID from the display name', () => {
    expect(deriveOntologyId('  LA ClassicMade 2 ')).toBe('la-classicmade-2');
    expect(deriveOntologyId('Café & Bar')).toBe('caf-bar');
  });

  describe('validateOntologyName', () => {
    const existing = [
      { id: '1', name: 'finance-core', displayName: 'Finance Core' },
    ] as Ontology[];

    it('refuses a name another ontology has, ignoring case', () => {
      expect(
        validateOntologyName('FINANCE CORE', 'finance-core-2', existing)
      ).toEqual({ kind: 'duplicate', name: 'FINANCE CORE' });
      expect(validateOntologyName('Other', 'FINANCE-CORE', existing)).toEqual({
        kind: 'duplicate',
        name: 'Other',
      });
    });

    it.each(['say "hi"', 'a>b', 'a::b', 'tab\there'])(
      'refuses %j as a forbidden character',
      (name) => {
        expect(validateOntologyName(name, 'ok', existing)).toEqual({
          kind: 'forbidden-character',
        });
      }
    );

    it('allows 256 characters and refuses 257', () => {
      expect(
        validateOntologyName('a'.repeat(256), 'ok', existing)
      ).toBeUndefined();
      expect(validateOntologyName('a'.repeat(257), 'ok', existing)).toEqual({
        kind: 'too-long',
        length: 257,
      });
    });

    it('accepts a fresh name', () => {
      expect(validateOntologyName('Sales', 'sales', existing)).toBeUndefined();
    });
  });
});

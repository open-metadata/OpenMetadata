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
import userEvent from '@testing-library/user-event';
import { Layer } from '../../../../generated/api/data/createOntology';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import APIClient from '../../../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyCreateForm from './OntologyCreateForm';

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

    expect(screen.getByRole('textbox', { name: 'label.name' })).toHaveValue(
      'Sales'
    );
    expect(screen.getByRole('textbox', { name: 'label.name' })).toBeDisabled();

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
      expect(
        screen.getByRole('textbox', { name: 'label.name' })
      ).toBeDisabled();
      expect(
        screen.getByRole('textbox', { name: 'label.ontology-iri' })
      ).toBeDisabled();
      expect(screen.getByRole('tab', { name: Layer.L2 })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();
    });
  });
});

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
import userEvent from '@testing-library/user-event';
import { Layer } from '../../../../generated/api/data/createOntology';
import APIClient from '../../../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyCreateForm from './OntologyCreateForm';

jest.mock('../../../../rest/axiosClient', () => ({
  post: jest.fn(),
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

describe('OntologyCreateForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    post.mockResolvedValue({ data: { id: 'ontology-id', name: 'Sales' } });
    get.mockResolvedValue({ data: { hits: { hits: [] } } });
  });

  it('requires ontology identity and assigns the creator as owner', async () => {
    const user = userEvent.setup();
    const saved = jest.fn();
    renderWithQueryClient(
      <OntologyCreateForm canCreate currentUserId="author" onSaved={saved} />
    );
    await act(async () => {
      fireEvent.submit(screen.getByTestId('ontology-create-form'));
    });

    expect(await screen.findAllByText('label.field-required')).toHaveLength(3);
    expect(post).not.toHaveBeenCalled();

    await user.type(
      screen.getByRole('textbox', { name: 'label.name' }),
      'Sales'
    );
    await user.type(
      screen.getByRole('textbox', { name: 'label.ontology-iri' }),
      'urn:sales'
    );
    await user.type(
      screen.getByRole('textbox', { name: 'label.namespace' }),
      'urn:sales:'
    );
    await act(async () => {
      fireEvent.submit(screen.getByTestId('ontology-create-form'));
    });

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith({ id: 'ontology-id', name: 'Sales' })
    );

    expect(post).toHaveBeenCalledWith(
      '/ontologies',
      expect.objectContaining({
        name: 'Sales',
        iri: 'urn:sales',
        namespace: 'urn:sales:',
        layer: Layer.L1,
        owners: [{ id: 'author', type: 'user' }],
        reviewers: [],
      })
    );
  });

  it('keeps invalid namespace input visible without writing', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <OntologyCreateForm
        canCreate
        currentUserId="author"
        onSaved={jest.fn()}
      />
    );
    await user.type(
      screen.getByRole('textbox', { name: 'label.name' }),
      'Sales'
    );
    await user.type(
      screen.getByRole('textbox', { name: 'label.ontology-iri' }),
      'urn:sales'
    );
    await user.type(
      screen.getByRole('textbox', { name: 'label.namespace' }),
      'relative/path'
    );
    await act(async () => {
      fireEvent.submit(screen.getByTestId('ontology-create-form'));
    });

    expect(
      await screen.findByText('message.invalid-concept-iri')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'label.namespace' })
    ).toHaveValue('relative/path');
    expect(post).not.toHaveBeenCalled();
  });

  it('prevents creation when the permission is denied', () => {
    renderWithQueryClient(
      <OntologyCreateForm canCreate={false} onSaved={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();
  });
});

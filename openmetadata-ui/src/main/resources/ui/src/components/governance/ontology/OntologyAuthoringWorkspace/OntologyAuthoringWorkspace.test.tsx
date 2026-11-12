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
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { Access } from '../../../../generated/entity/policies/accessControl/resourcePermission';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import APIClient from '../../../../rest/axiosClient';
import {
  flushReactQuery,
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import { humanizeName } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import OntologyAuthoringWorkspace from './OntologyAuthoringWorkspace';

let mockPermissions = {
  ontology: { Create: true },
  ontologyConcept: { Create: true },
  ontologyProperty: { Create: true },
  ontologyChangeSet: { Create: true },
};

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;

const ontology: Ontology = {
  id: 'ontology-id',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const concept = {
  id: 'concept-id',
  name: 'Customer',
  fullyQualifiedName: 'Sales.Customer',
  ontology: { id: ontology.id, type: 'ontology' },
  conceptType: OntologyConceptType.OwlClass,
  iri: 'urn:sales:customer',
  version: 0.1,
};

runQueryNotificationsSynchronously();

beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

describe('OntologyAuthoringWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = {
      ontology: { Create: true },
      ontologyConcept: { Create: true },
      ontologyProperty: { Create: true },
      ontologyChangeSet: { Create: true },
    };
    get.mockImplementation(async (path) => {
      if (path === '/ontologies') {
        return { data: { data: [ontology], paging: { total: 1 } } };
      }
      if (path === '/ontologyConcepts') {
        return { data: { data: [concept], paging: { total: 1 } } };
      }
      if (path === '/ontologyAxioms' || path?.startsWith('/ontologyAxioms')) {
        return { data: { data: [], paging: { total: 0 } } };
      }
      if (path === '/ontologyProperties') {
        return { data: { data: [], paging: { total: 0 } } };
      }
      if (path?.startsWith('/permissions/')) {
        return {
          data: {
            permissions: [
              { operation: 'ViewAll', access: Access.Allow },
              { operation: 'EditAll', access: Access.Allow },
            ],
          },
        };
      }

      throw new Error('Unexpected request: ' + path);
    });
  });

  it('browses and authors native concepts without a glossary request', async () => {
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
    await flushReactQuery();

    expect(
      await screen.findByRole('button', { name: 'Customer' })
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
    });

    expect(
      await screen.findByRole('textbox', { name: 'label.concept-iri' })
    ).toHaveValue(concept.iri);
    expect(screen.getByRole('button', { name: 'label.save' })).toBeEnabled();
    expect(get).toHaveBeenCalledWith(
      '/ontologyConcepts',
      expect.objectContaining({
        params: expect.objectContaining({ ontology: 'Sales', limit: 25 }),
      })
    );
    expect(get.mock.calls.some(([path]) => path?.includes('glossar'))).toBe(
      false
    );
  });

  it('opens the shared new-concept drawer from the Term tab and validates before any request', async () => {
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
    await flushReactQuery();
    fireEvent.click(screen.getByTestId('ontology-add-concept'));
    await flushReactQuery();

    expect(
      await screen.findByTestId('ontology-new-class-panel')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-concept-editor')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('new-class-create')).toBeDisabled();

    fireEvent.change(screen.getByTestId('new-class-local-name'), {
      target: { value: 'Spaced Name!' },
    });

    expect(
      screen.getAllByText('message.ontology-concept-name-invalid')
    ).toHaveLength(2);
    expect(screen.getByTestId('new-class-create')).toBeDisabled();
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('new-class-local-name'), {
      target: { value: 'customer' },
    });

    expect(
      screen.getAllByText('message.ontology-concept-name-taken')
    ).toHaveLength(2);
    expect(screen.getByTestId('new-class-create')).toBeDisabled();

    fireEvent.change(screen.getByTestId('new-class-local-name'), {
      target: { value: 'Account' },
    });

    expect(screen.getByTestId('new-class-create')).toBeEnabled();
    expect(screen.getByTestId('new-class-iri')).toHaveTextContent(
      'urn:sales:Account'
    );
  });

  it('creates native properties using the selected ontology and property permissions', async () => {
    post.mockResolvedValue({
      data: {
        ...concept,
        id: 'property-id',
        name: 'purchasedBy',
        kind: Kind.Object,
      },
    });
    renderWithQueryClient(
      <OntologyAuthoringWorkspace
        definitionType="property"
        ontology={ontology}
      />
    );
    await flushReactQuery();
    fireEvent.click(screen.getByTestId('ontology-add-property'));
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'purchasedBy' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    });

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/ontologyProperties',
        expect.objectContaining({
          ontology: 'Sales',
          name: 'purchasedBy',
          kind: Kind.Object,
        })
      )
    );

    expect(
      await screen.findByRole('textbox', { name: 'label.property-iri' })
    ).toHaveValue(concept.iri);
    expect(get).toHaveBeenCalledWith(
      '/permissions/ontologyProperty/property-id'
    );
  });

  it('lists relationship-backed properties under Relationships, apart from data properties', async () => {
    const property = (id: string, name: string, kind: Kind) => ({
      id,
      name,
      kind,
      fullyQualifiedName: 'Sales.' + name,
      iri: 'urn:sales:' + name,
      ontology: { id: ontology.id, type: 'ontology' },
    });
    const defaultGet = get.getMockImplementation();
    get.mockImplementation(async (path, config) => {
      if (path === '/ontologyProperties') {
        return {
          data: {
            data: [
              property('p-name', 'customerName', Kind.Data),
              property('p-broader', 'broader', Kind.Object),
              property('p-narrower', 'narrower', Kind.Object),
            ],
            paging: { total: 3 },
          },
        };
      }

      return defaultGet?.(path, config);
    });
    renderWithQueryClient(
      <OntologyAuthoringWorkspace
        definitionType="property"
        ontology={ontology}
      />
    );
    await flushReactQuery();

    const properties = await screen.findByTestId(
      'ontology-definition-group-property'
    );
    const relationships = screen.getByTestId(
      'ontology-definition-group-relationship'
    );

    expect(properties).toHaveTextContent('customerName');
    expect(properties).not.toHaveTextContent('broader');
    expect(properties).not.toHaveTextContent('narrower');
    expect(relationships).toHaveTextContent('broader');
    expect(relationships).toHaveTextContent('narrower');
    expect(relationships).not.toHaveTextContent('customerName');
  });

  it('shows a failed list with retry and hides unavailable data', async () => {
    get.mockImplementation(async (path) => {
      if (path === '/ontologies') {
        return { data: { data: [ontology], paging: { total: 1 } } };
      }

      throw new Error('Unavailable');
    });
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
    await flushReactQuery();

    expect(await screen.findByRole('alert')).toBeInTheDocument();

    get.mockResolvedValue({ data: { data: [concept], paging: { total: 1 } } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });

    expect(
      await screen.findByRole('button', { name: 'Customer' })
    ).toBeInTheDocument();
  });

  it('does not show a selected definition when its read permission is denied', async () => {
    get
      .mockResolvedValueOnce({
        data: { data: [concept], paging: { total: 1 } },
      })
      .mockResolvedValueOnce({
        data: { permissions: [{ operation: 'ViewAll', access: Access.Deny }] },
      });
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
    await flushReactQuery();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-concept-editor')
    ).not.toBeInTheDocument();
  });

  it('uses the server cursor to browse the next page', async () => {
    get
      .mockResolvedValueOnce({
        data: { data: [concept], paging: { total: 2, after: 'next-cursor' } },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ ...concept, id: 'account', name: 'Account' }],
          paging: { total: 2, before: 'previous-cursor' },
        },
      });
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
    await flushReactQuery();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.next' }));
    });

    expect(
      await screen.findByRole('button', { name: 'Account' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Customer' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.previous' })
    ).toBeEnabled();
    expect(get).toHaveBeenLastCalledWith(
      '/ontologyConcepts',
      expect.objectContaining({
        params: expect.objectContaining({
          after: 'next-cursor',
          ontology: 'Sales',
        }),
      })
    );
  });

  it('keeps create actions hidden for a reader', async () => {
    mockPermissions = {
      ontology: { Create: false },
      ontologyConcept: { Create: false },
      ontologyProperty: { Create: false },
      ontologyChangeSet: { Create: false },
    };
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);

    expect(
      screen.queryByTestId('ontology-add-ontology')
    ).not.toBeInTheDocument();

    await flushReactQuery();

    expect(
      screen.queryByTestId('ontology-add-concept')
    ).not.toBeInTheDocument();
  });

  describe('AI mode', () => {
    beforeEach(() => (useIsAiMode as jest.Mock).mockReturnValue(true));

    afterEach(() => (useIsAiMode as jest.Mock).mockReturnValue(false));

    it('lists definitions in a table and opens the editor with delete from a row', async () => {
      get.mockImplementation(async (path) => {
        if (path === '/ontologyConcepts') {
          return {
            data: {
              data: [{ ...concept, description: 'A buyer' }],
              paging: { total: 1 },
            },
          };
        }

        return {
          data: {
            permissions: [
              { operation: 'ViewAll', access: Access.Allow },
              { operation: 'EditAll', access: Access.Allow },
              { operation: 'Delete', access: Access.Allow },
            ],
          },
        };
      });
      renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
      await flushReactQuery();

      expect(await screen.findByRole('grid')).toBeInTheDocument();
      expect(
        screen.getByText(humanizeName(OntologyConceptType.OwlClass))
      ).toBeInTheDocument();
      expect(screen.getByText('A buyer')).toBeInTheDocument();
      expect(screen.getByTestId('ontology-add-concept')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
      });

      expect(
        await screen.findByRole('textbox', { name: 'label.concept-iri' })
      ).toHaveValue(concept.iri);
      expect(
        await screen.findByRole('button', { name: 'label.delete' })
      ).toBeInTheDocument();
    });

    it('pages with the server cursor from the table footer', async () => {
      get
        .mockResolvedValueOnce({
          data: { data: [concept], paging: { total: 2, after: 'next-cursor' } },
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ ...concept, id: 'account', name: 'Account' }],
            paging: { total: 2, before: 'previous-cursor' },
          },
        });
      renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
      await flushReactQuery();

      expect(
        await screen.findByRole('button', { name: 'label.previous' })
      ).toBeDisabled();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'label.next' }));
      });

      expect(
        await screen.findByRole('button', { name: 'Account' })
      ).toBeInTheDocument();
      expect(get).toHaveBeenLastCalledWith(
        '/ontologyConcepts',
        expect.objectContaining({
          params: expect.objectContaining({ after: 'next-cursor' }),
        })
      );
    });
  });
});

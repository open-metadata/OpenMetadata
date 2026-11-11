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

const allow = (operations: string[]) => ({
  data: {
    permissions: operations.map((operation) => ({
      operation,
      access: Access.Allow,
    })),
  },
});

/** Answers the model's three list calls; anything else falls through to `rest`. */
const routeLists = (
  lists: { concepts?: object[]; properties?: object[]; axioms?: object[] },
  rest: (path: string) => unknown = () => allow(['ViewAll', 'EditAll'])
) =>
  get.mockImplementation(async (path) => {
    const page = (data: object[] = []) => ({
      data: { data, paging: { total: data.length } },
    });
    if (path === '/ontologyConcepts') {
      return page(lists.concepts);
    }
    if (path === '/ontologyProperties') {
      return page(lists.properties);
    }
    if (path?.startsWith('/ontologyAxioms')) {
      return page(lists.axioms);
    }

    return rest(path as string) as never;
  });

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
        params: expect.objectContaining({ ontology: 'Sales' }),
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

  it('lists every property kind in one table and narrows it with the Kind filter', async () => {
    const property = (id: string, name: string, kind: Kind) => ({
      id,
      name,
      kind,
      fullyQualifiedName: 'Sales.' + name,
      iri: 'urn:sales:' + name,
      domain: [concept.iri],
      ontology: { id: ontology.id, type: 'ontology' },
    });
    routeLists({
      concepts: [concept],
      properties: [
        property('p-name', 'customerName', Kind.Data),
        property('p-broader', 'broader', Kind.Object),
      ],
    });
    renderWithQueryClient(
      <OntologyAuthoringWorkspace
        definitionType="property"
        ontology={ontology}
      />
    );
    await flushReactQuery();

    const table = await screen.findByTestId(
      'ontology-definition-group-property'
    );

    expect(table).toHaveTextContent('customerName');
    expect(table).toHaveTextContent('broader');
    expect(table).toHaveTextContent('Customer');

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'label.object' }));
    });

    expect(table).toHaveTextContent('broader');
    expect(table).not.toHaveTextContent('customerName');
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
    routeLists({ concepts: [concept] }, () => ({
      data: { permissions: [{ operation: 'ViewAll', access: Access.Deny }] },
    }));
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
    await flushReactQuery();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Customer' }));
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-concept-editor')
    ).not.toBeInTheDocument();
  });

  it('pages the loaded concepts 25 at a time', async () => {
    routeLists({
      concepts: Array.from({ length: 26 }, (_, index) => ({
        ...concept,
        id: `concept-${index}`,
        name: `Concept${index}`,
        iri: `urn:sales:c${index}`,
      })),
    });
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
    await flushReactQuery();

    expect(
      await screen.findByRole('button', { name: 'Concept0' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Concept25' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.previous' })
    ).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.next' }));
    });

    expect(
      screen.getByRole('button', { name: 'Concept25' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'label.next' })).toBeDisabled();
  });

  it('searches across every concept and shows the computed columns', async () => {
    routeLists({
      concepts: [
        { ...concept, description: 'A buyer' },
        {
          ...concept,
          id: 'vip',
          name: 'Vip',
          iri: 'urn:sales:vip',
          superClasses: [concept.iri],
        },
      ],
    });
    renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
    await flushReactQuery();

    const table = await screen.findByTestId(
      'ontology-definition-group-concept'
    );
    const vipRow = screen.getByRole('row', { name: /Vip/ });

    expect(vipRow).toHaveTextContent('Customer');
    expect(table).toHaveTextContent('label.class-owl');
    expect(screen.getByTestId('ontology-definition-summary')).toHaveTextContent(
      '2'
    );

    fireEvent.change(screen.getByTestId('ontology-definition-search'), {
      target: { value: 'vi' },
    });

    expect(
      screen.queryByRole('button', { name: 'Customer' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vip' })).toBeInTheDocument();
  });

  it('opens a concept on the graph when the page gives a handler', async () => {
    const onOpenConcept = jest.fn();
    routeLists({ concepts: [concept] });
    renderWithQueryClient(
      <OntologyAuthoringWorkspace
        ontology={ontology}
        onOpenConcept={onOpenConcept}
      />
    );
    await flushReactQuery();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Customer' }));
    });

    expect(onOpenConcept).toHaveBeenCalledWith(concept.id);
    expect(
      screen.queryByTestId('ontology-definition-drawer')
    ).not.toBeInTheDocument();
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
      routeLists({ concepts: [{ ...concept, description: 'A buyer' }] }, () =>
        allow(['ViewAll', 'EditAll', 'Delete'])
      );
      renderWithQueryClient(<OntologyAuthoringWorkspace ontology={ontology} />);
      await flushReactQuery();

      expect(await screen.findByRole('grid')).toBeInTheDocument();
      expect(screen.getByRole('row', { name: /Customer/ })).toHaveTextContent(
        'label.class-owl'
      );
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
  });
});

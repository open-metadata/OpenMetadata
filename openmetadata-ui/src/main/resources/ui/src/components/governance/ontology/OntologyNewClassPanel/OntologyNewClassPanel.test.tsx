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
import { toastQueue } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render as renderNode,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { useState } from 'react';
import { Link, MemoryRouter } from 'react-router-dom';
import OntologyDraftProvider from '../../../../context/OntologyDraft/OntologyDraftProvider';
import { Layer, Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import APIClient from '../../../../rest/axiosClient';
import {
  MISSING_TRANSLATION_MARKER,
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import { renderWithQueryClient as render } from '../../../../test/unit/test-utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyNewClassPanel from './OntologyNewClassPanel';
jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
const ontology: Ontology = {
  id: 'o',
  name: 'Finance',
  fullyQualifiedName: 'Finance',
  iri: 'urn:fin',
  namespace: 'https://example.org/fin#',
  layer: Layer.L2,
};
const parents = ['Payment', 'Transaction'].map((name) => ({
  id: name,
  name,
  displayName: name,
  fullyQualifiedName: 'Finance.' + name,
  iri: ontology.namespace + name,
  conceptType: OntologyConceptType.OwlClass,
  ontology: { id: 'o', type: 'ontology' },
}));
const model = { ontology, concepts: parents, properties: [], axioms: [] };
const post = APIClient.post as jest.Mock;
const get = APIClient.get as jest.Mock;
const put = APIClient.put as jest.Mock;
let retained: Record<string, unknown>;
let applied = false;

beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

const reconcile = jest.fn();
const readDraft = (url: string) => {
  if (url === '/ontologyChangeSets') {
    return { data: [], paging: {} };
  }

  return { ...retained, state: applied ? 'APPLIED' : 'DRAFT' };
};
const setup = (
  props: Partial<React.ComponentProps<typeof OntologyNewClassPanel>> = {}
) =>
  render(
    <OntologyNewClassPanel
      canCreate
      canCreateAxiom
      canCreateProperty
      model={model}
      ontology={ontology}
      onBeforeCreate={jest.fn()}
      onClose={jest.fn()}
      onCreated={reconcile}
      onUndone={jest.fn()}
      {...props}
    />
  );
const openAdvanced = () =>
  fireEvent.click(screen.getByTestId('new-class-advanced-toggle'));
const fill = (id: string, value: string) =>
  fireEvent.change(screen.getByTestId(id), { target: { value } });
const fillMappingIri = (value: string) =>
  fireEvent.change(
    within(screen.getByTestId('new-class-mapping-iri')).getByRole('combobox'),
    { target: { value } }
  );

beforeEach(() => {
  jest.clearAllMocks();
  applied = false;
  reconcile.mockResolvedValue(false);
  useApplicationStore.setState({
    currentUser: { id: 'u', name: 'editor', email: 'editor@example.org' },
  });
  get.mockImplementation(async (url: string) => {
    if (url.includes('/ontologyConcepts/name/')) {
      throw new AxiosError(
        'Not found',
        AxiosError.ERR_BAD_REQUEST,
        undefined,
        undefined,
        {
          status: 404,
        } as AxiosResponse
      );
    }

    return {
      data: url.endsWith('/state') ? { workingRevision: 7 } : readDraft(url),
    };
  });
  post.mockImplementation(
    async (url: string, body: Record<string, unknown>) => {
      if (url.endsWith('/acquire')) {
        return { data: { sessionId: 'lease', version: 1 } };
      }
      if (url.endsWith('/apply')) {
        applied = true;

        return { data: { ...retained, state: 'APPLIED' } };
      }
      retained = {
        ...body,
        id: 'draft',
        ontology: { id: 'o', type: 'ontology', fullyQualifiedName: 'Finance' },
        undoCursor: (body.operations as unknown[]).length,
      };

      return { data: { ...retained, state: 'DRAFT' } };
    }
  );
});

it('gates the name, derives IRI, preserves manual local name, read-only layer and default owner', () => {
  setup({ canCreateProperty: false, canCreateAxiom: false });
  openAdvanced();

  expect(screen.getByTestId('new-class-create')).toBeDisabled();

  fill('new-class-label', 'Funds Transfer');

  expect(screen.getByTestId('new-class-create')).toBeEnabled();
  expect(screen.getByTestId('new-class-iri')).toHaveTextContent(
    ontology.namespace + 'FundsTransfer'
  );

  fill('new-class-local-name', 'Transfer');
  fill('new-class-label', 'Another Label');

  expect(screen.getByTestId('new-class-local-name')).toHaveValue('Transfer');
  expect(screen.getByRole('textbox', { name: /label.layer/ })).toHaveAttribute(
    'readonly'
  );
  expect(screen.getByRole('textbox', { name: /label.layer/ })).toHaveValue(
    'L2 label.industry'
  );
  expect(screen.getByText(/editor.*label.you/)).toBeVisible();
});

it('commits synonyms on comma and Enter and requires two distinct enum chips', async () => {
  setup();
  openAdvanced();
  fill('new-class-synonyms', 'Wire,');
  fill('new-class-synonyms', 'Transfer');
  fireEvent.keyDown(screen.getByTestId('new-class-synonyms'), { key: 'Enter' });

  expect(screen.getByText('Wire')).toBeVisible();
  expect(screen.getByText('Transfer')).toBeVisible();

  fill('new-class-property-name', 'state');
  fireEvent.click(screen.getByRole('button', { name: /label.type/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'label.enum' }));
  fill('new-class-enum-values', 'Pending,');

  expect(screen.getByTestId('new-class-add-property')).toBeDisabled();

  fill('new-class-enum-values', 'Pending,');

  expect(screen.getByTestId('new-class-add-property')).toBeDisabled();

  fill('new-class-enum-values', 'Settled');
  fireEvent.keyDown(screen.getByTestId('new-class-enum-values'), {
    key: 'Enter',
  });

  expect(screen.getByTestId('new-class-add-property')).toBeEnabled();

  fireEvent.click(screen.getByTestId('new-class-add-property'));

  expect(screen.getByText(/state · Pending, Settled/)).toBeVisible();
});

it('retains a completed atomic plan and only retries model reconciliation after refresh failure', async () => {
  setup();
  fill('new-class-label', 'Funds Transfer');
  fill('new-class-description', 'Payment definition');
  openAdvanced();
  fill('new-class-source', 'https://example.org/source');
  fill('new-class-synonyms', 'Wire,');
  fireEvent.click(screen.getByRole('checkbox', { name: 'label.abstract' }));
  await act(async () => {
    fireEvent.click(screen.getByTestId('new-class-create'));
  });
  await waitFor(() =>
    expect(reconcile).toHaveBeenCalledWith(
      ontology.namespace + 'FundsTransfer',
      {
        keepOpen: false,
      }
    )
  );
  const creates = () =>
    post.mock.calls.filter(([url]) => url === '/ontologyChangeSets');

  expect(creates()).toHaveLength(1);

  const owners = [{ id: 'u', type: 'user', name: 'editor' }];

  expect(creates()[0][1].owners).toEqual(owners);
  expect(creates()[0][1].operations[0].concept.owners).toEqual(owners);
  expect(creates()[0][1]).toMatchObject({
    baseWorkingRevision: 7,
    operations: [
      expect.objectContaining({
        operationType: 'UPSERT_CONCEPT',
        concept: expect.objectContaining({
          abstract: true,
          synonyms: ['Wire'],
          description: 'Payment definition',
          definitionSource: 'https://example.org/source',
          owners: [expect.objectContaining({ id: 'u', type: 'user' })],
        }),
      }),
    ],
  });

  fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
  await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));

  expect(creates()).toHaveLength(1);
  expect(
    post.mock.calls.filter(([url]) => url.endsWith('/apply'))
  ).toHaveLength(1);
  expect(screen.getByTestId('new-class-label')).toBeDisabled();
});

it('adds a named own data property with Enter and its identifier flag', () => {
  setup();
  openAdvanced();
  fill('new-class-property-name', 'reference');
  fireEvent.click(screen.getByRole('checkbox', { name: 'label.identifier' }));
  fireEvent.keyDown(screen.getByTestId('new-class-property-name'), {
    key: 'Enter',
  });

  expect(
    screen.getByText(/reference · label.string · label.identifier/)
  ).toBeVisible();
  expect(screen.getByTestId('new-class-property-name')).toHaveValue('');
});

it('shows polyhierarchy for multiple parents and never submits inherited properties', async () => {
  setup({
    model: {
      ...model,
      properties: [
        {
          id: 'inherited',
          name: 'inheritedReference',
          fullyQualifiedName: 'Finance.inheritedReference',
          iri: ontology.namespace + 'inheritedReference',
          kind: Kind.Data,
          domain: [parents[0].iri],
          ontology: { id: ontology.id, type: 'ontology' },
        },
      ],
    },
  });
  openAdvanced();
  const input = screen.getByRole('combobox', { name: 'label.subclass-of' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Payment' } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'Payment' }));
  fireEvent.change(input, { target: { value: 'Transaction' } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'Transaction' }));

  expect(screen.getByTestId('new-class-polyhierarchy')).toBeVisible();
  expect(screen.getByText(/inheritedReference/)).toBeVisible();

  fill('new-class-label', 'Funds Transfer');
  await act(async () => {
    fireEvent.click(screen.getByTestId('new-class-create'));
  });
  await waitFor(() => expect(reconcile).toHaveBeenCalled());
  const plan = post.mock.calls.find(
    ([url]) => url === '/ontologyChangeSets'
  )?.[1];

  expect(
    plan.operations.map(
      (operation: { operationType: string }) => operation.operationType
    )
  ).toEqual(['UPSERT_CONCEPT', 'UPSERT_AXIOM', 'UPSERT_AXIOM']);
});

it('locks the panel through uncertain apply and retries the retained draft before notifying creation', async () => {
  const lockChanged = jest.fn();
  let uncertain = false;
  let readable = false;
  const normalPost = post.getMockImplementation();
  post.mockImplementation(
    async (url: string, body: Record<string, unknown>) => {
      if (url.endsWith('/apply')) {
        uncertain = true;

        throw new Error('response lost');
      }

      return normalPost?.(url, body);
    }
  );
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/state')) {
      return { data: { workingRevision: 7 } };
    }
    if (uncertain && !readable) {
      throw new Error('outcome unavailable');
    }

    return { data: { ...retained, state: uncertain ? 'APPLIED' : 'DRAFT' } };
  });
  render(
    <MemoryRouter>
      <OntologyDraftProvider>
        <Link to="/explore">Explore</Link>
        <OntologyNewClassPanel
          canCreate
          canCreateAxiom
          canCreateProperty
          model={model}
          ontology={ontology}
          onBeforeCreate={jest.fn()}
          onClose={jest.fn()}
          onCreated={reconcile}
          onLockChange={lockChanged}
          onUndone={jest.fn()}
        />
      </OntologyDraftProvider>
    </MemoryRouter>
  );
  fill('new-class-label', 'Funds Transfer');
  await act(async () => {
    fireEvent.click(screen.getByTestId('new-class-create'));
  });
  await waitFor(() =>
    expect(post.mock.calls.map(([url]) => url)).toContain(
      '/ontologyChangeSets/draft/apply'
    )
  );
  await screen.findByRole('button', { name: 'label.retry' });

  expect(reconcile).not.toHaveBeenCalled();
  expect(screen.getByTestId('ontology-new-class-close')).toBeDisabled();
  expect(lockChanged).toHaveBeenLastCalledWith(true);

  fireEvent.click(screen.getByRole('link', { name: 'Explore' }));

  expect(screen.getByRole('button', { name: 'label.discard' })).toBeDisabled();
  expect(screen.getByTestId('new-class-label')).toHaveValue('Funds Transfer');

  fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

  readable = true;
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
  });
  await waitFor(() =>
    expect(reconcile).toHaveBeenCalledWith(
      ontology.namespace + 'FundsTransfer',
      {
        keepOpen: false,
      }
    )
  );

  expect(
    post.mock.calls.filter(([url]) => url === '/ontologyChangeSets')
  ).toHaveLength(1);
  expect(
    post.mock.calls.filter(([url]) => url.endsWith('/apply'))
  ).toHaveLength(1);
});

it('does not apply or create partial definitions when another editor holds the lease', async () => {
  const normalPost = post.getMockImplementation();
  post.mockImplementation(
    async (url: string, body: Record<string, unknown>) => {
      if (url.endsWith('/acquire')) {
        throw new Error('held');
      }

      return normalPost?.(url, body);
    }
  );
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/state')) {
      return { data: { workingRevision: 7 } };
    }
    if (url.includes('/ontologyEditLocks/')) {
      return {
        data: { holder: { id: 'other', name: 'Other editor', type: 'user' } },
      };
    }

    return { data: { ...retained, state: 'DRAFT' } };
  });
  setup();
  fill('new-class-label', 'Funds Transfer');
  await act(async () => {
    fireEvent.click(screen.getByTestId('new-class-create'));
  });

  expect(
    await screen.findByText('message.ontology-class-lease-holder')
  ).toBeVisible();
  expect(post.mock.calls.map(([url]) => url)).toEqual([
    '/ontologyChangeSets',
    '/ontologyEditLocks/acquire',
  ]);
  expect(reconcile).not.toHaveBeenCalled();
});

describe('after a failed attempt', () => {
  const rejectFirstApply = () => {
    const normalPost = post.getMockImplementation();
    let rejected = false;
    post.mockImplementation(
      async (url: string, body: Record<string, unknown>) => {
        if (url.endsWith('/apply') && !rejected) {
          rejected = true;

          return {
            data: {
              ...retained,
              state: 'APPLY_FAILED',
              applicationResult: {
                results: [
                  { status: 'FAILED', message: 'Definition already exists' },
                ],
              },
            },
          };
        }

        return normalPost?.(url, body);
      }
    );
  };
  const failFirstApplyWith = (status: number) => {
    const normalPost = post.getMockImplementation();
    let failed = false;
    post.mockImplementation(
      async (url: string, body: Record<string, unknown>) => {
        if (url.endsWith('/apply') && !failed) {
          failed = true;

          throw new AxiosError(
            'Request failed with status code ' + status,
            status < 500
              ? AxiosError.ERR_BAD_REQUEST
              : AxiosError.ERR_BAD_RESPONSE,
            undefined,
            undefined,
            { status } as AxiosResponse
          );
        }

        return normalPost?.(url, body);
      }
    );
  };
  const createFundsTransfer = async () => {
    fill('new-class-label', 'Funds Transfer');
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });
  };
  const changeSetCreates = () =>
    post.mock.calls.filter(([url]) => url === '/ontologyChangeSets');

  it('rebuilds from a fresh working revision after the server refuses the apply with 412', async () => {
    failFirstApplyWith(412);
    const lockChanged = jest.fn();
    setup({ onLockChange: lockChanged });
    await createFundsTransfer();

    expect(await screen.findByText('server.unexpected-error')).toBeVisible();
    expect(screen.getByTestId('new-class-label')).toBeEnabled();
    expect(screen.getByTestId('ontology-new-class-close')).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'label.retry' })
    ).not.toBeInTheDocument();
    expect(lockChanged).toHaveBeenLastCalledWith(false);

    get.mockImplementation(async (url: string) => ({
      data: url.endsWith('/state') ? { workingRevision: 8 } : readDraft(url),
    }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });
    await waitFor(() =>
      expect(reconcile).toHaveBeenCalledWith(
        ontology.namespace + 'FundsTransfer',
        {
          keepOpen: false,
        }
      )
    );

    expect(
      changeSetCreates().map(([, body]) => body.baseWorkingRevision)
    ).toEqual([7, 8]);
  });

  it('keeps the plan locked after a 504 and lets Retry re-read the same change set', async () => {
    failFirstApplyWith(504);
    const lockChanged = jest.fn();
    setup({ onLockChange: lockChanged });
    await createFundsTransfer();

    expect(
      await screen.findByRole('button', { name: 'label.retry' })
    ).toBeVisible();
    expect(screen.getByTestId('new-class-label')).toBeDisabled();
    expect(screen.getByTestId('ontology-new-class-close')).toBeDisabled();
    expect(screen.queryByTestId('new-class-create')).not.toBeInTheDocument();
    expect(lockChanged).toHaveBeenLastCalledWith(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });
    await waitFor(() =>
      expect(reconcile).toHaveBeenCalledWith(
        ontology.namespace + 'FundsTransfer',
        {
          keepOpen: false,
        }
      )
    );

    expect(changeSetCreates()).toHaveLength(1);
    expect(
      post.mock.calls.filter(([url]) => url.endsWith('/apply'))
    ).toHaveLength(2);
  });

  it('settles as rejected when a 500 follows an apply the server recorded as failed', async () => {
    failFirstApplyWith(500);
    const lockChanged = jest.fn();
    setup({ onLockChange: lockChanged });
    get.mockImplementation(async (url: string) => {
      if (url.endsWith('/state')) {
        return { data: { workingRevision: 7 } };
      }
      const draft = readDraft(url);
      const applyAttempted = post.mock.calls.some(([postUrl]) =>
        postUrl.endsWith('/apply')
      );

      return {
        data:
          applyAttempted && url !== '/ontologyChangeSets'
            ? { ...draft, state: 'APPLY_FAILED' }
            : draft,
      };
    });
    await createFundsTransfer();

    expect(await screen.findByText('server.unexpected-error')).toBeVisible();
    expect(screen.getByTestId('new-class-label')).toBeEnabled();
    expect(screen.getByTestId('ontology-new-class-close')).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'label.retry' })
    ).not.toBeInTheDocument();
    expect(lockChanged).toHaveBeenLastCalledWith(false);
  });

  it('keeps Retry and the lock when a retried apply loses its response and the re-read still shows the earlier APPLY_FAILED', async () => {
    const normalPost = post.getMockImplementation();
    let applyCalls = 0;
    let serverRecordedFailure = false;
    post.mockImplementation(
      async (url: string, body: Record<string, unknown>) => {
        if (url.endsWith('/apply')) {
          applyCalls += 1;
          if (applyCalls === 1) {
            throw new AxiosError(
              'Request failed with status code 504',
              AxiosError.ERR_BAD_RESPONSE,
              undefined,
              undefined,
              { status: 504 } as AxiosResponse
            );
          }

          throw new AxiosError('Network Error', AxiosError.ERR_NETWORK);
        }

        return normalPost?.(url, body);
      }
    );
    get.mockImplementation(async (url: string) => {
      if (url.endsWith('/state')) {
        return { data: { workingRevision: 7 } };
      }
      const draft = readDraft(url);

      return {
        data:
          serverRecordedFailure && url !== '/ontologyChangeSets'
            ? { ...draft, state: 'APPLY_FAILED' }
            : draft,
      };
    });
    const lockChanged = jest.fn();
    setup({ onLockChange: lockChanged });
    await createFundsTransfer();

    expect(
      await screen.findByRole('button', { name: 'label.retry' })
    ).toBeVisible();

    serverRecordedFailure = true;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });
    await waitFor(() => expect(applyCalls).toBe(2));

    expect(
      await screen.findByRole('button', { name: 'label.retry' })
    ).toBeVisible();
    expect(screen.getByTestId('new-class-label')).toBeDisabled();
    expect(screen.getByTestId('ontology-new-class-close')).toBeDisabled();
    expect(lockChanged).toHaveBeenLastCalledWith(true);
  });

  it('unlocks the form and Close when the server rejects the plan', async () => {
    rejectFirstApply();
    const lockChanged = jest.fn();
    setup({ onLockChange: lockChanged });
    await createFundsTransfer();

    expect(await screen.findByText('Definition already exists')).toBeVisible();
    expect(screen.getByTestId('new-class-label')).toBeEnabled();
    expect(screen.getByTestId('ontology-new-class-close')).toBeEnabled();
    expect(lockChanged).toHaveBeenLastCalledWith(false);
  });

  it('rebuilds the plan from a fresh working revision when Create is pressed again', async () => {
    rejectFirstApply();
    setup();
    await createFundsTransfer();
    await screen.findByText('Definition already exists');
    get.mockImplementation(async (url: string) => ({
      data: url.endsWith('/state') ? { workingRevision: 8 } : readDraft(url),
    }));
    fill('new-class-label', 'Wire Transfer');
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });
    await waitFor(() =>
      expect(reconcile).toHaveBeenCalledWith(
        ontology.namespace + 'WireTransfer',
        {
          keepOpen: false,
        }
      )
    );
    const creates = post.mock.calls.filter(
      ([url]) => url === '/ontologyChangeSets'
    );

    expect(creates.map(([, body]) => body.baseWorkingRevision)).toEqual([7, 8]);
  });

  it('lets the user leave once the class is applied even if the canvas cannot place it', async () => {
    const lockChanged = jest.fn();
    setup({ onLockChange: lockChanged });
    await createFundsTransfer();
    await screen.findByRole('button', { name: 'label.retry' });

    expect(screen.getByTestId('ontology-new-class-close')).toBeEnabled();
    expect(lockChanged).toHaveBeenLastCalledWith(false);
  });
});

describe('with the shipped English translations', () => {
  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  it('renders every label from en-us.json', async () => {
    setup();
    openAdvanced();

    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: /^Display Name/ })
    ).toBeVisible();
    expect(screen.getByText('Advanced')).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: /^Property name/ })
    ).toBeVisible();

    fireEvent.click(
      within(screen.getByTestId('new-class-advanced')).getByRole('button', {
        name: /Type/,
      })
    );
    await screen.findByRole('listbox');

    expect(document.body.textContent).not.toContain(MISSING_TRANSLATION_MARKER);
  });

  it('offers the property types by name', async () => {
    setup();
    openAdvanced();
    fireEvent.click(
      within(screen.getByTestId('new-class-advanced')).getByRole('button', {
        name: /Type/,
      })
    );
    const options = await screen.findAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'String',
      'Integer',
      'Decimal',
      'Boolean',
      'Date',
      'Date and time',
      'Enum',
      'Object',
    ]);
  });

  it('names the type of an added property', () => {
    setup();
    openAdvanced();
    fill('new-class-property-name', 'reference');
    fireEvent.keyDown(screen.getByTestId('new-class-property-name'), {
      key: 'Enter',
    });

    expect(screen.getByText('reference · String')).toBeVisible();
  });
});

describe('focus', () => {
  const Harness = () => {
    const [open, setOpen] = useState(false);

    return (
      <>
        <button data-testid="trigger" onClick={() => setOpen(true)}>
          open
        </button>
        {open ? (
          <OntologyNewClassPanel
            canCreate
            canCreateAxiom
            canCreateProperty
            model={model}
            ontology={ontology}
            onBeforeCreate={jest.fn()}
            onClose={() => setOpen(false)}
            onCreated={reconcile}
            onUndone={jest.fn()}
          />
        ) : null}
      </>
    );
  };

  it('moves to the name when the panel opens and back to the trigger when it closes', async () => {
    render(<Harness />);
    screen.getByTestId('trigger').focus();
    fireEvent.click(screen.getByTestId('trigger'));

    await waitFor(() =>
      expect(screen.getByTestId('new-class-local-name')).toHaveFocus()
    );

    fireEvent.click(screen.getByTestId('ontology-new-class-close'));

    expect(screen.getByTestId('trigger')).toHaveFocus();
  });
});

describe('one drawer for every entry point', () => {
  const textboxNames = () =>
    screen
      .getAllByRole('textbox')
      .map((box) => box.getAttribute('aria-label') ?? box.id);

  it('orders Name, Display name, Description, Type, IRI, Synonyms and Mappings, with the rest under Advanced', () => {
    setup();

    expect(
      screen
        .getAllByRole('textbox')
        .map((box) => (box as HTMLInputElement).dataset.testid)
    ).toEqual([
      'new-class-local-name',
      'new-class-label',
      'new-class-description',
      'new-class-iri-input',
      'new-class-synonyms',
    ]);
    expect(
      within(screen.getByTestId('new-class-mapping-iri')).getByRole('combobox')
    ).toBeVisible();
    expect(
      screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))
    ).toEqual(['OWL_CLASS', 'SKOS_CONCEPT', 'BOTH']);
    expect(textboxNames()).toHaveLength(5);
    expect(
      screen.queryByRole('combobox', { name: 'label.subclass-of' })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-class-source')).not.toBeInTheDocument();

    openAdvanced();

    expect(
      ['label.subclass-of', 'label.equivalent-to', 'label.disjoint-with'].map(
        (name) => screen.getByRole('combobox', { name }).tagName
      )
    ).toEqual(['INPUT', 'INPUT', 'INPUT']);
    expect(
      screen.getByRole('checkbox', { name: 'label.abstract' })
    ).toBeVisible();
    expect(screen.getByTestId('new-class-source')).toBeVisible();
    expect(screen.getByTestId('new-class-property-name')).toBeVisible();
    expect(screen.getByRole('textbox', { name: /label.layer/ })).toBeVisible();
    expect(screen.getByText(/editor.*label.you/)).toBeVisible();
  });

  it('derives the name from the display name and refuses Spaced Name! with a message', () => {
    setup();
    fill('new-class-label', 'Spaced Name');

    expect(screen.getByTestId('new-class-local-name')).toHaveValue(
      'SpacedName'
    );
    expect(screen.getByTestId('new-class-create')).toBeEnabled();

    fill('new-class-local-name', 'Spaced Name!');

    expect(
      screen.getAllByText('message.ontology-concept-name-invalid')
    ).toHaveLength(2);
    expect(screen.getByTestId('new-class-create')).toBeDisabled();
    expect(screen.getByTestId('new-class-create-another')).toBeDisabled();
    expect(screen.getByTestId('new-class-iri')).toHaveTextContent(
      ontology.namespace + 'Spaced Name!'
    );
  });

  it('blocks a duplicate name and a duplicate label beside the field', () => {
    setup();
    fill('new-class-local-name', 'Payment');

    expect(
      screen.getAllByText('message.ontology-concept-name-taken')
    ).toHaveLength(2);
    expect(screen.getByTestId('new-class-create')).toBeDisabled();

    fill('new-class-local-name', 'Remittance');
    fill('new-class-label', 'transaction');

    expect(
      screen.getAllByText('message.ontology-concept-label-taken')
    ).toHaveLength(2);
    expect(screen.getByTestId('new-class-create')).toBeDisabled();

    fill('new-class-label', 'Remittance advice');

    expect(screen.getByTestId('new-class-create')).toBeEnabled();
  });

  it('rejects a relative IRI and an IRI already in use', () => {
    setup();
    fill('new-class-local-name', 'Remittance');
    fill('new-class-iri-input', 'relative/iri');

    expect(screen.getAllByText('message.invalid-concept-iri')).toHaveLength(2);
    expect(screen.getByTestId('new-class-create')).toBeDisabled();

    fill('new-class-iri-input', parents[0].iri);

    expect(
      screen.getAllByText('message.ontology-concept-iri-taken')
    ).toHaveLength(2);

    fill('new-class-iri-input', 'https://example.org/other#Remittance');

    expect(screen.getByTestId('new-class-create')).toBeEnabled();
    expect(screen.getByTestId('new-class-iri')).toHaveTextContent(
      'https://example.org/other#Remittance'
    );
  });

  it('states why Create is disabled', () => {
    setup();

    expect(screen.getByTestId('new-class-create')).toBeDisabled();
    expect(screen.getByTestId('new-class-create-reason')).toHaveTextContent(
      'message.ontology-concept-name-required'
    );
  });

  it('states a missing permission as the reason', () => {
    setup({ canCreate: false });
    fill('new-class-label', 'Remittance');

    expect(screen.getByTestId('new-class-create')).toBeDisabled();
    expect(screen.getByTestId('new-class-create-reason')).toHaveTextContent(
      'message.no-permission-for-action'
    );
  });

  it('shows Unsaved changes once the form is touched', () => {
    setup();

    expect(screen.getByTestId('new-class-save-status')).toBeEmptyDOMElement();

    fill('new-class-label', 'Remittance');

    expect(screen.getByTestId('new-class-save-status')).toHaveTextContent(
      'label.unsaved-changes'
    );
  });

  it('plans the chosen type, IRI, synonyms and mappings', async () => {
    setup();
    fill('new-class-label', 'Remittance');
    fireEvent.click(screen.getByRole('radio', { name: 'label.both-owl-skos' }));
    fill('new-class-iri-input', 'https://example.org/other#Remittance');
    fill('new-class-synonyms', 'Wire,');
    fillMappingIri('https://schema.org/Payment');
    fireEvent.click(screen.getByTestId('new-class-add-mapping'));

    expect(screen.getByTestId('new-class-mapping')).toHaveTextContent(
      'Exact match · https://schema.org/Payment'
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });
    await waitFor(() => expect(reconcile).toHaveBeenCalled());
    const changeSetCall = post.mock.calls.find(
      ([url]) => url === '/ontologyChangeSets'
    );
    const { concept } = changeSetCall?.[1].operations[0] ?? {};

    expect(concept).toMatchObject({
      name: 'Remittance',
      iri: 'https://example.org/other#Remittance',
      conceptType: 'BOTH',
      displayName: 'Remittance',
      synonyms: ['Wire'],
      conceptMappings: [
        {
          mappingType: 'EXACT_MATCH',
          conceptIri: 'https://schema.org/Payment',
        },
      ],
    });
    expect(reconcile).toHaveBeenCalledWith(
      'https://example.org/other#Remittance',
      { keepOpen: false }
    );
  });
});

describe('Create and add another', () => {
  const creates = () =>
    post.mock.calls.filter(([url]) => url === '/ontologyChangeSets');

  it('clears the form, keeps the drawer open and refocuses Name each time', async () => {
    reconcile.mockResolvedValue(true);
    const onClose = jest.fn();
    setup({ onClose });
    for (const label of ['Remittance', 'Settlement']) {
      fill('new-class-label', label);
      fill('new-class-description', 'text');
      await act(async () => {
        fireEvent.click(screen.getByTestId('new-class-create-another'));
      });
      await waitFor(() =>
        expect(reconcile).toHaveBeenLastCalledWith(ontology.namespace + label, {
          keepOpen: true,
        })
      );
      await waitFor(() =>
        expect(screen.getByTestId('new-class-local-name')).toHaveFocus()
      );

      expect(screen.getByTestId('new-class-label')).toHaveValue('');
      expect(screen.getByTestId('new-class-local-name')).toHaveValue('');
      expect(screen.getByTestId('new-class-description')).toHaveValue('');
      expect(screen.getByTestId('new-class-label')).toBeEnabled();
      expect(screen.getByTestId('new-class-save-status')).toHaveTextContent(
        'label.all-changes-saved'
      );
    }

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-new-class-panel')).toBeVisible();
    expect(
      creates().map(([, body]) => body.operations[0].concept.name)
    ).toEqual(['Remittance', 'Settlement']);
  });

  it('does not release the change-set lease after it applied', async () => {
    reconcile.mockResolvedValue(true);
    setup();
    fill('new-class-label', 'Remittance');
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });
    await waitFor(() => expect(reconcile).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(
      (APIClient.delete as jest.Mock).mock.calls.filter(([url]) =>
        String(url).includes('ontologyEditLocks')
      )
    ).toEqual([]);
  });
});

describe('Undo after create', () => {
  it('hard deletes what the change set created, dependents first, and refreshes', async () => {
    reconcile.mockResolvedValue(true);
    const onUndone = jest.fn();
    const add = jest.spyOn(toastQueue, 'add').mockReturnValue('toast-key');
    const close = jest.spyOn(toastQueue, 'close').mockImplementation();
    (APIClient.delete as jest.Mock).mockResolvedValue({});
    setup({ onUndone });
    fill('new-class-label', 'Remittance');
    openAdvanced();
    const input = screen.getByRole('combobox', { name: 'label.subclass-of' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Payment' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Payment' }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });
    await waitFor(() => expect(add).toHaveBeenCalled());
    const plan = post.mock.calls.find(
      ([url]) => url === '/ontologyChangeSets'
    )?.[1];
    const message = add.mock.calls[0][0].message;
    renderNode(<>{message}</>);

    expect(screen.getByText('message.ontology-concept-created')).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-undo'));
    });

    expect(close).toHaveBeenCalledWith('toast-key');
    expect(
      (APIClient.delete as jest.Mock).mock.calls.map(([url, config]) => [
        url,
        config.params,
      ])
    ).toEqual([
      ['/ontologyAxioms/' + plan.operations[1].axiom.id, { hardDelete: true }],
      [
        '/ontologyConcepts/' + plan.operations[0].concept.id,
        { hardDelete: true },
      ],
    ]);
    expect(onUndone).toHaveBeenCalledTimes(1);

    add.mockRestore();
    close.mockRestore();
  });
});

describe('Ontology field for All ontologies', () => {
  const second = {
    ...ontology,
    id: 'o2',
    name: 'Risk',
    fullyQualifiedName: 'Risk',
  };
  const field = (value: string, onChange = jest.fn()) => ({
    options: [
      { id: ontology.id, label: 'Finance' },
      { id: second.id, label: 'Risk' },
    ],
    value,
    onChange,
  });

  it('is absent when one ontology is open', () => {
    setup();

    expect(screen.queryByTestId('new-class-ontology')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('new-class-in-ontology')
    ).not.toBeInTheDocument();
  });

  it('is the first field, preselected, and names the target in the header', () => {
    setup({ ontologyField: field(ontology.id) });

    expect(screen.getByTestId('new-class-in-ontology')).toHaveTextContent(
      'label.in-entity'
    );
    expect(
      screen
        .getByTestId('new-class-ontology')
        .compareDocumentPosition(screen.getByTestId('new-class-local-name')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('new-class-ontology')).getByRole('button')
    ).toHaveTextContent('Finance');
  });

  it('reports a change of ontology to the host', async () => {
    const onChange = jest.fn();
    setup({ ontologyField: field(ontology.id, onChange) });
    fireEvent.click(
      within(screen.getByTestId('new-class-ontology')).getByRole('button')
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Risk' }));

    expect(onChange).toHaveBeenCalledWith('o2');
  });

  it('keeps Create disabled, with the reason, until an ontology is chosen', () => {
    setup({ ontologyField: field('') });
    fill('new-class-label', 'Remittance');

    expect(screen.getByTestId('new-class-create')).toBeDisabled();
    expect(screen.getByTestId('new-class-create-reason')).toHaveTextContent(
      'message.ontology-concept-ontology-required'
    );
  });
});

describe('a name held by a deleted concept', () => {
  beforeEach(() => {
    jest.useRealTimers();
    useEnUsTranslations();
    put.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
  const typeName = async (name: string) => {
    fill('new-class-local-name', name);
    await settle();
    await settle();
  };

  const holdName = (name: string) =>
    get.mockImplementation(async (url: string) => {
      if (url.includes('/ontologyConcepts/name/')) {
        return {
          data: {
            id: 'deleted-id',
            name,
            deleted: true,
            iri: ontology.namespace + name,
          },
        };
      }

      return {
        data: url.endsWith('/state') ? { workingRevision: 7 } : readDraft(url),
      };
    });

  it('names the deleted concept, offers Restore and keeps Create disabled', async () => {
    holdName('Customer');
    setup();
    await typeName('Customer');

    expect(
      await screen.findByTestId('new-class-name-deleted')
    ).toHaveTextContent(
      'A deleted concept named Customer exists in this ontology.'
    );
    expect(screen.getByTestId('new-class-restore')).toHaveTextContent(
      'Restore'
    );
    expect(screen.getByTestId('new-class-create')).toBeDisabled();
    expect(get).toHaveBeenCalledWith(
      '/ontologyConcepts/name/Finance.Customer',
      { params: { include: 'all' } }
    );
  });

  it('restores through the concept resource and hands the concept to the host', async () => {
    holdName('Customer');
    reconcile.mockResolvedValue(true);
    setup();
    await typeName('Customer');
    fireEvent.click(await screen.findByTestId('new-class-restore'));

    await waitFor(() =>
      expect(reconcile).toHaveBeenCalledWith(ontology.namespace + 'Customer', {
        keepOpen: false,
      })
    );

    expect(put).toHaveBeenCalledWith('/ontologyConcepts/restore', {
      id: 'deleted-id',
    });
  });

  it('does not warn for a name nothing holds', async () => {
    setup();
    await typeName('Supplier');

    expect(get).toHaveBeenCalledWith(
      '/ontologyConcepts/name/Finance.Supplier',
      {
        params: { include: 'all' },
      }
    );

    expect(screen.queryByTestId('new-class-name-deleted')).toBeNull();
    expect(screen.getByTestId('new-class-create')).toBeEnabled();
  });

  it('shows the server sentence beside the name on a plain 409, without a toast', async () => {
    const normalPost = post.getMockImplementation();
    post.mockImplementation(
      async (url: string, body: Record<string, unknown>) => {
        if (url === '/ontologyChangeSets') {
          throw new AxiosError(
            'Request failed with status code 409',
            AxiosError.ERR_BAD_REQUEST,
            undefined,
            undefined,
            {
              status: 409,
              data: { message: 'Entity already exists.' },
            } as AxiosResponse
          );
        }

        return normalPost?.(url, body);
      }
    );
    setup();
    await typeName('Supplier');
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });

    expect(
      await screen.findByTestId('new-class-name-conflict')
    ).toHaveTextContent('Entity already exists.');
    expect(showErrorToast).not.toHaveBeenCalled();
  });
});

describe('a SKOS concept takes no OWL axioms', () => {
  const SKOS_ERROR =
    'A SKOS concept cannot have parents, equivalent or disjoint classes, or properties. Remove them, or choose OWL class or Both.';
  const skosOnlyConcept = {
    ...parents[0],
    id: 'Vocabulary',
    name: 'Vocabulary',
    displayName: 'Vocabulary',
    fullyQualifiedName: 'Finance.Vocabulary',
    iri: ontology.namespace + 'Vocabulary',
    conceptType: OntologyConceptType.SkosConcept,
  };
  const bothConcept = {
    ...parents[0],
    id: 'Hybrid',
    name: 'Hybrid',
    displayName: 'Hybrid',
    fullyQualifiedName: 'Finance.Hybrid',
    iri: ontology.namespace + 'Hybrid',
    conceptType: OntologyConceptType.Both,
  };

  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  const chooseType = (type: OntologyConceptType) =>
    fireEvent.click(screen.getByTestId('new-class-type-' + type));
  const addParent = async (name: string) => {
    const input = screen.getByRole('combobox', { name: 'Subclass of' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: name } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name }));
  };
  const addProperty = (name: string) => {
    fill('new-class-property-name', name);
    fireEvent.keyDown(screen.getByTestId('new-class-property-name'), {
      key: 'Enter',
    });
  };
  const createRequests = () =>
    post.mock.calls.filter(([url]) => url === '/ontologyChangeSets');

  it('refuses a parent added after choosing SKOS concept and clears when OWL class is chosen', async () => {
    setup();
    fill('new-class-label', 'Remittance');
    openAdvanced();
    chooseType(OntologyConceptType.SkosConcept);

    expect(screen.queryByText(SKOS_ERROR)).not.toBeInTheDocument();
    expect(screen.getByTestId('new-class-create')).toBeEnabled();

    await addParent('Payment');

    expect(screen.getByText(SKOS_ERROR)).toBeVisible();
    expect(screen.getByTestId('new-class-create')).toBeDisabled();
    expect(screen.getByText('Payment')).toBeVisible();

    chooseType(OntologyConceptType.OwlClass);

    expect(screen.queryByText(SKOS_ERROR)).not.toBeInTheDocument();
    expect(screen.getByTestId('new-class-create')).toBeEnabled();
  });

  it('refuses a parent chosen before switching to SKOS concept and clears when Both is chosen', async () => {
    setup();
    fill('new-class-label', 'Remittance');
    openAdvanced();
    await addParent('Payment');

    expect(screen.queryByText(SKOS_ERROR)).not.toBeInTheDocument();
    expect(screen.getByTestId('new-class-create')).toBeEnabled();

    chooseType(OntologyConceptType.SkosConcept);

    expect(screen.getByText(SKOS_ERROR)).toBeVisible();
    expect(screen.getByTestId('new-class-create')).toBeDisabled();

    chooseType(OntologyConceptType.Both);

    expect(screen.queryByText(SKOS_ERROR)).not.toBeInTheDocument();
    expect(screen.getByTestId('new-class-create')).toBeEnabled();
  });

  it('refuses an own property on a SKOS concept and clears once it is removed', () => {
    setup();
    fill('new-class-label', 'Remittance');
    openAdvanced();
    chooseType(OntologyConceptType.SkosConcept);
    addProperty('reference');

    expect(screen.getByText(SKOS_ERROR)).toBeVisible();
    expect(screen.getByTestId('new-class-create')).toBeDisabled();
    expect(screen.getByText(/reference · String/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Remove reference' }));

    expect(screen.queryByText(SKOS_ERROR)).not.toBeInTheDocument();
    expect(screen.getByTestId('new-class-create')).toBeEnabled();
  });

  it('creates a SKOS concept that has only synonyms and mappings', async () => {
    setup();
    fill('new-class-label', 'Remittance');
    chooseType(OntologyConceptType.SkosConcept);
    fill('new-class-synonyms', 'Wire,');
    fillMappingIri('https://schema.org/Payment');
    fireEvent.click(screen.getByTestId('new-class-add-mapping'));

    expect(screen.queryByText(SKOS_ERROR)).not.toBeInTheDocument();
    expect(screen.getByTestId('new-class-create')).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });
    await waitFor(() => expect(reconcile).toHaveBeenCalled());

    expect(createRequests()[0][1].operations).toHaveLength(1);
    expect(createRequests()[0][1].operations[0].concept).toMatchObject({
      conceptType: 'SKOS_CONCEPT',
      synonyms: ['Wire'],
    });
  });

  it('offers only OWL class and Both concepts as parents, equivalent, disjoint and range targets', async () => {
    setup({
      model: { ...model, concepts: [...parents, skosOnlyConcept, bothConcept] },
    });
    openAdvanced();

    const input = screen.getByRole('combobox', { name: 'Subclass of' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(
      await screen.findByRole('option', { name: 'Payment' })
    ).toBeVisible();
    expect(screen.getByRole('option', { name: 'Hybrid' })).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'Vocabulary' })
    ).not.toBeInTheDocument();
  });
});

describe('mappings are picked by label', () => {
  const ledgerAccount = {
    id: 'ledger-account',
    name: 'Account',
    displayName: 'Account',
    fullyQualifiedName: 'Ledger.Account',
    iri: 'https://example.org/ledger#Account',
    conceptType: OntologyConceptType.OwlClass,
    ontology: { id: 'ledger', name: 'Ledger', type: 'ontology' },
  };
  const serveReadableConcepts = () => {
    const base = get.getMockImplementation();
    get.mockImplementation(async (url: string, ...rest: unknown[]) =>
      url === '/ontologyConcepts'
        ? { data: { data: [ledgerAccount], paging: {} } }
        : base?.(url, ...rest)
    );
  };
  const mappingPicker = async () => {
    const picker = await screen.findByRole('combobox', {
      name: /^label\.concept-iri/,
    });
    await act(async () => undefined);

    return picker;
  };
  const type = (picker: HTMLElement, text: string) => {
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: text } });
  };
  const addMapping = () =>
    fireEvent.click(screen.getByTestId('new-class-add-mapping'));
  const createdConcept = async () => {
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });
    await waitFor(() => expect(reconcile).toHaveBeenCalled());

    return post.mock.calls.find(([url]) => url === '/ontologyChangeSets')?.[1]
      .operations[0].concept;
  };

  beforeEach(serveReadableConcepts);

  it('offers a concept of another ontology by label and saves its IRI', async () => {
    setup();
    fill('new-class-label', 'Remittance');
    const picker = await mappingPicker();
    type(picker, 'Acc');
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    const option = await screen.findByRole('option', { name: /Account/ });

    expect(option).toHaveTextContent(
      'Ledger · https://example.org/ledger#Account'
    );

    fireEvent.click(option);
    addMapping();

    expect(screen.getByTestId('new-class-mapping')).toHaveTextContent(
      'Exact match · https://example.org/ledger#Account'
    );
    expect(picker).toHaveValue('');

    expect((await createdConcept()).conceptMappings).toEqual([
      expect.objectContaining({
        mappingType: 'EXACT_MATCH',
        conceptIri: 'https://example.org/ledger#Account',
      }),
    ]);
  });

  it('offers a concept of the ontology being edited by label', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'Trans');
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /Transaction/ }));
    addMapping();

    expect(screen.getByTestId('new-class-mapping')).toHaveTextContent(
      'Exact match · https://example.org/fin#Transaction'
    );
  });

  it('keeps a pasted IRI that no concept carries, next to a picked one', async () => {
    setup();
    fill('new-class-label', 'Remittance');
    const picker = await mappingPicker();
    type(picker, 'Acc');
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /Account/ }));
    addMapping();
    type(picker, 'https://schema.org/Payment');
    fireEvent.blur(picker);

    expect(screen.getByTestId('new-class-add-mapping')).toBeEnabled();

    addMapping();

    expect(
      screen.getAllByTestId('new-class-mapping').map((row) => row.textContent)
    ).toEqual([
      'Exact match · https://example.org/ledger#Account',
      'Exact match · https://schema.org/Payment',
    ]);
    expect(
      (await createdConcept()).conceptMappings.map(
        (mapping: { conceptIri: string }) => mapping.conceptIri
      )
    ).toEqual([
      'https://example.org/ledger#Account',
      'https://schema.org/Payment',
    ]);
  });

  it('shows no error while a partial label is typed', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'Acc');

    expect(
      screen.queryByText('message.invalid-concept-iri')
    ).not.toBeInTheDocument();
  });

  it('rejects Add mapping on text that is neither a concept label nor an absolute IRI', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'no such concept');

    expect(
      screen.queryByText('message.invalid-concept-iri')
    ).not.toBeInTheDocument();

    addMapping();

    expect(screen.getByText('message.invalid-concept-iri')).toBeVisible();
    expect(screen.queryByTestId('new-class-mapping')).not.toBeInTheDocument();
  });

  it('rejects Enter on text that is neither a concept label nor an absolute IRI', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'no such concept');
    fireEvent.keyDown(picker, { key: 'Enter' });

    expect(screen.getByText('message.invalid-concept-iri')).toBeVisible();
    expect(screen.queryByTestId('new-class-mapping')).not.toBeInTheDocument();
  });

  it('rejects leaving the field with text that is neither a concept label nor an absolute IRI', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'no such concept');
    fireEvent.blur(picker);

    expect(screen.getByText('message.invalid-concept-iri')).toBeVisible();
  });

  it('clears the error when the text changes', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'no such concept');
    addMapping();
    type(picker, 'no such concept 2');

    expect(
      screen.queryByText('message.invalid-concept-iri')
    ).not.toBeInTheDocument();
  });

  it('never shows the error for a pasted IRI or a picked label', async () => {
    serveReadableConcepts();
    setup();
    const picker = await mappingPicker();
    type(picker, 'https://schema.org/Payment');
    fireEvent.blur(picker);
    type(picker, 'Account');
    fireEvent.blur(picker);

    expect(
      screen.queryByText('message.invalid-concept-iri')
    ).not.toBeInTheDocument();
  });

  it('adds a concept picked by label when Enter is pressed and no option is focused', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'Acc');
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /Account/ }));
    fireEvent.keyDown(picker, { key: 'Enter' });

    expect(screen.getByTestId('new-class-mapping')).toHaveTextContent(
      'Exact match · https://example.org/ledger#Account'
    );
    expect(picker).toHaveValue('');
  });

  it('adds a concept whose label was typed in full when Enter is pressed', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'Account');
    fireEvent.keyDown(picker, { key: 'Enter' });

    expect(screen.getByTestId('new-class-mapping')).toHaveTextContent(
      'Exact match · https://example.org/ledger#Account'
    );
  });

  it('adds a pasted IRI when Enter is pressed and no option is focused', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'https://schema.org/Payment');
    fireEvent.keyDown(picker, { key: 'Enter' });

    expect(screen.getByTestId('new-class-mapping')).toHaveTextContent(
      'Exact match · https://schema.org/Payment'
    );
    expect(picker).toHaveValue('');
  });

  it('selects the focused option on Enter instead of adding the mapping', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'Acc');
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    await screen.findByRole('option', { name: /Account/ });
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    fireEvent.keyDown(picker, { key: 'Enter' });

    await waitFor(() => expect(picker).toHaveValue('Account'));

    expect(screen.queryByTestId('new-class-mapping')).not.toBeInTheDocument();
    expect(screen.getByTestId('new-class-add-mapping')).toBeEnabled();

    addMapping();

    expect(screen.getByTestId('new-class-mapping')).toHaveTextContent(
      'Exact match · https://example.org/ledger#Account'
    );
  });

  it('shows a loading row, then the matches of concepts that arrive after typing', async () => {
    let release: () => void = () => undefined;
    const arrival = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = get.getMockImplementation();
    get.mockImplementation(async (url: string, ...rest: unknown[]) => {
      if (url === '/ontologyConcepts') {
        await arrival;

        return { data: { data: [ledgerAccount], paging: {} } };
      }

      return base?.(url, ...rest);
    });
    setup();
    const picker = await screen.findByRole('combobox', {
      name: /^label\.concept-iri/,
    });
    type(picker, 'Acc');
    fireEvent.keyDown(picker, { key: 'ArrowDown' });

    expect(
      await screen.findByRole('option', { name: 'label.loading' })
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.queryByRole('option', { name: /Account/ })
    ).not.toBeInTheDocument();

    await act(async () => release());

    expect(
      await screen.findByRole('option', { name: /Account/ })
    ).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'label.loading' })
    ).not.toBeInTheDocument();
  });

  it('refuses the same mapping twice', async () => {
    setup();
    const picker = await mappingPicker();
    type(picker, 'https://schema.org/Payment');
    addMapping();
    type(picker, 'https://schema.org/Payment');

    expect(screen.getByTestId('new-class-add-mapping')).toBeDisabled();
    expect(
      screen.getByText('message.ontology-mapping-already-added')
    ).toBeVisible();
    expect(
      screen.queryByText('message.invalid-concept-iri')
    ).not.toBeInTheDocument();
  });

  it('keeps typed mapping text that is not a concept when Create is pressed without a blur', async () => {
    setup();
    fill('new-class-label', 'Remittance');
    const picker = await mappingPicker();
    type(picker, 'no such concept');
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });

    expect(
      within(screen.getByTestId('new-class-mapping-iri')).getByText(
        'message.invalid-concept-iri'
      )
    ).toBeVisible();
    expect(post).not.toHaveBeenCalledWith(
      '/ontologyChangeSets',
      expect.anything()
    );
    expect(picker).toHaveValue('no such concept');
  });

  it('creates the concept once with the mapping when the field repeats an added mapping', async () => {
    setup();
    fill('new-class-label', 'Remittance');
    const picker = await mappingPicker();
    type(picker, 'https://schema.org/Payment');
    addMapping();
    type(picker, 'https://schema.org/Payment');

    const concept = await createdConcept();

    expect(
      concept.conceptMappings.map(
        (mapping: { conceptIri: string }) => mapping.conceptIri
      )
    ).toEqual(['https://schema.org/Payment']);
  });
});

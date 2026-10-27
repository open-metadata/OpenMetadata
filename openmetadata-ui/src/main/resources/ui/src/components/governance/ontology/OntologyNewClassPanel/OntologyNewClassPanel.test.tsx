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
import { AxiosError, AxiosResponse } from 'axios';
import { useState } from 'react';
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
import OntologyNewClassPanel from './OntologyNewClassPanel';
jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
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
      {...props}
    />
  );
const fill = (id: string, value: string) =>
  fireEvent.change(screen.getByTestId(id), { target: { value } });

beforeEach(() => {
  jest.clearAllMocks();
  applied = false;
  reconcile.mockResolvedValue(false);
  useApplicationStore.setState({
    currentUser: { id: 'u', name: 'editor', email: 'editor@example.org' },
  });
  get.mockImplementation(async (url: string) => ({
    data: url.endsWith('/state') ? { workingRevision: 7 } : readDraft(url),
  }));
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

it('gates label, derives IRI, preserves manual local name, read-only layer and default owner', () => {
  setup({ canCreateProperty: false, canCreateAxiom: false });

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
  fill('new-class-source', 'https://example.org/source');
  fill('new-class-synonyms', 'Wire,');
  fireEvent.click(screen.getByRole('checkbox', { name: 'label.abstract' }));
  await act(async () => {
    fireEvent.click(screen.getByTestId('new-class-create'));
  });
  await waitFor(() =>
    expect(reconcile).toHaveBeenCalledWith(ontology.namespace + 'FundsTransfer')
  );
  const creates = () =>
    post.mock.calls.filter(([url]) => url === '/ontologyChangeSets');

  expect(creates()).toHaveLength(1);
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
  setup({ onLockChange: lockChanged });
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

  readable = true;
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
  });
  await waitFor(() =>
    expect(reconcile).toHaveBeenCalledWith(ontology.namespace + 'FundsTransfer')
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
        ontology.namespace + 'FundsTransfer'
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
        ontology.namespace + 'FundsTransfer'
      )
    );

    expect(changeSetCreates()).toHaveLength(1);
    expect(
      post.mock.calls.filter(([url]) => url.endsWith('/apply'))
    ).toHaveLength(2);
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
        ontology.namespace + 'WireTransfer'
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

    expect(screen.getByText('Identity')).toBeVisible();
    expect(screen.getByRole('textbox', { name: /^Label/ })).toBeVisible();
    expect(screen.getByText('Axioms')).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: /^Property name/ })
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Type/ }));
    await screen.findByRole('listbox');

    expect(document.body.textContent).not.toContain(MISSING_TRANSLATION_MARKER);
  });

  it('offers the property types by name', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Type/ }));
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
          />
        ) : null}
      </>
    );
  };

  it('moves to the label when the panel opens and back to the trigger when it closes', async () => {
    render(<Harness />);
    screen.getByTestId('trigger').focus();
    fireEvent.click(screen.getByTestId('trigger'));

    await waitFor(() =>
      expect(screen.getByTestId('new-class-label')).toHaveFocus()
    );

    fireEvent.click(screen.getByTestId('ontology-new-class-close'));

    expect(screen.getByTestId('trigger')).toHaveFocus();
  });
});

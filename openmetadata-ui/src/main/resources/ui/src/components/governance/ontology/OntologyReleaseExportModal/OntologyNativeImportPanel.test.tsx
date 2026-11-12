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
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
  CreateOntologyChangeSet,
  OperationState,
  OperationType,
} from '../../../../generated/api/data/createOntologyChangeSet';
import {
  Format,
  Kind,
  NativeOntologyImportSummary,
  SkipReason,
  Status,
} from '../../../../generated/api/data/nativeOntologyImportSummary';
import { OntologyChangeSetState } from '../../../../generated/entity/data/ontologyChangeSet';
import {
  applyOntologyChangeSet,
  createOntology,
  createOntologyChangeSet,
  detectNativeOntologyImportFormat,
  getOntologyByName,
  getOntologyChangeSet,
  previewNativeOntologyImport,
  previewNativeOntologyImportWithoutTarget,
} from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyNativeImportPanel from './OntologyNativeImportPanel';
import { NATIVE_IMPORT_MAX_BYTES } from './OntologyNativeImportPanel.utils';

jest.mock('../../../../rest/ontologyAPI', () => ({
  applyOntologyChangeSet: jest.fn(),
  createOntology: jest.fn(),
  createOntologyChangeSet: jest.fn(),
  detectNativeOntologyImportFormat: jest.fn(),
  getOntologyByName: jest.fn(),
  getOntologyChangeSet: jest.fn(),
  listOntologyChangeSets: jest.fn(),
  previewNativeOntologyImport: jest.fn(),
  previewNativeOntologyImportWithoutTarget: jest.fn(),
}));
const mockListed: unknown[] = [];
const mockIdentityOf = (listed: unknown[]) => (title: string) =>
  jest
    .requireActual('../OntologyCreateForm/OntologyCreateForm.utils')
    .generatedOntologyIdentity(title, 'https://open-metadata.org', listed);
jest.mock('../OntologyCreateForm/useOntologyIdentitySource', () => ({
  useOntologyIdentitySource: () => ({
    isReady: true,
    identityOf: mockIdentityOf([]),
    refreshIdentityOf: async () => mockIdentityOf(mockListed),
  }),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('../../../../hooks/governance/ontology/useOntologyEditLease', () => ({
  useOntologyEditLease: ({ resourceId }: { resourceId?: string }) => ({
    isOwned: Boolean(resourceId),
    lock: resourceId ? { sessionId: 'session-id', version: 2 } : undefined,
    state: 'owned',
  }),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => ({
      canEditAll: true,
      isLoading: false,
      error: null,
    }),
  })
);
jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (state: { currentUser: { id: string } }) => unknown
  ) => selector({ currentUser: { id: 'author' } }),
}));

const ontology = {
  id: 'ontology-id',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const summary: NativeOntologyImportSummary = {
  detectedFormat: Format.Turtle,
  ontologyLabel: 'Fibo sample',
  counts: {
    newConcepts: 42,
    updatedConcepts: 2,
    newProperties: 5,
    updatedProperties: 1,
    newRelations: 37,
    newMappings: 12,
    skippedDefinitions: 3,
    skippedRelations: 4,
  },
};
const changeSet: CreateOntologyChangeSet = {
  baseWorkingRevision: 4,
  description: 'Import',
  displayName: 'Import',
  name: 'import',
  ontology: 'Sales',
  operations: [
    {
      id: 'operation-id',
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
    },
  ],
};
const draft = {
  ...changeSet,
  id: 'draft-id',
  ontology: { id: ontology.id, type: 'ontology', fullyQualifiedName: 'Sales' },
  state: OntologyChangeSetState.Draft,
  undoCursor: 1,
};
const TURTLE = '@prefix ex: <https://example.org/> .\nex:A a ex:B .\n';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const Location = () => (
  <span data-testid="location">{useLocation().search}</span>
);

const renderPanel = (
  props: Partial<React.ComponentProps<typeof OntologyNativeImportPanel>> = {}
) => {
  const onApplied = jest.fn();
  renderWithQueryClient(
    <MemoryRouter
      initialEntries={['/governance/ontology?concept=c1&scope=all']}>
      <OntologyNativeImportPanel
        canImport
        ontology={ontology}
        onApplied={onApplied}
        onCancel={jest.fn()}
        {...props}
      />
      <Location />
    </MemoryRouter>
  );

  return { onApplied };
};

const dropFile = (name = 'fibo-sample.ttl', text = TURTLE, size?: number) => {
  const input = document.querySelector('input[type="file"]');
  if (!input) {
    throw new Error('Missing file input');
  }
  const file = new File([text], name);
  Object.defineProperty(file, 'text', {
    value: jest.fn().mockResolvedValue(text),
  });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  fireEvent.change(input, { target: { files: [file] } });

  return file;
};

const parse = () => screen.findByTestId('ontology-native-import-result');

describe('OntologyNativeImportPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (detectNativeOntologyImportFormat as jest.Mock).mockResolvedValue({
      detectedFormat: 'turtle',
    });
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue({
      summary,
      changeSet,
    });
    (previewNativeOntologyImportWithoutTarget as jest.Mock).mockResolvedValue(
      summary
    );
    (createOntology as jest.Mock).mockImplementation(async (request) => ({
      ...request,
      id: 'new-ontology-id',
      fullyQualifiedName: request.name,
    }));
    (createOntologyChangeSet as jest.Mock).mockResolvedValue(draft);
    (getOntologyChangeSet as jest.Mock).mockResolvedValue(draft);
    (applyOntologyChangeSet as jest.Mock).mockResolvedValue({
      ...draft,
      state: OntologyChangeSetState.Applied,
    });
  });

  it('names the detected format and dry-runs the file as soon as it is chosen', async () => {
    renderPanel();

    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
    expect(
      screen.getByTestId('ontology-native-import-summary')
    ).toHaveTextContent('message.ontology-import-supported-files');

    dropFile('misleading.csv', TURTLE);

    expect(
      await screen.findByTestId('ontology-native-import-format')
    ).toHaveTextContent('label.turtle');
    expect(detectNativeOntologyImportFormat).toHaveBeenCalledWith({
      data: TURTLE,
      fileName: 'misleading.csv',
    });

    await parse();

    expect(previewNativeOntologyImport).toHaveBeenCalledTimes(1);
    expect(previewNativeOntologyImport).toHaveBeenCalledWith('ontology-id', {
      data: TURTLE,
      fileName: 'misleading.csv',
    });
    expect(
      screen.getByTestId('ontology-native-import-file-name')
    ).toHaveTextContent('misleading.csv');
    expect(
      screen.getByTestId('ontology-native-import-file-card')
    ).toHaveTextContent('CSV');
    expect(screen.queryByTestId('ontology-native-import-parse')).toBeNull();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeEnabled();
  });

  it('goes back to the drop zone when the chosen file is removed', async () => {
    renderPanel();
    dropFile();
    await parse();

    await user.click(screen.getByTestId('ontology-native-import-clear'));

    expect(screen.queryByTestId('ontology-native-import-result')).toBeNull();
    expect(screen.queryByTestId('ontology-native-import-file-card')).toBeNull();
    expect(screen.getByTestId('ontology-native-import-file')).toBeVisible();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
  });

  it('cancels from the footer', async () => {
    const onCancel = jest.fn();
    renderPanel({ onCancel });

    await user.click(screen.getByTestId('ontology-native-import-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps one extra character so detection recognizes a truncated N-Triples sample', async () => {
    const source = '<urn:a> <urn:b> <urn:c> .\n'.repeat(4_000);

    renderPanel();
    dropFile('large.nt', source);

    await screen.findByTestId('ontology-native-import-format');

    expect(detectNativeOntologyImportFormat).toHaveBeenCalledWith({
      data: source.slice(0, 65_537),
      fileName: 'large.nt',
    });
  });

  it('parses the latest file when an earlier detection finishes last', async () => {
    let finishFirstDetection:
      | ((value: { detectedFormat: string }) => void)
      | undefined;
    (detectNativeOntologyImportFormat as jest.Mock).mockImplementation(
      ({ fileName }) =>
        fileName === 'first.ttl'
          ? new Promise((resolve) => {
              finishFirstDetection = resolve;
            })
          : Promise.resolve({ detectedFormat: Format.Turtle })
    );
    renderPanel();
    dropFile('first.ttl', 'first content');
    dropFile('second.ttl', 'second content');

    await screen.findByTestId('ontology-native-import-format');
    await parse();
    finishFirstDetection?.({ detectedFormat: Format.Turtle });

    await waitFor(() =>
      expect(previewNativeOntologyImport).toHaveBeenCalledTimes(1)
    );

    expect(previewNativeOntologyImport).toHaveBeenCalledWith('ontology-id', {
      data: 'second content',
      fileName: 'second.ttl',
    });
  });

  it('parses without persisting and shows the server counts', async () => {
    renderPanel();
    dropFile();
    await parse();

    expect(previewNativeOntologyImport).toHaveBeenCalledWith('ontology-id', {
      data: TURTLE,
      fileName: 'fibo-sample.ttl',
    });
    expect(
      screen.getByTestId('ontology-native-import-summary')
    ).toHaveTextContent('message.native-import-saved-as-draft');
    expect(
      screen.getByTestId('ontology-native-import-apply')
    ).toHaveTextContent('label.import');
    expect(createOntologyChangeSet).not.toHaveBeenCalled();
    expect(createOntology).not.toHaveBeenCalled();
  });

  it('shows new properties when they are the only importable changes', async () => {
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue({
      summary: {
        ...summary,
        counts: {
          ...summary.counts,
          newConcepts: 0,
          updatedConcepts: 0,
          updatedProperties: 0,
          newRelations: 0,
          newMappings: 0,
          skippedDefinitions: 0,
          skippedRelations: 0,
        },
      },
      changeSet,
    });
    renderPanel();
    dropFile();
    await parse();

    expect(
      screen.getByTestId('ontology-native-import-summary')
    ).toHaveTextContent('message.native-import-saved-as-draft');
    expect(screen.getByTestId('ontology-native-import-apply')).toBeEnabled();
  });

  it('says how many already-existing definitions the server left unlisted', async () => {
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue({
      summary: { ...summary, omittedItems: 4_990 },
      changeSet,
    });
    renderPanel();
    dropFile();
    await parse();

    expect(
      screen.getByTestId('ontology-native-import-items-omitted')
    ).toHaveTextContent('message.native-import-items-omitted');
  });

  it('lists what the server skipped, grouped by reason and predicate', async () => {
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue({
      summary: {
        ...summary,
        skippedStatements: {
          total: 3,
          omittedGroups: 2,
          groups: [
            {
              reason: SkipReason.UnsupportedAnnotation,
              predicate: 'http://www.w3.org/2000/01/rdf-schema#isDefinedBy',
              count: 2,
              subjects: ['https://example.org/A', 'https://example.org/B'],
            },
            {
              reason: SkipReason.Individual,
              count: 1,
              subjects: ['https://example.org/i'],
            },
          ],
        },
      },
      changeSet,
    });
    renderPanel();
    dropFile();
    await parse();

    const skipped = screen.getByTestId('ontology-native-import-skipped');

    expect(skipped).toHaveTextContent(
      'message.native-import-skipped-statements'
    );
    expect(skipped).toHaveTextContent(
      'label.skip-reason-unsupported-annotation'
    );
    expect(skipped).toHaveTextContent(
      'http://www.w3.org/2000/01/rdf-schema#isDefinedBy'
    );
    expect(skipped).toHaveTextContent(
      'https://example.org/A, https://example.org/B'
    );
    expect(skipped).toHaveTextContent('label.skip-reason-individual');
    expect(skipped).toHaveTextContent(
      'message.native-import-skipped-more-groups'
    );
  });

  it('shows no skipped disclosure when the server skipped nothing', async () => {
    renderPanel();
    dropFile();
    await parse();

    expect(
      screen.queryByTestId('ontology-native-import-skipped')
    ).not.toBeInTheDocument();
  });

  it('applies the previewed change set to the existing ontology under its lease', async () => {
    const { onApplied } = renderPanel();
    dropFile();
    await parse();
    await user.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    expect(createOntologyChangeSet).toHaveBeenCalledWith(changeSet);
    expect(applyOntologyChangeSet).toHaveBeenCalledWith('draft-id', {
      lease: { sessionId: 'session-id', version: 2 },
    });
    expect(showSuccessToast).toHaveBeenCalledWith('label.ontology-applied');
    expect(createOntology).not.toHaveBeenCalled();
  });

  it('warns that imported concepts enter Draft when the ontology has reviewers', async () => {
    renderPanel({
      ontology: {
        ...ontology,
        reviewers: [{ id: 'reviewer', type: 'user' }],
      },
    });
    dropFile();
    await parse();

    expect(
      screen.getByTestId('ontology-native-import-draft-notice')
    ).toHaveTextContent('message.native-import-enters-draft');
  });

  it('shows no Draft notice for an ontology without reviewers', async () => {
    renderPanel();
    dropFile();
    await parse();

    expect(
      screen.queryByTestId('ontology-native-import-draft-notice')
    ).toBeNull();
  });

  it('parses against an empty target and creates nothing before Import for a new ontology', async () => {
    renderPanel({ ontology: undefined });
    dropFile();
    await parse();

    expect(previewNativeOntologyImportWithoutTarget).toHaveBeenCalledWith({
      data: TURTLE,
      fileName: 'fibo-sample.ttl',
    });
    expect(previewNativeOntologyImport).not.toHaveBeenCalled();
    expect(createOntology).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('ontology-native-import-target')
    ).toHaveTextContent('label.new-ontology');
  });

  it('creates the new ontology on Import, applies into it, and lands on it', async () => {
    const { onApplied } = renderPanel({ ontology: undefined });
    dropFile();
    await parse();
    await user.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    const request = (createOntology as jest.Mock).mock.calls[0][0];

    expect(request.iri).toBe('https://open-metadata.org/onto/fibosamp');
    expect(request.namespace).toBe('https://open-metadata.org/onto/fibosamp#');
    expect(request.name).toBe('fibo-sample');
    expect(request.displayName).toBe('Fibo sample');
    expect(request.owners).toEqual([{ id: 'author', type: 'user' }]);
    expect(previewNativeOntologyImport).toHaveBeenCalledWith(
      'new-ontology-id',
      {
        data: TURTLE,
        fileName: 'fibo-sample.ttl',
      }
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '?ontology=new-ontology-id'
    );
    expect(
      within(screen.getByTestId('location')).queryByText(/concept|scope/)
    ).toBeNull();
  });

  it('never writes into an ontology that took the name after the panel opened', async () => {
    const taken = {
      id: 'old-ontology-id',
      name: 'fibo-sample',
      displayName: 'Fibo sample',
      iri: 'https://open-metadata.org/onto/fibosamp',
      namespace: 'https://open-metadata.org/onto/fibosamp#',
    };
    (createOntology as jest.Mock).mockRejectedValueOnce(
      Object.assign(new AxiosError('Conflict'), {
        response: { status: 409, data: { message: 'Entity already exists' } },
      })
    );
    (getOntologyByName as jest.Mock).mockResolvedValue({
      ...taken,
      fullyQualifiedName: taken.name,
    });
    renderPanel({ ontology: undefined });
    dropFile();
    await parse();
    await user.click(screen.getByTestId('ontology-native-import-apply'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'message.ontology-install-name-taken'
    );
    expect(previewNativeOntologyImport).not.toHaveBeenCalled();
    expect(createOntologyChangeSet).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).not.toHaveTextContent('ontology=');

    mockListed.push(taken);
    await user.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '?ontology=new-ontology-id'
      )
    );

    expect(createOntology).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: 'fibo-sample-2',
        displayName: 'Fibo sample (2)',
      })
    );

    mockListed.length = 0;
  });

  it('shows the server error that names a CSV row and creates nothing', async () => {
    const message = "CSV row 7, column iri: 'Customer' is not an absolute IRI";
    (previewNativeOntologyImportWithoutTarget as jest.Mock).mockRejectedValue(
      Object.assign(new AxiosError('Request failed'), {
        response: { status: 400, data: { message } },
      })
    );
    renderPanel({ ontology: undefined });
    dropFile('bad.csv', 'kind,iri\n');

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(createOntology).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
  });

  it('offers Retry when the dry run fails and previews the same file again', async () => {
    (previewNativeOntologyImport as jest.Mock).mockRejectedValueOnce(
      new Error('Network down')
    );
    renderPanel();
    dropFile();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'server.unexpected-error'
    );

    await user.click(screen.getByTestId('ontology-native-import-retry'));

    expect(await parse()).toBeVisible();
    expect(previewNativeOntologyImport).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByTestId('ontology-native-import-retry')
    ).not.toBeInTheDocument();
  });

  it('drops the parsed preview when a replacement file is too large', async () => {
    renderPanel();
    dropFile();
    await parse();
    dropFile('replacement.ttl', TURTLE, NATIVE_IMPORT_MAX_BYTES + 1);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'message.file-size-exceeded'
    );
    expect(screen.queryByTestId('ontology-native-import-result')).toBeNull();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
  });

  it('does not dry-run a file whose format cannot be detected', async () => {
    (detectNativeOntologyImportFormat as jest.Mock).mockResolvedValue({});
    renderPanel();
    dropFile('notes.ttl', 'just words');

    expect(
      await screen.findByText('message.native-import-format-undetected')
    ).toBeVisible();
    expect(previewNativeOntologyImport).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
  });

  it('shows the detection failure instead of an empty state', async () => {
    (detectNativeOntologyImportFormat as jest.Mock).mockRejectedValue(
      Object.assign(new AxiosError('Request failed'), {
        response: { status: 500, data: { message: 'Detector unavailable' } },
      })
    );
    renderPanel();
    dropFile();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Detector unavailable'
    );
  });

  it('does not import a file that changes nothing', async () => {
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue({
      summary: {
        ...summary,
        counts: {
          ...summary.counts,
          newConcepts: 0,
          updatedConcepts: 0,
          newProperties: 0,
          updatedProperties: 0,
          newRelations: 0,
          newMappings: 0,
        },
      },
      changeSet: { ...changeSet, operations: [] },
    });
    renderPanel();
    dropFile();
    await parse();

    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
  });

  it('dry-runs against the target chosen while the format was still being detected', async () => {
    let finishDetection:
      | ((value: { detectedFormat: string }) => void)
      | undefined;
    (detectNativeOntologyImportFormat as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishDetection = resolve;
        })
    );
    renderPanel();
    dropFile();

    await user.click(
      within(screen.getByTestId('ontology-native-import-target')).getByRole(
        'button'
      )
    );
    await user.click(
      await screen.findByRole('option', { name: 'label.new-ontology' })
    );
    finishDetection?.({ detectedFormat: Format.Turtle });

    await waitFor(() =>
      expect(previewNativeOntologyImportWithoutTarget).toHaveBeenCalledWith({
        data: TURTLE,
        fileName: 'fibo-sample.ttl',
      })
    );

    expect(previewNativeOntologyImport).not.toHaveBeenCalled();
  });

  it('describes importing into the ontology while it is the target', async () => {
    renderPanel();

    expect(screen.getByText('message.ontology-import-into-help')).toBeVisible();
    expect(
      screen.getByTestId('ontology-native-import-target')
    ).toHaveTextContent('Sales');
  });

  it('dry-runs again when the target switches to a new ontology and back, then imports into the ontology', async () => {
    const { onApplied } = renderPanel();
    dropFile();
    await parse();

    await user.click(
      within(screen.getByTestId('ontology-native-import-target')).getByRole(
        'button'
      )
    );
    await user.click(
      await screen.findByRole('option', { name: 'label.new-ontology' })
    );

    await waitFor(() =>
      expect(previewNativeOntologyImportWithoutTarget).toHaveBeenCalledWith({
        data: TURTLE,
        fileName: 'fibo-sample.ttl',
      })
    );

    await user.click(
      within(screen.getByTestId('ontology-native-import-target')).getByRole(
        'button'
      )
    );
    await user.click(await screen.findByRole('option', { name: 'Sales' }));

    await waitFor(() =>
      expect(previewNativeOntologyImport).toHaveBeenCalledTimes(2)
    );
    await parse();
    await user.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    expect(createOntologyChangeSet).toHaveBeenCalledWith(changeSet);
    expect(applyOntologyChangeSet).toHaveBeenCalledWith('draft-id', {
      lease: { sessionId: 'session-id', version: 2 },
    });
    expect(createOntology).not.toHaveBeenCalled();
  });

  it('rejects an oversized file before detection', async () => {
    renderPanel();
    dropFile('big.ttl', TURTLE, NATIVE_IMPORT_MAX_BYTES + 1);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'message.file-size-exceeded'
    );
    expect(detectNativeOntologyImportFormat).not.toHaveBeenCalled();
  });
});

describe('OntologyNativeImportPanel item review', () => {
  const itemSummary: NativeOntologyImportSummary = {
    ...summary,
    items: [
      {
        id: 'concept:https://example.org/Invoice',
        kind: Kind.Concept,
        label: 'Invoice',
        iri: 'https://example.org/Invoice',
        status: Status.New,
        operationId: 'op-invoice',
        conceptIds: [],
      },
      {
        id: 'concept:https://example.org/Payment',
        kind: Kind.Concept,
        label: 'Payment',
        iri: 'https://example.org/Payment',
        status: Status.New,
        operationId: 'op-payment',
        conceptIds: [],
      },
      {
        id: 'concept:https://example.org/Customer',
        kind: Kind.Concept,
        label: 'Customer',
        iri: 'https://example.org/Customer',
        status: Status.AlreadyExists,
        conceptIds: [],
      },
      {
        id: 'axiom:1111111111111111',
        kind: Kind.Rule,
        label: 'Invoice and Payment are disjoint',
        status: Status.New,
        operationId: 'op-rule',
        warning: 'Invoice and Payment would clash with an existing subclass',
        conceptIds: [],
      },
      {
        id: 'axiom:2222222222222222',
        kind: Kind.Relationship,
        label: 'Invoice relates to Payment',
        status: Status.Duplicate,
        reason: 'Stated twice in the file',
        conceptIds: [],
      },
    ],
  };
  const itemChangeSet: CreateOntologyChangeSet = {
    ...changeSet,
    operations: ['op-invoice', 'op-payment', 'op-rule'].map((id) => ({
      id,
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (detectNativeOntologyImportFormat as jest.Mock).mockResolvedValue({
      detectedFormat: 'turtle',
    });
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue({
      summary: itemSummary,
      changeSet: itemChangeSet,
    });
    let stored = draft;
    (createOntologyChangeSet as jest.Mock).mockImplementation(
      async (request: CreateOntologyChangeSet) => {
        stored = {
          ...draft,
          operations: request.operations,
          undoCursor: request.undoCursor ?? 0,
        };

        return stored;
      }
    );
    (getOntologyChangeSet as jest.Mock).mockImplementation(async () => stored);
    (applyOntologyChangeSet as jest.Mock).mockImplementation(async () => ({
      ...stored,
      state: OntologyChangeSetState.Applied,
    }));
  });

  it('lists every item under its kind with its status, reason and warning', async () => {
    renderPanel();
    dropFile();
    await parse();

    expect(
      screen.getByTestId('ontology-native-import-items-found')
    ).toHaveTextContent('message.native-import-items-found');

    expect(
      screen.getByTestId('ontology-native-import-group-CONCEPT')
    ).toHaveTextContent('Invoice');
    expect(
      within(
        screen.getByTestId('ontology-native-import-group-RELATIONSHIP')
      ).getByText('Invoice relates to Payment')
    ).toBeVisible();
    expect(
      screen.getByTestId(
        'ontology-native-import-item-status-concept:https://example.org/Customer'
      )
    ).toHaveTextContent('label.already-exists');
    expect(
      screen.getByTestId(
        'ontology-native-import-item-note-axiom:2222222222222222'
      )
    ).toHaveTextContent('Stated twice in the file');
    expect(
      screen.getByTestId(
        'ontology-native-import-item-warning-axiom:1111111111111111'
      )
    ).toHaveTextContent('Invoice and Payment would clash');
    expect(
      within(
        screen.getByTestId(
          'ontology-native-import-item-check-concept:https://example.org/Customer'
        )
      ).getByRole('checkbox')
    ).toBeDisabled();
  });

  it('applies only the operations of the items left ticked', async () => {
    const { onApplied } = renderPanel();
    dropFile();
    await parse();

    expect(screen.getByTestId('ontology-native-import-apply')).toBeEnabled();

    await user.click(
      within(
        screen.getByTestId(
          'ontology-native-import-item-check-concept:https://example.org/Payment'
        )
      ).getByRole('checkbox')
    );
    await user.click(
      within(
        screen.getByTestId(
          'ontology-native-import-item-check-axiom:1111111111111111'
        )
      ).getByRole('checkbox')
    );
    await user.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    const sent = (createOntologyChangeSet as jest.Mock).mock.calls[0][0];

    expect(sent.operations.map(({ id }: { id: string }) => id)).toEqual([
      'op-invoice',
    ]);
  });

  it('shows a part-ticked group as mixed and ticks the whole group from its checkbox', async () => {
    renderPanel();
    dropFile();
    await parse();
    const groupCheck = () =>
      within(
        screen.getByTestId('ontology-native-import-group-select-CONCEPT')
      ).getByRole('checkbox');

    expect(groupCheck()).toBeChecked();

    await user.click(
      within(
        screen.getByTestId(
          'ontology-native-import-item-check-concept:https://example.org/Payment'
        )
      ).getByRole('checkbox')
    );

    expect(groupCheck()).not.toBeChecked();
    expect(groupCheck()).toBePartiallyChecked();

    await user.click(groupCheck());

    expect(groupCheck()).toBeChecked();
    expect(
      within(
        screen.getByTestId(
          'ontology-native-import-item-check-concept:https://example.org/Payment'
        )
      ).getByRole('checkbox')
    ).toBeChecked();
  });

  it('disables Import once every item is unticked', async () => {
    renderPanel();
    dropFile();
    await parse();

    expect(
      screen.getByTestId('ontology-native-import-group-check-CONCEPT')
    ).toHaveTextContent('label.deselect-all');

    for (const kind of ['CONCEPT', 'RULE']) {
      await user.click(
        screen.getByTestId(`ontology-native-import-group-check-${kind}`)
      );
    }

    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
    expect(
      screen.getByTestId('ontology-native-import-group-check-CONCEPT')
    ).toHaveTextContent('label.select-all-lowercase');
    expect(
      screen.getByTestId('ontology-native-import-summary')
    ).toHaveTextContent('message.native-import-nothing-selected');
  });
});

describe('OntologyNativeImportPanel dependents of an unticked concept', () => {
  const ACCOUNT = 'concept:https://example.org/Account';
  const LEDGER = 'concept:https://example.org/Ledger';
  const LINK = 'axiom:aaaaaaaaaaaaaaaa';
  const RULE = 'axiom:bbbbbbbbbbbbbbbb';
  const OWNS = 'property:https://example.org/owns';
  const itemSummary: NativeOntologyImportSummary = {
    ...summary,
    items: [
      {
        id: ACCOUNT,
        kind: Kind.Concept,
        label: 'Account',
        iri: 'https://example.org/Account',
        status: Status.New,
        operationId: 'op-account',
        conceptIds: [],
      },
      {
        id: LEDGER,
        kind: Kind.Concept,
        label: 'Ledger',
        iri: 'https://example.org/Ledger',
        status: Status.New,
        operationId: 'op-ledger',
        conceptIds: [],
      },
      {
        id: LINK,
        kind: Kind.Relationship,
        label: 'Ledger is a kind of Account',
        iri: 'https://example.org/Ledger',
        status: Status.New,
        operationId: 'op-link',
        dependsOnIris: [
          'https://example.org/Account',
          'https://example.org/Ledger',
        ],
        conceptIds: [],
      },
      {
        id: RULE,
        kind: Kind.Rule,
        label: 'Account and Ledger are disjoint',
        iri: 'https://example.org/Account',
        status: Status.New,
        operationId: 'op-rule',
        dependsOnIris: [
          'https://example.org/Account',
          'https://example.org/Ledger',
        ],
        conceptIds: [],
      },
      {
        id: OWNS,
        kind: Kind.Property,
        label: 'owns',
        iri: 'https://example.org/owns',
        status: Status.New,
        operationId: 'op-owns',
        dependsOnIris: ['https://example.org/Ledger'],
        conceptIds: [],
      },
    ],
  };
  const check = (id: string) =>
    within(
      screen.getByTestId(`ontology-native-import-item-check-${id}`)
    ).getByRole('checkbox');

  beforeEach(() => {
    jest.clearAllMocks();
    (detectNativeOntologyImportFormat as jest.Mock).mockResolvedValue({
      detectedFormat: 'turtle',
    });
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue({
      summary: itemSummary,
      changeSet: {
        ...changeSet,
        operations: [
          'op-account',
          'op-ledger',
          'op-link',
          'op-rule',
          'op-owns',
        ].map((id) => ({
          id,
          operationType: OperationType.UpsertConcept,
          state: OperationState.Active,
        })),
      },
    });
    let stored = draft;
    (createOntologyChangeSet as jest.Mock).mockImplementation(
      async (request: CreateOntologyChangeSet) => {
        stored = {
          ...draft,
          operations: request.operations,
          undoCursor: request.undoCursor ?? 0,
        };

        return stored;
      }
    );
    (getOntologyChangeSet as jest.Mock).mockImplementation(async () => stored);
    (applyOntologyChangeSet as jest.Mock).mockImplementation(async () => ({
      ...stored,
      state: OntologyChangeSetState.Applied,
    }));
  });

  it('unticks the relationship and rule that use the concept and says so', async () => {
    renderPanel();
    dropFile();
    await parse();

    await user.click(check(ACCOUNT));

    expect(check(LINK)).not.toBeChecked();
    expect(check(RULE)).not.toBeChecked();
    expect(check(LEDGER)).toBeChecked();
    expect(
      screen.getByTestId('ontology-native-import-unticked-notice')
    ).toHaveTextContent(
      'message.native-import-also-unticked-relationshipmessage.native-import-also-unticked-rule'
    );
    expect(
      screen.getByTestId('ontology-native-import-apply')
    ).toHaveTextContent('label.import-change-count');
  });

  it('unticks a property whose domain or range is the concept and says so', async () => {
    renderPanel();
    dropFile();
    await parse();

    await user.click(check(LEDGER));

    expect(check(OWNS)).not.toBeChecked();
    expect(check(OWNS)).toBeDisabled();
    expect(check(ACCOUNT)).toBeChecked();
    expect(
      screen.getByTestId('ontology-native-import-unticked-notice')
    ).toHaveTextContent(
      'message.native-import-also-unticked-relationshipmessage.native-import-also-unticked-rulemessage.native-import-also-unticked-property'
    );
  });

  it('keeps them unticked and unavailable until the concept is ticked, then lets the user tick them', async () => {
    renderPanel();
    dropFile();
    await parse();
    await user.click(check(ACCOUNT));

    expect(check(LINK)).toBeDisabled();
    expect(
      screen.getByTestId(`ontology-native-import-item-needs-${LINK}`)
    ).toHaveTextContent('message.native-import-needs-concept');

    await user.click(check(ACCOUNT));

    expect(check(ACCOUNT)).toBeChecked();
    expect(check(LINK)).not.toBeChecked();
    expect(check(LINK)).toBeEnabled();
    expect(
      screen.queryByTestId('ontology-native-import-unticked-notice')
    ).not.toBeInTheDocument();

    await user.click(check(LINK));

    expect(check(LINK)).toBeChecked();
  });

  it('sends only the operations of what stays ticked', async () => {
    const { onApplied } = renderPanel();
    dropFile();
    await parse();
    await user.click(check(ACCOUNT));
    await user.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    expect(
      (createOntologyChangeSet as jest.Mock).mock.calls[0][0].operations.map(
        ({ id }: { id: string }) => id
      )
    ).toEqual(['op-ledger', 'op-owns']);
  });

  it('unticks the dependents of every concept when the concept group is unticked', async () => {
    renderPanel();
    dropFile();
    await parse();

    await user.click(
      screen.getByTestId('ontology-native-import-group-check-CONCEPT')
    );

    expect(check(LINK)).not.toBeChecked();
    expect(check(RULE)).not.toBeChecked();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
  });
});

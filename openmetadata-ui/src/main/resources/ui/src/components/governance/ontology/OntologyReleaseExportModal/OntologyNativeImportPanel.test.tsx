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
  NativeOntologyImportSummary,
} from '../../../../generated/api/data/nativeOntologyImportSummary';
import { OntologyChangeSetState } from '../../../../generated/entity/data/ontologyChangeSet';
import {
  applyOntologyChangeSet,
  createOntology,
  createOntologyChangeSet,
  detectNativeOntologyImportFormat,
  getOntologyChangeSet,
  previewNativeOntologyImport,
  previewNativeOntologyImportWithoutTarget,
} from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyNativeImportPanel from './OntologyNativeImportPanel';

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
        {...props}
      />
      <Location />
    </MemoryRouter>
  );

  return { onApplied };
};

const dropFile = (name = 'fibo-sample.ttl', text = TURTLE) => {
  const input = document.querySelector('input[type="file"]');
  if (!input) {
    throw new Error('Missing file input');
  }
  const file = new File([text], name);
  Object.defineProperty(file, 'text', {
    value: jest.fn().mockResolvedValue(text),
  });
  fireEvent.change(input, { target: { files: [file] } });

  return file;
};

const parse = async () => {
  await user.click(await screen.findByTestId('ontology-native-import-parse'));
  await screen.findByTestId('ontology-native-import-result');
};

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

  it('names the detected format before anything is parsed', async () => {
    renderPanel();
    dropFile('misleading.csv', TURTLE);

    expect(
      await screen.findByTestId('ontology-native-import-format')
    ).toHaveTextContent('label.turtle');
    expect(detectNativeOntologyImportFormat).toHaveBeenCalledWith({
      data: TURTLE,
      fileName: 'misleading.csv',
    });
    expect(previewNativeOntologyImport).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ontology-native-import-result')).toBeNull();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
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
    finishFirstDetection?.({ detectedFormat: Format.Turtle });
    await parse();

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
      screen.getByText('message.native-import-nothing-persisted')
    ).toBeVisible();
    expect(
      screen.getByTestId('ontology-native-import-count-new-concepts')
    ).toHaveTextContent('42');
    expect(
      screen.getByTestId('ontology-native-import-count-relations')
    ).toHaveTextContent('37');
    expect(
      screen.getByTestId('ontology-native-import-count-new-properties')
    ).toHaveTextContent('5');
    expect(
      screen.getByTestId('ontology-native-import-count-mappings')
    ).toHaveTextContent('12');
    expect(
      screen.getByTestId('ontology-native-import-count-skipped')
    ).toHaveTextContent('3');
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
      screen.getByTestId('ontology-native-import-count-new-properties')
    ).toHaveTextContent('5');
    expect(screen.getByTestId('ontology-native-import-apply')).toBeEnabled();
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
      screen.getByTestId('ontology-native-import-count-new-concepts')
    ).toHaveTextContent('42');
  });

  it('creates the new ontology on Import, applies into it, and lands on it', async () => {
    const { onApplied } = renderPanel({ ontology: undefined });
    dropFile();
    await parse();
    await user.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    const request = (createOntology as jest.Mock).mock.calls[0][0];

    expect(request.iri).toMatch(/^urn:openmetadata:ontology:[0-9a-f-]{36}$/);
    expect(request.name).toMatch(/^fibo-sample-[0-9a-f-]{36}$/);
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

  it('shows the server error that names a CSV row and creates nothing', async () => {
    const message = "CSV row 7, column iri: 'Customer' is not an absolute IRI";
    (previewNativeOntologyImportWithoutTarget as jest.Mock).mockRejectedValue(
      Object.assign(new AxiosError('Request failed'), {
        response: { status: 400, data: { message } },
      })
    );
    renderPanel({ ontology: undefined });
    dropFile('bad.csv', 'kind,iri\n');
    await user.click(await screen.findByTestId('ontology-native-import-parse'));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(createOntology).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
  });

  it('does not offer Parse when the format cannot be detected', async () => {
    (detectNativeOntologyImportFormat as jest.Mock).mockResolvedValue({});
    renderPanel();
    dropFile('notes.ttl', 'just words');

    expect(
      await screen.findByText('message.native-import-format-undetected')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-native-import-parse')).toBeDisabled();
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
});

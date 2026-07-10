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

import { fireEvent, render, screen } from '@testing-library/react';
import {
  ContextFile,
  ProcessingStatus,
} from '../../../generated/entity/data/contextFile';
import { getListContextMemories } from '../../../rest/contextMemoryAPI';
import DocumentPreviewPanel from './DocumentPreviewPanel.component';

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getListContextMemories: jest.fn(),
}));

jest.mock('../../CopyLinkButton/CopyLinkButton.component', () =>
  jest.fn(() => <span data-testid="copy-link" />)
);

jest.mock('../DocumentStatusBadge/DocumentStatusBadge.component', () =>
  jest.fn(() => <span data-testid="status-badge" />)
);

jest.mock('../CreateMemoryModal/CreateMemoryModal.component', () =>
  jest.fn(({ isOpen, memoryToEdit, viewOnly }) =>
    isOpen && viewOnly ? (
      <div data-testid="view-memory-modal">{memoryToEdit?.title}</div>
    ) : null
  )
);

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { name: 'admin', isAdmin: true },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGetListContextMemories = getListContextMemories as jest.Mock;

const file: ContextFile = {
  id: 'file-1',
  name: 'report.pdf',
  fileSize: 1024,
  processingStatus: ProcessingStatus.Processed,
};

describe('DocumentPreviewPanel', () => {
  beforeEach(() => {
    mockGetListContextMemories.mockResolvedValue({
      data: [
        {
          id: 'm1',
          name: 'pill-1',
          title: 'VAT policy',
          question: 'What is the VAT rate?',
        },
        { id: 'm2', name: 'pill-2', title: 'Refund window' },
      ],
      paging: { total: 2 },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists the memories extracted from the file', async () => {
    render(
      <DocumentPreviewPanel file={file} url="http://x" onClose={jest.fn()} />
    );

    expect(await screen.findByText('VAT policy')).toBeInTheDocument();
    expect(screen.getByText('What is the VAT rate?')).toBeInTheDocument();
    expect(screen.getByText('Refund window')).toBeInTheDocument();
    expect(mockGetListContextMemories).toHaveBeenCalledWith({
      sourceEntityId: 'file-1',
      fields: 'owners,sourceEntity',
      limit: 50,
    });
  });

  it('opens the view-only memory modal when a memory is clicked', async () => {
    render(
      <DocumentPreviewPanel file={file} url="http://x" onClose={jest.fn()} />
    );

    fireEvent.click(await screen.findByTestId('extracted-memory-m1'));

    expect(screen.getByTestId('view-memory-modal')).toHaveTextContent(
      'VAT policy'
    );
  });

  it('shows an empty message when the file has no memories', async () => {
    mockGetListContextMemories.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    render(
      <DocumentPreviewPanel file={file} url="http://x" onClose={jest.fn()} />
    );

    expect(await screen.findByText('label.no-entity')).toBeInTheDocument();
  });

  it('shows the processing error for a failed file', async () => {
    render(
      <DocumentPreviewPanel
        file={{
          ...file,
          processingStatus: ProcessingStatus.Failed,
          processingError: 'Object storage is not configured',
        }}
        url="http://x"
        onClose={jest.fn()}
      />
    );

    expect(await screen.findByTestId('processing-error')).toHaveTextContent(
      'Object storage is not configured'
    );
  });
});

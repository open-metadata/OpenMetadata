/*
 *  Copyright 2024 Collate.
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
import { act } from 'react';
import { PageType } from '../../../generated/system/ui/page';
import { mockedGlossaryTerms } from '../../../mocks/Glossary.mock';
import ChangeParent from './ChangeParentHierarchy.component';

const mockOnCancel = jest.fn();

const mockProps = {
  selectedData: {
    ...mockedGlossaryTerms[0],
    children: mockedGlossaryTerms[0].children?.map((child) => ({
      id: child.id,
      name: child.name,
      displayName: child.displayName,
      description: child.description,
      fullyQualifiedName: child.fullyQualifiedName,
      type: PageType.GlossaryTerm, // Required field for EntityReference
      deleted: (child as { deleted?: boolean }).deleted || false,
    })),
  },
  onCancel: mockOnCancel,
};

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
};

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn(() => ({ socket: mockSocket })),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  moveGlossaryTerm: jest.fn().mockImplementation(() =>
    Promise.resolve({
      jobId: 'test-job-id',
      message: 'Move operation started',
    })
  ),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockImplementation((obj) => obj.name),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('Test ChangeParentHierarchy modal component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the parent picker', async () => {
    await act(async () => {
      render(<ChangeParent {...mockProps} />);
    });

    // The picker loads glossaries and their terms itself.
    expect(screen.getByTestId('change-parent-select')).toBeInTheDocument();
  });

  it('should trigger onCancel button', async () => {
    await act(async () => {
      render(<ChangeParent {...mockProps} />);
    });

    const cancelButton = await screen.findByText('label.cancel');

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should keep save disabled until a parent is selected', async () => {
    await act(async () => {
      render(<ChangeParent {...mockProps} />);
    });

    const submitButton = await screen.findByTestId('save-button');

    expect(submitButton).toHaveTextContent('label.save');
    // No parent picked yet, so there is nothing to move.
    expect(submitButton).toBeDisabled();
  });

  it('should set up websocket listener when move job is created', async () => {
    await act(async () => {
      render(<ChangeParent {...mockProps} />);
    });

    // Component should set up websocket listeners
    expect(mockSocket.on).toHaveBeenCalledWith(
      'moveGlossaryTermChannel',
      expect.any(Function)
    );
  });

  it('should ignore a move completion for a job it did not start', async () => {
    await act(async () => {
      render(<ChangeParent {...mockProps} />);
    });

    const [, onMoveUpdate] = mockSocket.on.mock.calls.find(
      ([channel]) => channel === 'moveGlossaryTermChannel'
    ) as [string, (message: string) => void];

    // The server addresses this channel to the user, so a move finished in any
    // other session of theirs lands here too. Honouring it would navigate this
    // dialog away to a term the user never asked for.
    await act(async () => {
      onMoveUpdate(
        JSON.stringify({
          jobId: 'a-job-this-modal-never-started',
          status: 'COMPLETED',
          message: 'Move completed',
          fullyQualifiedName: 'someone.elses.term',
        })
      );
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockOnCancel).not.toHaveBeenCalled();
  });
});

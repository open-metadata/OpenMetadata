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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createFolder } from 'rest/assetAPI';
import CreateFolderModal from './CreateFolderModal.component';

jest.mock('rest/assetAPI', () => ({
  createFolder: jest.fn(),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      onPress,
      isDisabled,
      isLoading,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      isDisabled?: boolean;
      isLoading?: boolean;
      'data-testid'?: string;
    }) => (
      <button
        data-loading={String(isLoading)}
        data-testid={testId}
        disabled={isDisabled}
        onClick={onPress}>
        {children}
      </button>
    )
  ),
  Dialog: Object.assign(
    jest.fn(
      ({
        children,
        title,
        onClose,
      }: {
        children: React.ReactNode;
        title: string;
        onClose: () => void;
      }) => (
        <div data-testid="dialog">
          <span>{title}</span>
          <button data-testid="dialog-close" onClick={onClose}>
            close
          </button>
          {children}
        </div>
      )
    ),
    {
      Content: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
    }
  ),
  Input: jest.fn(
    ({
      value,
      onChange,
      'data-testid': testId,
      placeholder,
    }: {
      value: string;
      onChange: (v: string) => void;
      'data-testid'?: string;
      placeholder?: string;
    }) => (
      <input
        data-testid={testId}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  ),
  Modal: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  ModalOverlay: jest.fn(
    ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
      isOpen ? <div data-testid="modal-overlay">{children}</div> : null
  ),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onCreated: jest.fn(),
};

describe('CreateFolderModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<CreateFolderModal {...defaultProps} />);

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<CreateFolderModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
  });

  it('renders the folder name input', () => {
    render(<CreateFolderModal {...defaultProps} />);

    expect(screen.getByTestId('folder-name-input')).toBeInTheDocument();
  });

  it('create button is disabled when input is empty', () => {
    render(<CreateFolderModal {...defaultProps} />);

    expect(screen.getByTestId('create-folder-btn')).toBeDisabled();
  });

  it('create button is disabled when input is only whitespace', () => {
    render(<CreateFolderModal {...defaultProps} />);

    fireEvent.change(screen.getByTestId('folder-name-input'), {
      target: { value: '   ' },
    });

    expect(screen.getByTestId('create-folder-btn')).toBeDisabled();
  });

  it('create button is enabled when input has a valid name', () => {
    render(<CreateFolderModal {...defaultProps} />);

    fireEvent.change(screen.getByTestId('folder-name-input'), {
      target: { value: 'My Folder' },
    });

    expect(screen.getByTestId('create-folder-btn')).not.toBeDisabled();
  });

  it('calls createFolder with trimmed name on submit', async () => {
    const folder = {
      id: 'folder-1',
      name: 'my-folder',
      displayName: 'My Folder',
    };
    (createFolder as jest.Mock).mockResolvedValue(folder);

    render(<CreateFolderModal {...defaultProps} />);

    fireEvent.change(screen.getByTestId('folder-name-input'), {
      target: { value: '  My Folder  ' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-folder-btn'));
    });

    expect(createFolder).toHaveBeenCalledWith({
      name: 'My Folder',
      displayName: 'My Folder',
    });
  });

  it('calls onCreated with the returned folder on success', async () => {
    const folder = {
      id: 'folder-1',
      name: 'my-folder',
      displayName: 'My Folder',
    };
    (createFolder as jest.Mock).mockResolvedValue(folder);

    render(<CreateFolderModal {...defaultProps} />);

    fireEvent.change(screen.getByTestId('folder-name-input'), {
      target: { value: 'My Folder' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-folder-btn'));
    });

    await waitFor(() =>
      expect(defaultProps.onCreated).toHaveBeenCalledWith(folder)
    );
  });

  it('calls onClose after successful creation', async () => {
    const folder = { id: 'folder-1', name: 'my-folder' };
    (createFolder as jest.Mock).mockResolvedValue(folder);

    render(<CreateFolderModal {...defaultProps} />);

    fireEvent.change(screen.getByTestId('folder-name-input'), {
      target: { value: 'My Folder' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-folder-btn'));
    });

    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalled());
  });

  it('resets the input after successful creation', async () => {
    const folder = { id: 'folder-1', name: 'my-folder' };
    (createFolder as jest.Mock).mockResolvedValue(folder);

    render(<CreateFolderModal {...defaultProps} />);

    const input = screen.getByTestId('folder-name-input');
    fireEvent.change(input, { target: { value: 'My Folder' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-folder-btn'));
    });

    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('does not call createFolder when name is empty', async () => {
    render(<CreateFolderModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-folder-btn'));
    });

    expect(createFolder).not.toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<CreateFolderModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/cancel/i));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when dialog close button is clicked', () => {
    render(<CreateFolderModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('dialog-close'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

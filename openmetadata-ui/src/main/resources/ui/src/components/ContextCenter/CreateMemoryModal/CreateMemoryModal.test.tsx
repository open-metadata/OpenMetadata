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
import { render, screen } from '@testing-library/react';
import CreateMemoryModal from './CreateMemoryModal.component';

jest.mock('../../../rest/contextMemoryAPI', () => ({
  createContextMemory: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>
  ),
  Dialog: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    {
      Content: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
    }
  ),
  Input: jest.fn(
    ({
      'data-testid': testId,
      value,
      onChange,
    }: {
      'data-testid'?: string;
      value?: string;
      onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    }) => <input data-testid={testId} value={value} onChange={onChange} />
  ),
  Modal: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  ModalOverlay: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Select: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    {
      Item: jest.fn(({ label }: { label: string }) => <option>{label}</option>),
    }
  ),
  TextArea: jest.fn(
    ({
      'data-testid': testId,
      value,
      onChange,
    }: {
      'data-testid'?: string;
      value?: string;
      onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    }) => <textarea data-testid={testId} value={value} onChange={onChange} />
  ),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

describe('CreateMemoryModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onCreated: jest.fn(),
  };

  it('renders question and answer inputs', () => {
    render(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-question-input')).toBeInTheDocument();
    expect(screen.getByTestId('memory-answer-input')).toBeInTheDocument();
  });

  it('renders title and type inputs', () => {
    render(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('memory-type-select')).toBeInTheDocument();
  });
});

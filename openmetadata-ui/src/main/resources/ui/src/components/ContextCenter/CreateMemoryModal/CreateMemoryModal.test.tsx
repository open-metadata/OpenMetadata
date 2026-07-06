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
import React from 'react';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import CreateMemoryModal from './CreateMemoryModal.component';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('react-router-dom', () => ({
  Link: jest.fn(
    ({
      children,
      to,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      to: string;
      'data-testid'?: string;
    }) => (
      <a data-testid={testId} href={to}>
        {children}
      </a>
    )
  ),
}));

jest.mock(
  '../../../components/common/MarkdownEditor/markdownComponents',
  () => ({
    getCustomMarkdownComponents: jest.fn(() => ({})),
    preprocessMarkdownText: jest.fn((text: string) => text),
  })
);

jest.mock('../../../rest/contextMemoryAPI', () => ({
  createContextMemory: jest.fn(),
  updateContextMemory: jest.fn(),
  deleteContextMemory: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  getEntityIcon: jest.fn(() => null),
}));

jest.mock('../../../utils/TagClassBase', () => ({
  getTags: jest.fn(() => Promise.resolve({ data: [], paging: {} })),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../utils/date-time/DateTimeUtils'),
  formatDate: jest.fn(() => 'Jan 1, 2026'),
}));

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () =>
  jest.fn(({ userName }: { userName: string }) => <span>{userName}</span>)
);

jest.mock(
  '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList',
  () => jest.fn(() => <div data-testid="data-asset-select-list" />)
);

jest.mock(
  '../../../components/Tag/TagsSelectForm/TagsSelectForm.component',
  () => jest.fn(() => <div data-testid="tag-select-form" />)
);

jest.mock('../DerivedOntologyCard/DerivedOntologyCard.component', () =>
  jest.fn(() => <div data-testid="derived-ontology-card" />)
);

jest.mock('antd', () => ({
  ConfigProvider: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
  Form: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <form>{children}</form>
    )),
    {
      Item: jest.fn(({ children }: { children: React.ReactNode }) => (
        <>{children}</>
      )),
    }
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Alert: jest.fn(({ title }: { title: string }) => (
    <div role="alert">{title}</div>
  )),
  Badge: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  BadgeWithButton: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>
  ),
  ButtonUtility: jest.fn(({ onClick }: { onClick?: () => void }) => (
    <button onClick={onClick}>x</button>
  )),
  Card: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
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
  Dot: jest.fn(() => <span />),
  Input: jest.fn(
    ({
      'data-testid': testId,
      value,
      onChange,
    }: {
      'data-testid'?: string;
      value?: string;
      onChange?: (val: string) => void;
    }) => (
      <input
        data-testid={testId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  ),
  Modal: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  ModalOverlay: jest.fn(
    ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
      isOpen ? <div>{children}</div> : null
  ),
  Select: Object.assign(
    jest.fn(
      ({
        'data-testid': testId,
        children,
      }: {
        'data-testid'?: string;
        children?: React.ReactNode;
      }) => <div data-testid={testId}>{children}</div>
    ),
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
      onChange?: (val: string) => void;
    }) => (
      <textarea
        data-testid={testId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  ),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
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

  it('renders the content input', () => {
    render(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-content-input')).toBeInTheDocument();
  });

  it('renders title and type inputs', () => {
    render(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('memory-type-select')).toBeInTheDocument();
  });

  it('links a file-extracted memory to its source document', () => {
    const memoryToEdit = {
      id: 'm1',
      name: 'pill-1',
      sourceFile: { id: 'f1', type: 'contextFile', name: 'policy.pdf' },
    } as unknown as ContextMemory;

    render(
      <CreateMemoryModal
        {...defaultProps}
        viewOnly
        memoryToEdit={memoryToEdit}
      />
    );

    const link = screen.getByTestId('memory-source-file-link');

    expect(link).toHaveTextContent('policy.pdf');
    expect(link).toHaveAttribute(
      'href',
      '/context-center/documents?document=f1'
    );
  });

  it('renders no source link for a manually created memory', () => {
    const memoryToEdit = {
      id: 'm2',
      name: 'manual-memory',
    } as unknown as ContextMemory;

    render(
      <CreateMemoryModal
        {...defaultProps}
        viewOnly
        memoryToEdit={memoryToEdit}
      />
    );

    expect(
      screen.queryByTestId('memory-source-file-link')
    ).not.toBeInTheDocument();
  });
});

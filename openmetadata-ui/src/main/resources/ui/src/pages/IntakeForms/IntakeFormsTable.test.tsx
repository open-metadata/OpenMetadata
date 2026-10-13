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
import React from 'react';
import {
  FieldKind,
  IntakeForm,
  TargetEntityType,
} from '../../generated/governance/intakeForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Loader path: from src/pages/IntakeForms/, go up 2 → src/, then components/common/Loader/Loader
jest.mock('../../components/common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

jest.mock('../../utils/IntakeFormUtils', () => ({
  getIntakeFormFields: jest.fn((form: IntakeForm) => form.formFields ?? []),
  ENTITY_TYPE_LABEL_KEYS: {
    dataProduct: 'label.data-product',
    domain: 'label.domain',
    glossaryTerm: 'label.glossary-term',
  },
}));

jest.mock('../../constants/constants', () => ({
  NO_DATA_PLACEHOLDER: '--',
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Edit01: () => <svg />,
  Trash01: () => <svg />,
}));

// Inline Table with sub-components to avoid JSX factory issues
jest.mock('@openmetadata/ui-core-components', () => {
  const TableRow = ({
    children,
    id,
    'data-testid': testId,
  }: {
    children?: React.ReactNode;
    id?: string;
    'data-testid'?: string;
  }) => (
    <tr data-testid={testId} id={id}>
      {children}
    </tr>
  );

  const TableCell = ({ children }: { children?: React.ReactNode }) => (
    <td>{children}</td>
  );

  const TableHead = ({
    label,
  }: {
    label?: string;
    id?: string;
    isRowHeader?: boolean;
  }) => <th>{label}</th>;

  const TableHeader = ({
    children,
    columns,
  }: {
    children: (col: { id: string; name: string }) => React.ReactNode;
    columns: Array<{ id: string; name: string }>;
  }) => (
    <thead>
      <tr>{columns.map((col) => children(col))}</tr>
    </thead>
  );

  const TableBody = ({
    items,
    children,
    renderEmptyState,
  }: {
    items: unknown[];
    children: (item: IntakeForm) => React.ReactNode;
    renderEmptyState?: () => React.ReactNode;
  }) => (
    <tbody>
      {items.length === 0 && renderEmptyState
        ? renderEmptyState()
        : (items as IntakeForm[]).map((item) => children(item))}
    </tbody>
  );

  const Table = Object.assign(
    ({
      children,
      'aria-label': label,
      'data-testid': testId,
    }: {
      children?: React.ReactNode;
      'aria-label'?: string;
      'data-testid'?: string;
    }) => (
      <table aria-label={label} data-testid={testId}>
        {children}
      </table>
    ),
    {
      Header: TableHeader,
      Head: TableHead,
      Body: TableBody,
      Row: TableRow,
      Cell: TableCell,
    }
  );

  return {
    Badge: ({ children }: { children?: React.ReactNode }) => (
      <span>{children}</span>
    ),
    Box: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    Button: ({
      children,
      onClick,
      'data-testid': testId,
    }: {
      children?: React.ReactNode;
      onClick?: React.MouseEventHandler;
      'data-testid'?: string;
    }) => (
      <button data-testid={testId} onClick={onClick}>
        {children}
      </button>
    ),
    Table,
    TableCard: {
      Root: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
    },
    Toggle: ({
      isSelected,
      onChange,
      'data-testid': testId,
    }: {
      isSelected?: boolean;
      onChange?: (v: boolean) => void;
      'data-testid'?: string;
    }) => (
      <input
        aria-label="toggle"
        checked={isSelected}
        data-testid={testId}
        type="checkbox"
        onChange={(e) => onChange?.(e.target.checked)}
      />
    ),
    Tooltip: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Typography: ({ children }: { children?: React.ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

import IntakeFormsTable from './IntakeFormsTable';

const mockOnEdit = jest.fn();
const mockOnDelete = jest.fn();
const mockOnToggleEnabled = jest.fn();

const mockForms: IntakeForm[] = [
  {
    id: 'form-1',
    name: 'dataProduct',
    entityType: TargetEntityType.DataProduct,
    enabled: true,
    formFields: [
      {
        fieldPath: 'extension.myProp',
        fieldLabel: 'My Prop',
        fieldKind: FieldKind.CustomProperty,
        required: true,
      },
    ],
    requiredFields: [],
  },
  {
    id: 'form-2',
    name: 'domain',
    entityType: TargetEntityType.Domain,
    enabled: false,
    formFields: [],
    requiredFields: [],
  },
];

const renderTable = (forms = mockForms, loading = false) =>
  render(
    <IntakeFormsTable
      forms={forms}
      loading={loading}
      onDelete={mockOnDelete}
      onEdit={mockOnEdit}
      onToggleEnabled={mockOnToggleEnabled}
    />
  );

describe('IntakeFormsTable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a row for each form', () => {
    renderTable();

    expect(
      screen.getByTestId(`row-${TargetEntityType.DataProduct}`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`row-${TargetEntityType.Domain}`)
    ).toBeInTheDocument();
  });

  it('shows the loader when loading=true with no items', () => {
    renderTable([], true);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders field badge text for forms with fields', () => {
    renderTable();

    // The badge renders fieldLabel, fieldPath, and required status as separate spans.
    // Use getAllByText to match the fieldPath which appears in a child span.
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent === '(extension.myProp)'
      )
    ).toBeInTheDocument();
  });

  it('shows the no-data placeholder for forms with no fields', () => {
    renderTable();

    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it('calls onEdit when the edit button is clicked', () => {
    renderTable();
    fireEvent.click(screen.getByTestId(`edit-${TargetEntityType.DataProduct}`));

    expect(mockOnEdit).toHaveBeenCalledWith(mockForms[0]);
  });

  it('calls onDelete when the delete button is clicked', () => {
    renderTable();
    fireEvent.click(
      screen.getByTestId(`delete-${TargetEntityType.DataProduct}`)
    );

    expect(mockOnDelete).toHaveBeenCalledWith(mockForms[0]);
  });

  it('calls onToggleEnabled when the toggle is changed', () => {
    renderTable();
    const toggle = screen.getByTestId(`toggle-${TargetEntityType.DataProduct}`);
    fireEvent.click(toggle);

    expect(mockOnToggleEnabled).toHaveBeenCalledWith(mockForms[0], false);
  });
});

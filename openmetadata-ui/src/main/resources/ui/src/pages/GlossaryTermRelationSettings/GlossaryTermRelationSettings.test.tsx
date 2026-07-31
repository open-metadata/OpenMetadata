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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { RelationCategory } from '../../generated/configuration/glossaryTermRelationSettings';
import {
  createGlossaryTermRelationType,
  deleteGlossaryTermRelationType,
  getGlossaryTermRelationTypes,
} from '../../rest/glossaryAPI';
import GlossaryTermRelationSettingsPage from './GlossaryTermRelationSettings';

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({
    children,
    onClick,
    isDisabled,
    'data-testid': testId,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} disabled={isDisabled} onClick={onClick}>
      {children}
    </button>
  ),
  ButtonUtility: ({
    children,
    onPress,
    isDisabled,
    'data-testid': testId,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
  Card: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Checkbox: ({
    isSelected,
    onChange,
    isDisabled,
    'aria-label': label,
  }: {
    isSelected?: boolean;
    onChange?: (v: boolean) => void;
    isDisabled?: boolean;
    'aria-label'?: string;
  }) => (
    <input
      aria-label={label}
      checked={isSelected}
      disabled={isDisabled}
      type="checkbox"
      onChange={(e) => onChange?.(e.target.checked)}
    />
  ),
  Divider: () => <hr />,
  Input: ({
    value,
    onChange,
    label,
    hint,
    'aria-label': ariaLabel,
    'data-testid': testId,
  }: {
    value?: string;
    onChange?: (v: string) => void;
    label?: string;
    hint?: string;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => {
    const id = testId ?? label;

    return (
      <div>
        {label && <label htmlFor={id}>{label}</label>}
        <input
          aria-label={label ?? ariaLabel}
          data-testid={testId}
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {hint && <span>{hint}</span>}
      </div>
    );
  },
  PaginationCardWithControls: ({
    onPageChange,
  }: {
    onPageChange: (page: number) => void;
  }) => (
    <button data-testid="next-page" onClick={() => onPageChange(2)}>
      Next page
    </button>
  ),
  Select: Object.assign(
    ({
      children,
      'aria-label': label,
    }: {
      children?: React.ReactNode;
      'aria-label'?: string;
    }) => <select aria-label={label}>{children}</select>,
    {
      Item: ({ children }: { children?: React.ReactNode }) => (
        <option>{children}</option>
      ),
    }
  ),
  SlideoutMenu: Object.assign(
    ({
      children,
      isOpen,
    }: {
      children?: React.ReactNode | (() => React.ReactNode);
      isOpen?: boolean;
    }) => {
      if (!isOpen) {
        return null;
      }
      const content =
        typeof children === 'function' ? children() : children;

      return <div>{content}</div>;
    },
    {
      Header: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Content: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Footer: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
    }
  ),
  Table: Object.assign(
    ({ children }: { children?: React.ReactNode }) => (
      <table>{children}</table>
    ),
    {
      Header: ({ children }: { children?: React.ReactNode }) => (
        <thead>{children}</thead>
      ),
      Head: ({ children }: { children?: React.ReactNode }) => (
        <th>{children}</th>
      ),
      Body: ({
        children,
        items,
      }: {
        children?: (item: unknown) => React.ReactNode;
        items?: unknown[];
      }) => <tbody>{items?.map((item) => children?.(item))}</tbody>,
      Row: ({ children }: { children?: React.ReactNode }) => (
        <tr>{children}</tr>
      ),
      Cell: ({ children }: { children?: React.ReactNode }) => (
        <td>{children}</td>
      ),
    }
  ),
  TableCard: Object.assign(
    ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    {
      Root: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
    }
  ),
  TextArea: ({
    value,
    onChange,
    'aria-label': label,
  }: {
    value?: string;
    onChange?: (v: string) => void;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  Tooltip: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Typography: ({
    children,
    'data-testid': testId,
  }: {
    children?: React.ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={testId}>{children}</span>,
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  createGlossaryTermRelationType: jest.fn(),
  deleteGlossaryTermRelationType: jest.fn(),
  getGlossaryTermRelationTypes: jest.fn(),
  updateGlossaryTermRelationType: jest.fn(),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGetGlossaryTermRelationTypes =
  getGlossaryTermRelationTypes as jest.MockedFunction<
    typeof getGlossaryTermRelationTypes
  >;
const mockCreateGlossaryTermRelationType =
  createGlossaryTermRelationType as jest.MockedFunction<
    typeof createGlossaryTermRelationType
  >;
const mockDeleteGlossaryTermRelationType =
  deleteGlossaryTermRelationType as jest.MockedFunction<
    typeof deleteGlossaryTermRelationType
  >;

describe('GlossaryTermRelationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGlossaryTermRelationTypes.mockImplementation(async ({ offset }) => ({
      data: [
        {
          name: `relation${offset ?? 0}`,
          displayName: 'Relation',
          category: RelationCategory.Associative,
        },
      ],
      paging: { limit: 15, offset: offset ?? 0, total: 31 },
    }));
  });

  it('requests only the selected page of relation types', async () => {
    render(<GlossaryTermRelationSettingsPage />);

    expect(await screen.findByText('relation0')).toBeInTheDocument();
    expect(mockGetGlossaryTermRelationTypes).toHaveBeenCalledWith({
      limit: 15,
      offset: 0,
    });

    fireEvent.click(screen.getByTestId('next-page'));

    await waitFor(() =>
      expect(mockGetGlossaryTermRelationTypes).toHaveBeenLastCalledWith({
        limit: 15,
        offset: 15,
      })
    );

    expect(await screen.findByText('relation15')).toBeInTheDocument();
  });

  it('does not allow deleting a system-defined relation type', async () => {
    mockGetGlossaryTermRelationTypes.mockResolvedValueOnce({
      data: [
        {
          name: 'relatedTo',
          displayName: 'Related To',
          category: RelationCategory.Associative,
          isSystemDefined: true,
        },
      ],
      paging: { limit: 15, offset: 0, total: 1 },
    });

    render(<GlossaryTermRelationSettingsPage />);

    const deleteButton = await screen.findByTestId('delete-relatedTo-btn');

    expect(deleteButton).toBeDisabled();

    fireEvent.click(deleteButton);

    expect(mockDeleteGlossaryTermRelationType).not.toHaveBeenCalled();
  });

  it('shows an off-page duplicate error on the name field', async () => {
    mockCreateGlossaryTermRelationType.mockRejectedValueOnce({
      response: {
        status: 409,
      },
    });

    render(<GlossaryTermRelationSettingsPage />);

    expect(await screen.findByText('relation0')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-relation-type-btn'));
    fireEvent.change(screen.getByRole('textbox', { name: /label\.name/ }), {
      target: { value: 'relation30' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: /label\.display-name/ }),
      {
        target: { value: 'Relation 30' },
      }
    );
    fireEvent.click(screen.getByTestId('save-btn'));

    await waitFor(() =>
      expect(mockCreateGlossaryTermRelationType).toHaveBeenCalled()
    );

    expect(
      await screen.findByText('message.entity-already-exists')
    ).toBeInTheDocument();
  });
});

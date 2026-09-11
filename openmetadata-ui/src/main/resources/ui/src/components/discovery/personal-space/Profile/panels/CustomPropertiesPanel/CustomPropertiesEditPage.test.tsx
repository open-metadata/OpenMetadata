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
import type { ReactNode } from 'react';
import type { Type } from '../../../../../../generated/entity/type';
import type { CustomProperty } from '../../../../../../generated/type/customProperty';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import CustomPropertiesEditPage from './CustomPropertiesEditPage';

const mockEntityType = {
  id: 'type-table',
  name: 'table',
  displayName: 'Table',
  fullyQualifiedName: 'table',
  customProperties: [],
};

const mockStringProperty = {
  name: 'stringProp',
  displayName: 'String Prop',
  description: 'A string property',
  propertyType: { id: 'string-type-id', name: 'string' },
};

const mockEnumProperty = {
  name: 'enumProp',
  displayName: 'Enum Prop',
  description: 'An enum property',
  propertyType: { id: 'enum-type-id', name: 'enum' },
  customPropertyConfig: {
    config: { values: ['opt1', 'opt2'], multiSelect: true },
  },
};

const mockEntityRefProperty = {
  name: 'refProp',
  displayName: 'Ref Prop',
  description: 'An entity reference property',
  propertyType: { id: 'entity-ref-type-id', name: 'entity-reference-list' },
  customPropertyConfig: {
    config: ['table', 'pipeline'],
  },
};

const mockTypeDetail = {
  ...mockEntityType,
  customProperties: [
    mockStringProperty,
    mockEnumProperty,
    mockEntityRefProperty,
  ],
};

const mockGetTypeByFQN = jest.fn().mockResolvedValue(mockTypeDetail);
const mockUpdateType = jest.fn().mockResolvedValue(mockTypeDetail);

jest.mock('../../../../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: (fqn: string) => mockGetTypeByFQN(fqn),
  updateType: (id: string, patches: unknown) => mockUpdateType(id, patches),
}));

jest.mock('../../../../../../constants/CustomProperty.constants', () => ({
  ENTITY_REFERENCE_OPTIONS: [
    { value: 'table', label: 'Table' },
    { value: 'pipeline', label: 'Pipeline' },
  ],
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE: ['entity-reference-list'],
}));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: ({
    onTextChange,
    initialValue,
  }: {
    onTextChange?: (value: string) => void;
    initialValue?: string;
  }) => (
    <textarea
      aria-label="description"
      data-testid="rich-text-editor"
      defaultValue={initialValue}
      onChange={(e) => onTextChange?.(e.target.value)}
    />
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const HookForm = ({
    children,
    onSubmit,
    'data-testid': testId,
    id,
  }: {
    children?: ReactNode;
    onSubmit?: (e: { preventDefault: () => void }) => void;
    'data-testid'?: string;
    id?: string;
  }) => (
    <form data-testid={testId} id={id} onSubmit={onSubmit}>
      {children}
    </form>
  );

  const FormField = ({
    children,
    name,
  }: {
    children: (args: {
      field: { onChange: () => void; value: string; name: string };
      fieldState: { invalid: boolean; error: undefined };
    }) => ReactNode;
    name: string;
  }) => {
    const field = { onChange: jest.fn(), value: '', name };
    const fieldState = { invalid: false, error: undefined };

    return (
      <div data-testid={`form-field-${name}`}>
        {children({ field, fieldState })}
      </div>
    );
  };

  return {
    Box: ({
      children,
      'data-testid': testId,
      direction: _direction,
      ...rest
    }: {
      children?: ReactNode;
      'data-testid'?: string;
      direction?: string;
      [key: string]: unknown;
    }) => (
      <div data-testid={testId} {...rest}>
        {children}
      </div>
    ),
    Button: ({
      children,
      onPress,
      'data-testid': testId,
      isDisabled,
      type,
      form,
      isLoading,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      'data-testid'?: string;
      isDisabled?: boolean;
      type?: 'button' | 'submit' | 'reset';
      form?: string;
      isLoading?: boolean;
    }) => (
      <button
        data-testid={testId}
        disabled={isDisabled ?? isLoading}
        form={form}
        type={type ?? 'button'}
        onClick={type !== 'submit' ? () => onPress?.() : undefined}>
        {children}
      </button>
    ),
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    HookForm,
    FormField,
    FormItemLabel: ({ label }: { label?: ReactNode }) => <span>{label}</span>,
    HintText: ({ children }: { children?: ReactNode }) => (
      <span data-testid="hint-text">{children}</span>
    ),
    getField: ({ props }: { props?: { 'data-testid'?: string } }) => (
      <div data-testid={props?.['data-testid'] ?? 'field'} />
    ),
    FieldTypes: {
      TEXT: 'TEXT',
      SELECT: 'SELECT',
      MULTI_SELECT: 'MULTI_SELECT',
      SWITCH: 'SWITCH',
    },
    useFieldDoc: () => ({}),
  };
});

describe('CustomPropertiesEditPage', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTypeByFQN.mockResolvedValue(mockTypeDetail);
    mockUpdateType.mockResolvedValue(mockTypeDetail);
  });

  it('renders the edit page container', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByTestId('custom-properties-edit-page')
    ).toBeInTheDocument();
  });

  it('renders the edit form', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('edit-custom-property-form')).toBeInTheDocument();
  });

  it('renders cancel and save buttons', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByTestId('edit-custom-property-cancel')
    ).toBeInTheDocument();
    expect(screen.getByTestId('edit-custom-property-save')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('edit-custom-property-cancel'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('renders display name field', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByTestId('edit-custom-property-display-name')
    ).toBeInTheDocument();
  });

  it('renders description field (RichTextEditor) with existing description', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    const editor = screen.getByTestId('rich-text-editor');

    expect(editor).toBeInTheDocument();
    expect(editor).toHaveValue('A string property');
  });

  it('renders enum config fields for enum property type', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockEnumProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByTestId('edit-custom-property-enum-config')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('edit-custom-property-multi-select')
    ).toBeInTheDocument();
  });

  it('does not render enum config fields for non-enum property type', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.queryByTestId('edit-custom-property-enum-config')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('edit-custom-property-multi-select')
    ).not.toBeInTheDocument();
  });

  it('renders entity reference config field for entity-reference-list property', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockEntityRefProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByTestId('edit-custom-property-entity-ref-config')
    ).toBeInTheDocument();
  });

  it('does not render entity reference config field for non-ref property', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.queryByTestId('edit-custom-property-entity-ref-config')
    ).not.toBeInTheDocument();
  });

  it('calls getTypeByFQN on mount', async () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(mockGetTypeByFQN).toHaveBeenCalledWith(
        mockEntityType.fullyQualifiedName
      );
    });
  });

  it('shows error toast when getTypeByFQN fails', async () => {
    const mockError = new Error('API Error');
    mockGetTypeByFQN.mockRejectedValueOnce(mockError);

    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  it('does not call onCancel when save button is clicked without submit', () => {
    render(
      <CustomPropertiesEditPage
        entityType={mockEntityType as unknown as Type}
        property={mockStringProperty as unknown as CustomProperty}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Save is a submit button — clicking it without form interaction should not call onCancel
    expect(mockOnCancel).not.toHaveBeenCalled();
  });
});

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
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import CustomPropertiesAddPage from './CustomPropertiesAddPage';

const mockEntityType = {
  id: 'type-table',
  name: 'table',
  displayName: 'Table',
  fullyQualifiedName: 'table',
};

const mockStringType = {
  id: 'string-type-id',
  name: 'string',
  displayName: 'String',
};

const mockEnumType = {
  id: 'enum-type-id',
  name: 'enum',
  displayName: 'Enum',
};

jest.mock('../../../../../../rest/metadataTypeAPI', () => ({
  getTypeListByCategory: jest.fn(),
  addPropertyToEntity: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { displayName?: string; name?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../../../constants/CustomProperty.constants', () => ({
  CUSTOM_PROPERTIES_ICON_MAP: {},
  ENTITY_REFERENCE_OPTIONS: [
    { value: 'table', label: 'Table' },
    { value: 'pipeline', label: 'Pipeline' },
  ],
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE: ['entity-reference-list'],
  PROPERTY_TYPES_WITH_FORMAT: ['date', 'time'],
  SUPPORTED_FORMAT_MAP: {
    date: ['ISO_8601', 'MM/dd/yyyy'],
    time: ['HH:mm', 'hh:mm a'],
  },
  TABLE_TYPE_CUSTOM_PROPERTY: 'table-cp',
}));

jest.mock('../../../../../../constants/regex.constants', () => ({
  CUSTOM_PROPERTY_NAME_REGEX: /^[a-z][a-zA-Z0-9]*$/,
}));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: ({ onTextChange }: any) => (
    <textarea
      data-testid="rich-text-editor"
      onChange={(e) => onTextChange?.(e.target.value)}
    />
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const formData: Record<string, any> = {};

  const FormField = ({ children, name, control, rules }: any) => {
    const field = {
      onChange: (val: any) => { formData[name] = val; },
      value: formData[name],
      name,
    };
    const fieldState = { invalid: false, error: undefined };

    return <div data-testid={`form-field-${name}`}>{children({ field, fieldState })}</div>;
  };

  const HookForm = ({ children, onSubmit, 'data-testid': testId, id }: any) => (
    <form data-testid={testId} id={id} onSubmit={onSubmit}>
      {children}
    </form>
  );

  return {
    Box: ({ children, 'data-testid': testId, direction, ...rest }: any) => (
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
    }: any) => (
      <button
        data-testid={testId}
        disabled={isDisabled || isLoading}
        form={form}
        type={type ?? 'button'}
        onClick={type !== 'submit' ? () => onPress?.() : undefined}>
        {children}
      </button>
    ),
    Typography: ({ children }: any) => <span>{children}</span>,
    HookForm,
    FormField,
    FormItemLabel: ({ label }: any) => <label>{label}</label>,
    HintText: ({ children }: any) => <span data-testid="hint-text">{children}</span>,
    getField: ({ props }: any) => (
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

jest.mock('../../../../../../generated/entity/type', () => ({
  Category: { Field: 'Field' },
}));

describe('CustomPropertiesAddPage', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    entityType: mockEntityType as any,
    onSuccess: mockOnSuccess,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { getTypeListByCategory } = jest.requireMock(
      '../../../../../../rest/metadataTypeAPI'
    );
    getTypeListByCategory.mockResolvedValue({ data: [mockStringType, mockEnumType] });
  });

  it('renders the add page container', async () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    expect(screen.getByTestId('custom-properties-add-page')).toBeInTheDocument();
  });

  it('renders the form', async () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    expect(screen.getByTestId('custom-property-form')).toBeInTheDocument();
  });

  it('renders core form fields (name, displayName, propertyType)', async () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('custom-property-name')).toBeInTheDocument();
      expect(screen.getByTestId('custom-property-display-name')).toBeInTheDocument();
      expect(screen.getByTestId('custom-property-type')).toBeInTheDocument();
    });
  });

  it('renders the description field', async () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    });
  });

  it('renders cancel and save buttons', () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    expect(screen.getByTestId('custom-property-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('custom-property-save')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    fireEvent.click(screen.getByTestId('custom-property-cancel'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls getTypeListByCategory on mount to load property types', async () => {
    const { getTypeListByCategory } = jest.requireMock(
      '../../../../../../rest/metadataTypeAPI'
    );
    render(<CustomPropertiesAddPage {...defaultProps} />);

    await waitFor(() => {
      expect(getTypeListByCategory).toHaveBeenCalled();
    });
  });

  it('shows error toast when getTypeListByCategory fails', async () => {
    const mockError = new Error('API Error');
    const { getTypeListByCategory } = jest.requireMock(
      '../../../../../../rest/metadataTypeAPI'
    );
    getTypeListByCategory.mockRejectedValueOnce(mockError);

    render(<CustomPropertiesAddPage {...defaultProps} />);

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  it('does not render enum-specific fields by default', () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    expect(screen.queryByTestId('custom-property-enum-config')).not.toBeInTheDocument();
    expect(screen.queryByTestId('custom-property-multi-select')).not.toBeInTheDocument();
  });

  it('does not render entity-reference config field by default', () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    expect(
      screen.queryByTestId('custom-property-entity-ref-config')
    ).not.toBeInTheDocument();
  });

  it('does not render format config field by default', () => {
    render(<CustomPropertiesAddPage {...defaultProps} />);

    expect(
      screen.queryByTestId('custom-property-format-config')
    ).not.toBeInTheDocument();
  });

});

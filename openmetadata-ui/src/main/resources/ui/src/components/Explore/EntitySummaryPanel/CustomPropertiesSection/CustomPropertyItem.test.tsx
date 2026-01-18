/*
 *  Copyright 2025 Collate.
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
import { CustomProperty } from '../../../../generated/entity/type';
import { showErrorToast } from '../../../../utils/ToastUtils';
import CustomPropertyItem from './CustomPropertyItem';

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../utils/CustomPropertyRenderers', () => ({
  CustomPropertyValueRenderer: jest
    .fn()
    .mockImplementation(({ value }) => (
      <div data-testid="value-renderer">{value}</div>
    )),
}));

jest.mock('./CustomPropertyInput', () =>
  jest.fn().mockImplementation(({ onInputSave, onHideInput }) => (
    <div>
      <input data-testid="mock-input" />
      <button data-testid="save-input" onClick={() => onInputSave('new value')}>
        Save
      </button>
      <button data-testid="save-input-number" onClick={() => onInputSave(42)}>
        Save Number
      </button>
      <button
        data-testid="save-input-enum"
        onClick={() => onInputSave(['option1', 'option2'])}>
        Save Enum
      </button>
      <button
        data-testid="save-input-undefined"
        onClick={() => onInputSave(undefined)}>
        Save Undefined
      </button>
      <button data-testid="cancel-input" onClick={onHideInput}>
        Cancel
      </button>
    </div>
  ))
);

const mockOnExtensionUpdate = jest.fn().mockResolvedValue(undefined);

const mockProperty: CustomProperty = {
  name: 'testProperty',
  description: 'Test Property',
  propertyType: {
    id: 'id1',
    name: 'string',
    type: 'type',
  },
};

const mockIntegerProperty: CustomProperty = {
  name: 'testIntegerProperty',
  description: 'Test Integer Property',
  propertyType: {
    id: 'id2',
    name: 'integer',
    type: 'type',
  },
};

const mockNumberProperty: CustomProperty = {
  name: 'testNumberProperty',
  description: 'Test Number Property',
  propertyType: {
    id: 'id3',
    name: 'number',
    type: 'type',
  },
};

const mockEnumProperty: CustomProperty = {
  name: 'testEnumProperty',
  description: 'Test Enum Property',
  propertyType: {
    id: 'id4',
    name: 'enum',
    type: 'type',
  },
};

const mockPropertyWithDisplayName: CustomProperty = {
  name: 'testPropertyWithDisplay',
  displayName: 'Display Name Property',
  description: 'Test Property With Display Name',
  propertyType: {
    id: 'id5',
    name: 'string',
    type: 'type',
  },
};

describe('CustomPropertyItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render property name and value', () => {
    render(
      <CustomPropertyItem
        extensionData={{}}
        hasEditPermissions={false}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    expect(screen.getByText('testProperty')).toBeInTheDocument();
    expect(screen.getByTestId('value-renderer')).toHaveTextContent(
      'test value'
    );
  });

  it('should render displayName when available', () => {
    render(
      <CustomPropertyItem
        extensionData={{}}
        hasEditPermissions={false}
        property={mockPropertyWithDisplayName}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    expect(screen.getByText('Display Name Property')).toBeInTheDocument();
  });

  it('should not show edit button if hasEditPermissions is false', () => {
    render(
      <CustomPropertyItem
        extensionData={{}}
        hasEditPermissions={false}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
  });

  it('should show edit button if hasEditPermissions is true', () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
  });

  it('should switch to edit mode when edit button is clicked', () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    const editButton = screen.getByTestId('edit-icon');
    fireEvent.click(editButton);

    expect(screen.getByTestId('mock-input')).toBeInTheDocument();
    expect(screen.queryByTestId('value-renderer')).not.toBeInTheDocument();
  });

  it('should call onExtensionUpdate when value is saved', async () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));
    fireEvent.click(screen.getByTestId('save-input'));

    await waitFor(() => {
      expect(mockOnExtensionUpdate).toHaveBeenCalledWith({
        testProperty: 'new value',
      });
    });
  });

  it('should exit edit mode when canceled', () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));
    fireEvent.click(screen.getByTestId('cancel-input'));

    expect(screen.queryByTestId('mock-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('value-renderer')).toBeInTheDocument();
  });

  it('should merge with existing extension data on save', async () => {
    const existingExtensionData = {
      existingProperty: 'existing value',
    };

    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={existingExtensionData}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));
    fireEvent.click(screen.getByTestId('save-input'));

    await waitFor(() => {
      expect(mockOnExtensionUpdate).toHaveBeenCalledWith({
        existingProperty: 'existing value',
        testProperty: 'new value',
      });
    });
  });

  it('should convert integer property value to number on save', async () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockIntegerProperty}
        value={10}
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));
    fireEvent.click(screen.getByTestId('save-input-number'));

    await waitFor(() => {
      expect(mockOnExtensionUpdate).toHaveBeenCalledWith({
        testIntegerProperty: 42,
      });
    });
  });

  it('should convert number property value to number on save', async () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockNumberProperty}
        value={10.5}
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));
    fireEvent.click(screen.getByTestId('save-input-number'));

    await waitFor(() => {
      expect(mockOnExtensionUpdate).toHaveBeenCalledWith({
        testNumberProperty: 42,
      });
    });
  });

  it('should filter empty values for enum property on save', async () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockEnumProperty}
        value={['option1']}
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));
    fireEvent.click(screen.getByTestId('save-input-enum'));

    await waitFor(() => {
      expect(mockOnExtensionUpdate).toHaveBeenCalledWith({
        testEnumProperty: ['option1', 'option2'],
      });
    });
  });

  it('should show error toast when onExtensionUpdate fails', async () => {
    const error = new Error('Update failed');
    const mockFailingUpdate = jest.fn().mockRejectedValue(error);

    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockFailingUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));
    fireEvent.click(screen.getByTestId('save-input'));

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(error);
    });
  });

  it('should exit edit mode after save completes', async () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));

    expect(screen.getByTestId('mock-input')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('save-input'));

    await waitFor(() => {
      expect(screen.queryByTestId('mock-input')).not.toBeInTheDocument();
      expect(screen.getByTestId('value-renderer')).toBeInTheDocument();
    });
  });

  it('should switch to edit mode on double click when hasEditPermissions is true', () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{}}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    const card = screen.getByTestId('custom-property-testProperty-card');
    fireEvent.doubleClick(card);

    expect(screen.getByTestId('mock-input')).toBeInTheDocument();
  });

  it('should not switch to edit mode on double click when hasEditPermissions is false', () => {
    render(
      <CustomPropertyItem
        extensionData={{}}
        hasEditPermissions={false}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    const card = screen.getByTestId('custom-property-testProperty-card');
    fireEvent.doubleClick(card);

    expect(screen.queryByTestId('mock-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('value-renderer')).toBeInTheDocument();
  });

  it('should call onExtensionUpdate with undefined when all properties are cleared', async () => {
    render(
      <CustomPropertyItem
        hasEditPermissions
        extensionData={{ testProperty: 'old value' }}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-icon'));
    fireEvent.click(screen.getByTestId('save-input-undefined'));

    await waitFor(() => {
      expect(mockOnExtensionUpdate).toHaveBeenCalledWith(undefined);
    });
  });

  it('should render with null extension data', () => {
    render(
      <CustomPropertyItem
        extensionData={null}
        hasEditPermissions={false}
        property={mockProperty}
        value="test value"
        onExtensionUpdate={mockOnExtensionUpdate}
      />
    );

    expect(screen.getByText('testProperty')).toBeInTheDocument();
    expect(screen.getByTestId('value-renderer')).toHaveTextContent(
      'test value'
    );
  });
});

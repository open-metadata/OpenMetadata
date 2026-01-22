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
import React from 'react';
import { CustomProperty } from '../../../../generated/entity/type';
import CustomPropertyInput from './CustomPropertyInput';

jest.mock('../../../common/DatePicker/DatePicker', () =>
  jest
    .fn()
    .mockImplementation(({ onChange }) => (
      <input
        data-testid="date-picker"
        onChange={(e) => onChange(null, e.target.value)}
      />
    ))
);

jest.mock(
  '../../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockImplementation(({ onSave, onCancel }) => (
        <div>
          <button
            data-testid="save-markdown"
            onClick={() => onSave('markdown value')}>
            Save Markdown
          </button>
          <button data-testid="cancel-markdown" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )),
  })
);

jest.mock(
  '../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () =>
    jest
      .fn()
      .mockImplementation(({ onChange }) => (
        <input
          data-testid="async-select"
          onChange={(e) =>
            onChange({
              value: e.target.value,
              label: e.target.value,
              reference: { id: 'id', type: 'table', name: e.target.value },
            })
          }
        />
      ))
);

jest.mock('../../../common/InlineEdit/InlineEdit.component', () => {
  return jest
    .fn()
    .mockImplementation(({ children, saveButtonProps, onCancel, onSave }) => (
      <div>
        {children}
        <button
          data-testid="save-button"
          form={saveButtonProps?.form}
          type="submit"
          onClick={saveButtonProps?.onSave ?? onSave}>
          Save
        </button>
        <button data-testid="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ));
});

jest.mock(
  '../../../common/CustomPropertyTable/TableTypeProperty/TableTypePropertyView',
  () => jest.fn().mockImplementation(() => <div data-testid="table-view" />)
);

jest.mock(
  '../../../common/CustomPropertyTable/TableTypeProperty/EditTableTypePropertyModal',
  () =>
    jest.fn().mockImplementation(({ onSave, onCancel }) => (
      <div>
        <button
          data-testid="save-table"
          onClick={() => onSave({ rows: [{ col1: 'val1' }] })}>
          Save Table
        </button>
        <button data-testid="cancel-table" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ))
);

jest.mock('../../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn().mockImplementation(({ onChange }) => (
    <textarea
      data-testid="schema-editor"
      onChange={(e) => onChange(e.target.value)}
    />
  ))
);

const mockOnHideInput = jest.fn();
const mockOnInputSave = jest.fn().mockResolvedValue(undefined);

const stringProperty: CustomProperty = {
  name: 'testString',
  description: 'Test String Property',
  propertyType: {
    id: 'id1',
    name: 'string',
    type: 'type',
  },
};

const integerProperty: CustomProperty = {
  name: 'testInteger',
  description: 'Test Integer Property',
  propertyType: {
    id: 'id2',
    name: 'integer',
    type: 'type',
  },
};

const numberProperty: CustomProperty = {
  name: 'testNumber',
  description: 'Test Number Property',
  propertyType: {
    id: 'id-number',
    name: 'number',
    type: 'type',
  },
};

const markdownProperty: CustomProperty = {
  name: 'testMarkdown',
  description: 'Test Markdown Property',
  propertyType: {
    id: 'id3',
    name: 'markdown',
    type: 'type',
  },
};

const enumProperty: CustomProperty = {
  name: 'testEnum',
  description: 'Test Enum Property',
  propertyType: {
    id: 'id4',
    name: 'enum',
    type: 'type',
  },
  customPropertyConfig: {
    config: {
      values: ['option1', 'option2', 'option3'],
      multiSelect: false,
    },
  },
};

const multiSelectEnumProperty: CustomProperty = {
  name: 'testMultiEnum',
  description: 'Test Multi Select Enum Property',
  propertyType: {
    id: 'id5',
    name: 'enum',
    type: 'type',
  },
  customPropertyConfig: {
    config: {
      values: ['option1', 'option2', 'option3'],
      multiSelect: true,
    },
  },
};

const emailProperty: CustomProperty = {
  name: 'testEmail',
  description: 'Test Email Property',
  propertyType: {
    id: 'id6',
    name: 'email',
    type: 'type',
  },
};

const timestampProperty: CustomProperty = {
  name: 'testTimestamp',
  description: 'Test Timestamp Property',
  propertyType: {
    id: 'id7',
    name: 'timestamp',
    type: 'type',
  },
};

const durationProperty: CustomProperty = {
  name: 'testDuration',
  description: 'Test Duration Property',
  propertyType: {
    id: 'id8',
    name: 'duration',
    type: 'type',
  },
};

const entityReferenceProperty: CustomProperty = {
  name: 'testEntityRef',
  description: 'Test Entity Reference Property',
  propertyType: {
    id: 'id9',
    name: 'entityReference',
    type: 'type',
  },
  customPropertyConfig: {
    config: ['table'],
  },
};

const timeIntervalProperty: CustomProperty = {
  name: 'testTimeInterval',
  description: 'Test Time Interval Property',
  propertyType: {
    id: 'id10',
    name: 'timeInterval',
    type: 'type',
  },
};

const sqlQueryProperty: CustomProperty = {
  name: 'testSqlQuery',
  description: 'Test SQL Query Property',
  propertyType: {
    id: 'id11',
    name: 'sqlQuery',
    type: 'type',
  },
};

const tableTypeProperty: CustomProperty = {
  name: 'testTableType',
  description: 'Test Table Type Property',
  propertyType: {
    id: 'id12',
    name: 'table-cp',
    type: 'type',
  },
  customPropertyConfig: {
    config: {
      columns: ['col1', 'col2'],
    },
  },
};

const unknownProperty: CustomProperty = {
  name: 'testUnknown',
  description: 'Test Unknown Property',
  propertyType: {
    id: 'id-unknown',
    name: 'unknownType',
    type: 'type',
  },
};

describe('CustomPropertyInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render string input', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={stringProperty}
        value="test value"
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    const input = screen.getByDisplayValue('test value');

    expect(input).toBeInTheDocument();
  });

  it('should call onInputSave when string input is saved', async () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={stringProperty}
        value=""
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    const input = screen.getByTestId('value-input');
    fireEvent.change(input, { target: { value: 'new value' } });

    const saveButton = screen.getByTestId('save-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnInputSave).toHaveBeenCalledWith('new value');
    });
  });

  it('should render integer input with number type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={integerProperty}
        value={123}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    const input = screen.getByDisplayValue('123');

    expect(input).toHaveAttribute('type', 'number');
  });

  it('should render number input with number type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={numberProperty}
        value={45.67}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    const input = screen.getByDisplayValue('45.67');

    expect(input).toHaveAttribute('type', 'number');
  });

  it('should render markdown editor for markdown type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={markdownProperty}
        value=""
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('save-markdown')).toBeInTheDocument();
  });

  it('should call onInputSave when markdown is saved', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={markdownProperty}
        value=""
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    fireEvent.click(screen.getByTestId('save-markdown'));

    expect(mockOnInputSave).toHaveBeenCalledWith('markdown value');
  });

  it('should render enum select for enum type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={enumProperty}
        value=""
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('should render enum select with multiSelect mode', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={multiSelectEnumProperty}
        value={['option1', 'option2']}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('should render email input for email type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={emailProperty}
        value="test@example.com"
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('email-input')).toBeInTheDocument();
  });

  it('should render timestamp input for timestamp type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={timestampProperty}
        value={1234567890000}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('timestamp-input')).toBeInTheDocument();
  });

  it('should render duration input for duration type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={durationProperty}
        value="P1D"
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('duration-input')).toBeInTheDocument();
  });

  it('should render entity reference select for entityReference type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={entityReferenceProperty}
        value={undefined}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('async-select')).toBeInTheDocument();
  });

  it('should render time interval inputs for timeInterval type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={timeIntervalProperty}
        value={{ start: 1000, end: 2000 }}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('start-input')).toBeInTheDocument();
    expect(screen.getByTestId('end-input')).toBeInTheDocument();
  });

  it('should render sql query editor for sqlQuery type', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={sqlQueryProperty}
        value="SELECT * FROM table"
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
  });

  it('should render table type property view and modal', () => {
    render(
      <CustomPropertyInput
        isLoading={false}
        property={tableTypeProperty}
        value={{ rows: [] }}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('table-view')).toBeInTheDocument();
    expect(screen.getByTestId('save-table')).toBeInTheDocument();
  });

  it('should return null for unknown property type', () => {
    const { container } = render(
      <CustomPropertyInput
        isLoading={false}
        property={unknownProperty}
        value=""
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should handle entity reference with existing value', () => {
    const existingRef = {
      id: 'existing-id',
      type: 'table',
      name: 'existing-table',
      fullyQualifiedName: 'database.schema.existing-table',
    };

    render(
      <CustomPropertyInput
        isLoading={false}
        property={entityReferenceProperty}
        value={existingRef}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('async-select')).toBeInTheDocument();
  });

  it('should handle entity reference list with array values', () => {
    const entityRefListProperty: CustomProperty = {
      name: 'testEntityRefList',
      description: 'Test Entity Reference List Property',
      propertyType: {
        id: 'id-ref-list',
        name: 'entityReferenceList',
        type: 'type',
      },
      customPropertyConfig: {
        config: ['table'],
      },
    };

    const existingRefs = [
      {
        id: 'ref-1',
        type: 'table',
        name: 'table-1',
        fullyQualifiedName: 'db.schema.table-1',
      },
      {
        id: 'ref-2',
        type: 'table',
        name: 'table-2',
        fullyQualifiedName: 'db.schema.table-2',
      },
    ];

    render(
      <CustomPropertyInput
        isLoading={false}
        property={entityRefListProperty}
        value={existingRefs}
        onHideInput={mockOnHideInput}
        onInputSave={mockOnInputSave}
      />
    );

    expect(screen.getByTestId('async-select')).toBeInTheDocument();
  });
});

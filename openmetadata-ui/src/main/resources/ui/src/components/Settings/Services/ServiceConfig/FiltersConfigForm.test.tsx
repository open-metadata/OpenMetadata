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

import { IChangeEvent } from '@rjsf/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoadingState } from 'Models';
import React from 'react';
import { ServiceCategory } from '../../../../enums/service.enum';
import { DatabaseServiceType } from '../../../../generated/entity/services/databaseService';
import { ConfigData } from '../../../../interface/service.interface';
import FiltersConfigForm from './FiltersConfigForm';
import { FiltersConfigFormProps } from './FiltersConfigForm.interface';

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    inlineAlertDetails: undefined,
  }),
}));

jest.mock('../../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForSubmit: jest.fn((data) => data),
}));

jest.mock('../../../../utils/ServiceConnectionUtils', () => ({
  getConnectionSchemas: jest.fn().mockReturnValue({
    connSch: {
      schema: {
        type: 'object',
        properties: {
          filter1: { type: 'string' },
          filter2: { type: 'string' },
          someOtherProperty: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
    validConfig: {},
  }),
  getFilteredSchema: jest.fn((properties) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { filter1, filter2, ...rest } = properties as Record<string, unknown>;

    return rest;
  }),
}));

const MockFormBuilder = React.forwardRef<
  unknown,
  {
    onSubmit: (data: IChangeEvent<ConfigData>) => void;
    onCancel: () => void;
    children?: React.ReactNode;
  }
>(({ onSubmit, onCancel, children }, ref) => {
  React.useImperativeHandle(ref, () => ({}));

  return (
    <div data-testid="form-builder">
      <button
        data-testid="submit-button"
        onClick={() => onSubmit({ formData: {} } as IChangeEvent<ConfigData>)}>
        Submit
      </button>
      <button data-testid="cancel-button" onClick={onCancel}>
        Cancel
      </button>
      {children}
    </div>
  );
});

jest.mock('../../../common/FormBuilder/FormBuilder', () => {
  return jest.fn().mockImplementation((props) => {
    return <MockFormBuilder {...props} />;
  });
});

jest.mock('../../../common/InlineAlert/InlineAlert', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="inline-alert">Alert</div>);
});

const mockGetConnectionSchemas = jest.requireMock(
  '../../../../utils/ServiceConnectionUtils'
).getConnectionSchemas;

const mockGetFilteredSchema = jest.requireMock(
  '../../../../utils/ServiceConnectionUtils'
).getFilteredSchema;

const mockFormatFormDataForSubmit = jest.requireMock(
  '../../../../utils/JSONSchemaFormUtils'
).formatFormDataForSubmit;

const mockUseApplicationStore = jest.requireMock(
  '../../../../hooks/useApplicationStore'
).useApplicationStore;

describe('FiltersConfigForm', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnFocus = jest.fn();

  const defaultProps: FiltersConfigFormProps = {
    data: undefined,
    serviceType: DatabaseServiceType.Mysql,
    serviceCategory: ServiceCategory.DATABASE_SERVICES,
    status: 'initial' as LoadingState,
    onSave: mockOnSave,
    onCancel: mockOnCancel,
    onFocus: mockOnFocus,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Filtering', () => {
    it('should remove filter properties from the schema', () => {
      render(<FiltersConfigForm {...defaultProps} />);

      expect(mockGetFilteredSchema).toHaveBeenCalledWith(
        {
          filter1: { type: 'string' },
          filter2: { type: 'string' },
          someOtherProperty: { type: 'string' },
        },
        false
      );
    });

    it('should set additionalProperties to false in the filtered schema', () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      render(<FiltersConfigForm {...defaultProps} />);

      const formBuilderCall = mockFormBuilder.mock.calls[0][0];

      expect(formBuilderCall.schema.additionalProperties).toBe(false);
    });

    it('should pass the filtered schema to FormBuilder', () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      render(<FiltersConfigForm {...defaultProps} />);

      const formBuilderCall = mockFormBuilder.mock.calls[0][0];

      expect(formBuilderCall.schema).toEqual({
        type: 'object',
        properties: {
          someOtherProperty: { type: 'string' },
        },
        additionalProperties: false,
      });
    });
  });

  describe('Form Submission', () => {
    it('should format and save form data on submit', async () => {
      mockFormatFormDataForSubmit.mockReturnValue({ formatted: 'data' });

      render(<FiltersConfigForm {...defaultProps} />);

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFormatFormDataForSubmit).toHaveBeenCalledWith({});
        expect(mockOnSave).toHaveBeenCalledWith({
          formData: { formatted: 'data' },
        });
      });
    });

    it('should call onCancel when cancel button is clicked', () => {
      render(<FiltersConfigForm {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-button');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Empty Schema Handling', () => {
    it('should not show no config message with default mock (schema has properties)', () => {
      // Default mock has properties, so no-config message shouldn't show
      render(<FiltersConfigForm {...defaultProps} />);

      expect(
        screen.queryByTestId('no-config-available')
      ).not.toBeInTheDocument();
    });

    it('should not show no config message when schema has properties', () => {
      mockGetFilteredSchema.mockReturnValue({
        someProperty: { type: 'string' },
      });

      render(<FiltersConfigForm {...defaultProps} />);

      expect(
        screen.queryByTestId('no-config-available')
      ).not.toBeInTheDocument();
    });
  });

  describe('Inline Alert', () => {
    it('should render inline alert when inlineAlertDetails is present', () => {
      mockUseApplicationStore.mockReturnValue({
        inlineAlertDetails: {
          type: 'error',
          message: 'Error message',
        },
      });

      render(<FiltersConfigForm {...defaultProps} />);

      expect(screen.getByTestId('inline-alert')).toBeInTheDocument();
    });

    it('should not render inline alert when inlineAlertDetails is undefined', () => {
      mockUseApplicationStore.mockReturnValue({
        inlineAlertDetails: undefined,
      });

      render(<FiltersConfigForm {...defaultProps} />);

      expect(screen.queryByTestId('inline-alert')).not.toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('should use custom okText and cancelText when provided', () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      render(
        <FiltersConfigForm
          {...defaultProps}
          cancelText="Custom Cancel"
          okText="Custom Save"
        />
      );

      const formBuilderCall = mockFormBuilder.mock.calls[0][0];

      expect(formBuilderCall.okText).toBe('Custom Save');
      expect(formBuilderCall.cancelText).toBe('Custom Cancel');
    });

    it('should use default okText and cancelText when not provided', () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      render(<FiltersConfigForm {...defaultProps} />);

      const formBuilderCall = mockFormBuilder.mock.calls[0][0];

      expect(formBuilderCall.okText).toBe('Save');
      expect(formBuilderCall.cancelText).toBe('Cancel');
    });

    it('should pass all required props to FormBuilder', () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      render(<FiltersConfigForm {...defaultProps} />);

      const formBuilderCall = mockFormBuilder.mock.calls[0][0];

      expect(formBuilderCall.serviceCategory).toBe(
        ServiceCategory.DATABASE_SERVICES
      );
      expect(formBuilderCall.status).toBe('initial');
      expect(formBuilderCall.onFocus).toBe(mockOnFocus);
      expect(formBuilderCall.showFormHeader).toBe(true);
    });
  });

  describe('Connection Schema Integration', () => {
    it('should call getConnectionSchemas with correct parameters', () => {
      render(<FiltersConfigForm {...defaultProps} />);

      expect(mockGetConnectionSchemas).toHaveBeenCalledWith({
        data: undefined,
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        serviceType: DatabaseServiceType.Mysql,
      });
    });

    it('should use validConfig from getConnectionSchemas', () => {
      mockGetConnectionSchemas.mockReturnValue({
        connSch: {
          schema: {
            type: 'object',
            properties: {},
          },
        },
        validConfig: { customConfig: 'value' },
      });

      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      render(<FiltersConfigForm {...defaultProps} />);

      const formBuilderCall = mockFormBuilder.mock.calls[0][0];

      expect(formBuilderCall.formData).toEqual({ customConfig: 'value' });
    });
  });
});

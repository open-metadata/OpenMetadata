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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
  buildValidConfig: jest.fn().mockReturnValue({}),
  loadConnectionSchema: jest.fn().mockResolvedValue({
    schema: {
      type: 'object',
      properties: {
        filter1: { type: 'string' },
        filter2: { type: 'string' },
        someOtherProperty: { type: 'string' },
      },
      additionalProperties: true,
    },
    uiSchema: {},
  }),
  EMPTY_CONNECTION_SCHEMA: { schema: {}, uiSchema: {} },
  getFilteredSchema: jest.fn(
    (properties: Record<string, unknown> | undefined) => {
      const {
        filter1: _filter1,
        filter2: _filter2,
        ...rest
      } = (properties || {}) as Record<string, unknown>;

      return rest;
    }
  ),
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

const mockLoadConnectionSchema = jest.requireMock(
  '../../../../utils/ServiceConnectionUtils'
).loadConnectionSchema;

const mockBuildValidConfig = jest.requireMock(
  '../../../../utils/ServiceConnectionUtils'
).buildValidConfig;

const mockGetFilteredSchema = jest.requireMock(
  '../../../../utils/ServiceConnectionUtils'
).getFilteredSchema;

const mockFormatFormDataForSubmit = jest.requireMock(
  '../../../../utils/JSONSchemaFormUtils'
).formatFormDataForSubmit;

const mockUseApplicationStore = jest.requireMock(
  '../../../../hooks/useApplicationStore'
).useApplicationStore;

const renderForm = async (props: FiltersConfigFormProps) => {
  let utils: ReturnType<typeof render> | undefined;
  await act(async () => {
    utils = render(<FiltersConfigForm {...props} />);
  });

  return utils!;
};

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
    mockLoadConnectionSchema.mockResolvedValue({
      schema: {
        type: 'object',
        properties: {
          filter1: { type: 'string' },
          filter2: { type: 'string' },
          someOtherProperty: { type: 'string' },
        },
        additionalProperties: true,
      },
      uiSchema: {},
    });
    mockBuildValidConfig.mockReturnValue({});
    mockGetFilteredSchema.mockImplementation(
      (properties: Record<string, unknown> | undefined) => {
        const {
          filter1: _filter1,
          filter2: _filter2,
          ...rest
        } = (properties || {}) as Record<string, unknown>;

        return rest;
      }
    );
  });

  describe('Schema Filtering', () => {
    it('should remove filter properties from the schema', async () => {
      await renderForm(defaultProps);

      await waitFor(() => {
        expect(mockGetFilteredSchema).toHaveBeenCalledWith(
          {
            filter1: { type: 'string' },
            filter2: { type: 'string' },
            someOtherProperty: { type: 'string' },
          },
          false
        );
      });
    });

    it('should set additionalProperties to false in the filtered schema', async () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      await renderForm(defaultProps);

      await waitFor(() => {
        const lastCall =
          mockFormBuilder.mock.calls[mockFormBuilder.mock.calls.length - 1][0];

        expect(lastCall.schema.additionalProperties).toBe(false);
      });
    });

    it('should pass the filtered schema to FormBuilder', async () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      await renderForm(defaultProps);

      await waitFor(() => {
        const lastCall =
          mockFormBuilder.mock.calls[mockFormBuilder.mock.calls.length - 1][0];

        expect(lastCall.schema).toEqual({
          type: 'object',
          properties: {
            someOtherProperty: { type: 'string' },
          },
          additionalProperties: false,
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('should format and save form data on submit', async () => {
      mockFormatFormDataForSubmit.mockReturnValue({ formatted: 'data' });

      await renderForm(defaultProps);

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFormatFormDataForSubmit).toHaveBeenCalledWith({});
        expect(mockOnSave).toHaveBeenCalledWith({
          formData: { formatted: 'data' },
        });
      });
    });

    it('should call onCancel when cancel button is clicked', async () => {
      await renderForm(defaultProps);

      const cancelButton = screen.getByTestId('cancel-button');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Empty Schema Handling', () => {
    it('should not show no config message with default mock (schema has properties)', async () => {
      await renderForm(defaultProps);

      expect(
        screen.queryByTestId('no-config-available')
      ).not.toBeInTheDocument();
    });

    it('should not show no config message when schema has properties', async () => {
      mockGetFilteredSchema.mockReturnValue({
        someProperty: { type: 'string' },
      });

      await renderForm(defaultProps);

      expect(
        screen.queryByTestId('no-config-available')
      ).not.toBeInTheDocument();
    });
  });

  describe('Inline Alert', () => {
    it('should render inline alert when inlineAlertDetails is present', async () => {
      mockUseApplicationStore.mockReturnValue({
        inlineAlertDetails: {
          type: 'error',
          message: 'Error message',
        },
      });

      await renderForm(defaultProps);

      expect(screen.getByTestId('inline-alert')).toBeInTheDocument();
    });

    it('should not render inline alert when inlineAlertDetails is undefined', async () => {
      mockUseApplicationStore.mockReturnValue({
        inlineAlertDetails: undefined,
      });

      await renderForm(defaultProps);

      expect(screen.queryByTestId('inline-alert')).not.toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('should use custom okText and cancelText when provided', async () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      await renderForm({
        ...defaultProps,
        cancelText: 'Custom Cancel',
        okText: 'Custom Save',
      });

      const lastCall =
        mockFormBuilder.mock.calls[mockFormBuilder.mock.calls.length - 1][0];

      expect(lastCall.okText).toBe('Custom Save');
      expect(lastCall.cancelText).toBe('Custom Cancel');
    });

    it('should use default okText and cancelText when not provided', async () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      await renderForm(defaultProps);

      const lastCall =
        mockFormBuilder.mock.calls[mockFormBuilder.mock.calls.length - 1][0];

      expect(lastCall.okText).toBe('Save');
      expect(lastCall.cancelText).toBe('Cancel');
    });

    it('should pass all required props to FormBuilder', async () => {
      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      await renderForm(defaultProps);

      const lastCall =
        mockFormBuilder.mock.calls[mockFormBuilder.mock.calls.length - 1][0];

      expect(lastCall.serviceCategory).toBe(ServiceCategory.DATABASE_SERVICES);
      expect(lastCall.status).toBe('initial');
      expect(lastCall.onFocus).toBe(mockOnFocus);
      expect(lastCall.showFormHeader).toBe(true);
    });
  });

  describe('Connection Schema Integration', () => {
    it('should call loadConnectionSchema with correct parameters', async () => {
      await renderForm(defaultProps);

      expect(mockLoadConnectionSchema).toHaveBeenCalledWith(
        ServiceCategory.DATABASE_SERVICES,
        DatabaseServiceType.Mysql
      );
    });

    it('should use validConfig from buildValidConfig', async () => {
      mockBuildValidConfig.mockReturnValue({ customConfig: 'value' });

      const mockFormBuilder = jest.requireMock(
        '../../../common/FormBuilder/FormBuilder'
      );

      await renderForm(defaultProps);

      await waitFor(() => {
        const lastCall =
          mockFormBuilder.mock.calls[mockFormBuilder.mock.calls.length - 1][0];

        expect(lastCall.formData).toEqual({ customConfig: 'value' });
      });
    });
  });
});

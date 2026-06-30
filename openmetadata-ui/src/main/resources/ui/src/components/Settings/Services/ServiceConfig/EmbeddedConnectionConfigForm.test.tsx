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
import type { ForwardedRef, ReactNode } from 'react';
import { act } from 'react';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { LOADING_STATE } from '../../../../enums/common.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { MOCK_ATHENA_SERVICE } from '../../../../mocks/Service.mock';
import { getPipelineServiceHostIp } from '../../../../rest/ingestionPipelineAPI';
import * as LocalUtils from '../../../../utils/i18next/LocalUtil';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  buildValidConfig,
  flattenAuthTypeIntoConfig,
  getFilteredSchema,
  getSchemaWithSynthesizedAuthType,
  getUISchemaWithAuthFieldsAsSelect,
  loadConnectionSchema,
  wrapFlatCredentialsIntoAuthType,
} from '../../../../utils/ServiceConnectionUtils';
import EmbeddedConnectionConfigForm from './EmbeddedConnectionConfigForm';

const formData = {
  type: 'Mysql',
  scheme: 'mysql+pymysql',
  username: 'admin',
  authType: { password: '*********' },
  hostPort: 'host.docker.internal:3306',
};

type MockFormData = typeof formData & { ingestionRunner?: string };

type MockFormBuilderProps = {
  children?: ReactNode;
  isSubmitDisabled?: boolean;
  noValidate?: boolean;
  onCancel: () => void;
  onChange: (event: { formData: MockFormData }) => void;
  onSubmit: (event: { formData: MockFormData }) => void;
};

const ambiguousAuthSchema = {
  type: 'object',
  required: ['username'],
  properties: {
    username: {
      type: 'string',
    },
    authType: {
      oneOf: [
        {
          title: 'Basic Auth',
          type: 'object',
          properties: {
            password: {
              type: 'string',
            },
          },
          additionalProperties: false,
        },
        {
          title: 'Cloud SQL Auth',
          type: 'object',
          properties: {
            password: {
              type: 'string',
            },
            gcpConfig: {
              type: 'object',
            },
          },
          additionalProperties: false,
        },
      ],
    },
  },
};

const mockTestConnectionProps = jest.fn();

jest.mock('../../../../utils/DatabaseServiceUtils', () => ({
  getDatabaseConfig: jest
    .fn()
    .mockResolvedValue({ schema: MOCK_ATHENA_SERVICE }),
}));

jest.mock('../../../../utils/DashboardServiceUtils', () => ({
  getDashboardConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/MessagingServiceUtils', () => ({
  getMessagingConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/MetadataServiceUtils', () => ({
  getMetadataConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/MlmodelServiceUtils', () => ({
  getMlmodelConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/PipelineServiceUtils', () => ({
  getPipelineConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/SearchServiceUtils', () => ({
  getSearchServiceConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForSubmit: jest.fn(),
}));

jest.mock('../../../../utils/ServiceConnectionUtils', () => ({
  buildValidConfig: jest.fn().mockReturnValue({}),
  loadConnectionSchema: jest
    .fn()
    .mockResolvedValue({ schema: { type: 'object' }, uiSchema: {} }),
  EMPTY_CONNECTION_SCHEMA: { schema: {}, uiSchema: {} },
  getFilteredSchema: jest.fn().mockReturnValue({}),
  getMissingRequiredFieldsCount: jest.fn().mockReturnValue(0),
  getUISchemaWithNestedDefaultFilterFieldsHidden: jest.fn().mockReturnValue({}),
  getUISchemaWithAuthFieldsAsSelect: jest.fn().mockReturnValue({}),
  hasMissingRequiredFlatCredential: jest.fn().mockReturnValue(false),
  getSchemaWithSynthesizedAuthType: jest.fn((schema) => schema),
  wrapFlatCredentialsIntoAuthType: jest.fn((config) => config),
  flattenAuthTypeIntoConfig: jest.fn((config) => config),
}));

jest.mock('../../../common/AirflowMessageBanner/AirflowMessageBanner', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="airflowMessageBanner">AirflowMessageBanner</div>
    )
);

jest.mock('../../../common/FormBuilderV1/FormBuilderV1', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return React.forwardRef(function MockFormBuilderV1(
    {
      children,
      isSubmitDisabled,
      noValidate,
      onCancel,
      onChange,
      onSubmit,
    }: MockFormBuilderProps,
    ref: ForwardedRef<{ validateForm: () => boolean }>
  ) {
    React.useImperativeHandle(ref, () => ({
      validateForm: jest.fn().mockReturnValue(true),
    }));

    return (
      <div
        data-no-validate={String(Boolean(noValidate))}
        data-testid="form-builder-v1">
        {children}
        <button
          data-testid="change-valid-form"
          onClick={() => onChange({ formData })}>
          Change
        </button>
        <button
          data-testid="change-runner-form"
          onClick={() =>
            onChange({
              formData: { ...formData, ingestionRunner: 'collate-saas' },
            })
          }>
          Change Runner
        </button>
        <button
          data-testid="submit-button"
          disabled={isSubmitDisabled}
          onClick={() => onSubmit({ formData })}>
          Submit
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  });
});

jest.mock('../../../common/TestConnection/TestConnection', () =>
  jest.fn().mockImplementation((props) => {
    mockTestConnectionProps(props);

    return (
      <div>
        <p data-testid="test-connection">TestConnection</p>
        <button
          data-testid="mark-test-connection-success"
          onClick={() => props.onTestConnectionStatusChange?.(true)}>
          Success
        </button>
        <button
          data-testid="validate-required-fields"
          onClick={() => props.onValidateFormRequiredFields?.()}>
          Validate
        </button>
      </div>
    );
  })
);

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getPipelineServiceHostIp: jest.fn().mockReturnValue({
    data: { ip: '192.168.0.1' },
    status: 200,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({ t: (label: string) => label }),
}));

jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockImplementation(() => ({
      reason: 'reason message',
      isAirflowAvailable: true,
      platform: 'Argo',
    })),
  })
);

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    inlineAlertDetails: undefined,
  }),
}));

const mockOnSave = jest.fn().mockImplementation(() => Promise.resolve());
const mockOnFocus = jest.fn();

const mockProps = {
  disableTestConnection: false,
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceType: 'testType',
  status: LOADING_STATE.SUCCESS,
  onFocus: mockOnFocus,
  onSave: mockOnSave,
};

describe('EmbeddedConnectionConfigForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAirflowStatus as jest.Mock).mockReturnValue({
      reason: 'reason message',
      isAirflowAvailable: true,
      platform: 'Argo',
    });
    jest
      .spyOn(LocalUtils, 'Transi18next')
      .mockImplementation(() => <>message.airflow-host-ip-address</>);
  });

  it('renders the form builder v1', async () => {
    render(<EmbeddedConnectionConfigForm {...mockProps} />);

    expect(
      await screen.findByTestId('airflowMessageBanner')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('form-builder-v1')).toBeInTheDocument();
  });

  it('does not show no-config message when schema has content', async () => {
    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(screen.queryByTestId('no-config-available')).not.toBeInTheDocument();
  });

  it('shows no-config message when schema is empty', async () => {
    (loadConnectionSchema as jest.Mock).mockResolvedValueOnce({
      schema: {},
      uiSchema: {},
    });

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-config-available')
    ).toBeInTheDocument();
  });

  it('shows IP alert when airflow is available and host IP is fetched', async () => {
    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(await screen.findByTestId('ip-address')).toBeInTheDocument();
  });

  it('does not show IP alert when host IP fetch does not return success', async () => {
    (getPipelineServiceHostIp as jest.Mock).mockReturnValueOnce({
      data: {},
      status: 500,
    });

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(screen.queryByTestId('ip-address')).not.toBeInTheDocument();
  });

  it('shows fallback IP alert when host IP fetch fails', async () => {
    (getPipelineServiceHostIp as jest.Mock).mockRejectedValueOnce(
      new Error('failed')
    );

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(await screen.findByTestId('ip-address')).toBeInTheDocument();
  });

  it('falls back to the empty connection schema when schema loading fails', async () => {
    (loadConnectionSchema as jest.Mock).mockRejectedValueOnce(
      new Error('failed')
    );

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-config-available')
    ).toBeInTheDocument();
  });

  it('renders test connection even when airflow status is unavailable', async () => {
    (useAirflowStatus as jest.Mock).mockReturnValue({
      reason: 'reason message',
      isAirflowAvailable: false,
      platform: 'Argo',
    });

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(await screen.findByTestId('test-connection')).toBeInTheDocument();
  });

  it('calls onSave with formatted form data when submit button clicked', async () => {
    const flattenedFormData = {
      ...formData,
      password: 'secret',
    };
    const mockFormatted = { ...flattenedFormData };

    (flattenAuthTypeIntoConfig as jest.Mock).mockReturnValueOnce(
      flattenedFormData
    );
    (formatFormDataForSubmit as jest.Mock).mockReturnValue(mockFormatted);

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });
    const submitButton = await screen.findByTestId('submit-button');

    fireEvent.click(submitButton);

    expect(flattenAuthTypeIntoConfig).toHaveBeenCalledWith(formData, {
      type: 'object',
    });
    expect(formatFormDataForSubmit).toHaveBeenCalledWith(flattenedFormData);
    expect(mockOnSave).toHaveBeenCalledWith({
      formData: mockFormatted,
    });
  });

  it('wraps flat credentials into authType for rendering', async () => {
    const schema = {
      type: 'object',
      properties: {
        password: {
          type: 'string',
          format: 'password',
        },
        privateKey: {
          type: 'string',
          format: 'password',
        },
      },
    };
    const rawConfig = {
      password: 'secret',
    };
    const wrappedConfig = {
      authType: {
        password: 'secret',
      },
    };

    (loadConnectionSchema as jest.Mock).mockResolvedValueOnce({
      schema,
      uiSchema: {},
    });
    (buildValidConfig as jest.Mock).mockReturnValueOnce(rawConfig);
    (wrapFlatCredentialsIntoAuthType as jest.Mock).mockReturnValueOnce(
      wrappedConfig
    );
    (getSchemaWithSynthesizedAuthType as jest.Mock).mockReturnValueOnce(schema);

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(wrapFlatCredentialsIntoAuthType).toHaveBeenCalledWith(
      rawConfig,
      schema
    );
    expect(getSchemaWithSynthesizedAuthType).toHaveBeenCalledWith(
      schema,
      expect.any(Function)
    );
    expect(getUISchemaWithAuthFieldsAsSelect).toHaveBeenCalled();
  });

  it('respects the parent submit disabled state', async () => {
    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} isSubmitDisabled />);
    });

    expect(await screen.findByTestId('submit-button')).toBeDisabled();
  });

  it('does not gate the submit button on test connection results', async () => {
    await act(async () => {
      render(
        <EmbeddedConnectionConfigForm {...mockProps} requireTestConnection />
      );
    });

    expect(await screen.findByTestId('submit-button')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('mark-test-connection-success'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });
  });

  it('passes backend-ready flattened config to test connection', async () => {
    const flattenedFormData = {
      ...formData,
      password: 'secret',
    };

    (flattenAuthTypeIntoConfig as jest.Mock).mockReturnValue(flattenedFormData);

    await act(async () => {
      render(
        <EmbeddedConnectionConfigForm {...mockProps} requireTestConnection />
      );
    });

    fireEvent.click(screen.getByTestId('change-valid-form'));

    const testConnectionProps = mockTestConnectionProps.mock.calls.at(-1)?.[0];

    expect(testConnectionProps.getData()).toEqual(flattenedFormData);
    expect(flattenAuthTypeIntoConfig).toHaveBeenCalledWith(formData, {
      type: 'object',
    });
  });

  it('passes required field validation to test connection', async () => {
    await act(async () => {
      render(
        <EmbeddedConnectionConfigForm {...mockProps} requireTestConnection />
      );
    });

    fireEvent.click(screen.getByTestId('validate-required-fields'));

    expect(mockTestConnectionProps.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        onValidateFormRequiredFields: expect.any(Function),
      })
    );
  });

  it('tracks ingestion runner changes from the form data', async () => {
    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    fireEvent.click(screen.getByTestId('change-runner-form'));

    await waitFor(() => {
      expect(mockTestConnectionProps.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          getData: expect.any(Function),
        })
      );
    });
  });

  it('enables next after a required test succeeds when auth schema validation is ambiguous', async () => {
    (loadConnectionSchema as jest.Mock).mockResolvedValueOnce({
      schema: ambiguousAuthSchema,
      uiSchema: {},
    });
    (getFilteredSchema as jest.Mock).mockReturnValueOnce(
      ambiguousAuthSchema.properties
    );

    await act(async () => {
      render(
        <EmbeddedConnectionConfigForm {...mockProps} requireTestConnection />
      );
    });

    expect(screen.getByTestId('form-builder-v1')).toHaveAttribute(
      'data-no-validate',
      'true'
    );

    fireEvent.click(screen.getByTestId('change-valid-form'));
    fireEvent.click(screen.getByTestId('mark-test-connection-success'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });
  });
});

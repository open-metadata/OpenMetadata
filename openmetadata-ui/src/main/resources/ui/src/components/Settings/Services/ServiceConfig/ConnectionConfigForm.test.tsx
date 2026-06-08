/*
 *  Copyright 2024 Collate.
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
import { act, forwardRef } from 'react';
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
  hasMissingRequiredFlatCredential,
  loadConnectionSchema,
  wrapFlatCredentialsIntoAuthType,
} from '../../../../utils/ServiceConnectionUtils';
import ConnectionConfigForm from './ConnectionConfigForm';

const mockServicesData = {
  id: '1',
  description: 'Test service',
  ingestionSchedule: {
    repeatFrequency: 'daily',
    startDate: '2022-01-01',
  },
  name: 'Test Service',
  serviceType: 'database',
  schema: {
    hostPort: 'localhost:5432',
    password: 'password',
    username: 'username',
    database: 'test_db',
    connectionArguments: {
      arg1: 'value1',
      arg2: 'value2',
    },
    connectionOptions: {
      option1: 'value1',
      option2: 'value2',
    },
  },
  brokers: ['broker1', 'broker2'],
  schemaRegistry: 'http://localhost:8081',
  sourceUrl: 'http://localhost:8080',
  username: 'username',
  password: 'password',
  url: 'http://localhost:8080',
  api_key: 'api_key',
  site_name: 'site_name',
  api_version: 'v1',
  server: 'localhost',
  env: 'development',
};

const formData = {
  type: 'Mysql',
  scheme: 'mysql+pymysql',
  username: 'admin',
  authType: {
    password: '*********',
  },
  hostPort: 'host.docker.internal:3306',
  sslKey: 'test',
  supportsMetadataExtraction: true,
  supportsDBTExtraction: true,
  supportsProfiler: true,
  supportsQueryComment: true,
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
  getDatabaseConfig: jest.fn().mockResolvedValue({
    schema: MOCK_ATHENA_SERVICE,
  }),
}));

jest.mock('../../../../utils/DashboardServiceUtils', () => ({
  getDashboardConfig: jest.fn().mockResolvedValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/MessagingServiceUtils', () => ({
  getMessagingConfig: jest.fn().mockResolvedValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/MetadataServiceUtils', () => ({
  getMetadataConfig: jest.fn().mockResolvedValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/MlmodelServiceUtils', () => ({
  getMlmodelConfig: jest.fn().mockResolvedValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/PipelineServiceUtils', () => ({
  getPipelineConfig: jest.fn().mockResolvedValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/SearchServiceUtils', () => ({
  getSearchServiceConfig: jest.fn().mockResolvedValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForRender: jest.fn((data) => data),
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

jest.mock('../../../common/AirflowMessageBanner/AirflowMessageBanner', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="airflowMessageBanner">AirflowMessageBanner</div>
    );
});

jest.mock('../../../common/FormBuilderV1/FormBuilderV1', () =>
  forwardRef(
    jest
      .fn()
      .mockImplementation(
        ({
          children,
          isSubmitDisabled,
          noValidate,
          onChange,
          onSubmit,
          onCancel,
        }) => (
          <div
            data-no-validate={String(Boolean(noValidate))}
            data-testid="form-builder">
            {children}
            <button
              data-testid="change-valid-form"
              onClick={() => onChange({ formData })}>
              Change FormBuilder
            </button>
            <button
              data-testid="change-edited-form"
              onClick={() =>
                onChange({
                  formData: {
                    ...formData,
                    username: 'changed-admin',
                  },
                })
              }>
              Change FormBuilder With Edits
            </button>
            <button
              data-testid="submit-button"
              disabled={isSubmitDisabled}
              onClick={() => onSubmit({ formData })}>
              Submit FormBuilder
            </button>
            <button onClick={onCancel}>Cancel FormBuilder</button>
          </div>
        )
      )
  )
);

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
      </div>
    );
  })
);

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getPipelineServiceHostIp: jest.fn().mockReturnValue({
    data: {
      ip: '192.168.0.1',
    },
    status: 200,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (label: string) => label,
  }),
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

const mockHandleUpdate = jest
  .fn()
  .mockImplementation(() => Promise.resolve(mockServicesData));

const mockOnFocus = jest.fn();
const mockProps = {
  disableTestConnection: false,
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceType: 'testType',
  status: LOADING_STATE.SUCCESS,
  onFocus: mockOnFocus,
  onSave: mockHandleUpdate,
};

describe('ServiceConfig', () => {
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

  it('should render Service Config', async () => {
    render(<ConnectionConfigForm {...mockProps} />);

    expect(
      await screen.findByTestId('airflowMessageBanner')
    ).toBeInTheDocument();

    expect(await screen.findByTestId('form-builder')).toBeInTheDocument();
  });

  it('should not render no config available message if form data has schema', async () => {
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    expect(screen.queryByTestId('no-config-available')).not.toBeInTheDocument();
  });

  it('should display airflow-host-ip-address', async () => {
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });
    await act(async () => {
      expect(await screen.findByTestId('ip-address')).toBeInTheDocument();
      expect(
        await screen.findByText('message.airflow-host-ip-address')
      ).toBeInTheDocument();
    });
  });

  it('should render no config available if form data has no schema', async () => {
    (loadConnectionSchema as jest.Mock).mockResolvedValueOnce({
      schema: {},
      uiSchema: {},
    });
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-config-available')
    ).toBeInTheDocument();
  });

  it('should render no config available if schema loading fails', async () => {
    (loadConnectionSchema as jest.Mock).mockRejectedValueOnce(
      new Error('schema failed')
    );

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-config-available')
    ).toBeInTheDocument();
  });

  it('should call onSubmit when submit button is clicked', async () => {
    const flattenedFormData = {
      ...formData,
      password: 'secret',
    };

    (flattenAuthTypeIntoConfig as jest.Mock).mockReturnValueOnce(
      flattenedFormData
    );
    const mockSubmit = (formatFormDataForSubmit as jest.Mock).mockReturnValue({
      ...flattenedFormData,
    });

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });
    const submitButton = await screen.findByTestId('submit-button');

    fireEvent.click(submitButton);

    expect(flattenAuthTypeIntoConfig).toHaveBeenCalledWith(formData, {
      type: 'object',
    });
    expect(mockSubmit).toHaveBeenCalledWith(flattenedFormData);
  });

  it('should wrap flat credentials into authType for rendering', async () => {
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
      render(<ConnectionConfigForm {...mockProps} />);
    });

    expect(wrapFlatCredentialsIntoAuthType).toHaveBeenCalledWith(
      rawConfig,
      schema
    );
    expect(getSchemaWithSynthesizedAuthType).toHaveBeenCalledWith(
      schema,
      expect.any(Function)
    );
  });

  it('should disable next until required schema fields are filled', async () => {
    (loadConnectionSchema as jest.Mock).mockResolvedValueOnce({
      schema: {
        type: 'object',
        required: ['username'],
        properties: {
          username: {
            type: 'string',
          },
        },
      },
      uiSchema: {},
    });
    (getFilteredSchema as jest.Mock).mockReturnValueOnce({
      username: {
        type: 'string',
      },
    });

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    expect(await screen.findByTestId('submit-button')).toBeDisabled();

    fireEvent.click(screen.getByTestId('change-valid-form'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });
  });

  it('should respect the parent submit disabled state', async () => {
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} isSubmitDisabled />);
    });

    expect(await screen.findByTestId('submit-button')).toBeDisabled();
  });

  it('should disable next until the test connection succeeds when required', async () => {
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} requireTestConnection />);
    });

    expect(await screen.findByTestId('submit-button')).toBeDisabled();

    fireEvent.click(screen.getByTestId('mark-test-connection-success'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });
  });

  it('should pass backend-ready flattened config to test connection', async () => {
    const flattenedFormData = {
      ...formData,
      password: 'secret',
    };

    (flattenAuthTypeIntoConfig as jest.Mock).mockReturnValue(flattenedFormData);

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} requireTestConnection />);
    });

    fireEvent.click(screen.getByTestId('change-valid-form'));

    const testConnectionProps = mockTestConnectionProps.mock.calls.at(-1)?.[0];

    expect(testConnectionProps.getData()).toEqual(flattenedFormData);
    expect(flattenAuthTypeIntoConfig).toHaveBeenCalledWith(formData, {
      type: 'object',
    });
  });

  it('should expose required-field validation to the test connection component', async () => {
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} requireTestConnection />);
    });

    const testConnectionProps = mockTestConnectionProps.mock.calls.at(-1)?.[0];

    expect(testConnectionProps.onValidateFormRequiredFields()).toBe(false);
  });

  it('should use selected ingestion runner when deciding whether to show the IP alert', async () => {
    (useAirflowStatus as jest.Mock).mockReturnValue({
      reason: 'reason message',
      isAirflowAvailable: true,
      platform: 'Hybrid',
    });
    (buildValidConfig as jest.Mock).mockReturnValueOnce({
      ingestionRunner: 'CollateSaaS',
    });

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('ip-address')).toBeInTheDocument();
    });
  });

  it('should enable next after a required test succeeds when auth schema validation is ambiguous', async () => {
    (loadConnectionSchema as jest.Mock).mockResolvedValueOnce({
      schema: ambiguousAuthSchema,
      uiSchema: {},
    });
    (getFilteredSchema as jest.Mock).mockReturnValueOnce(
      ambiguousAuthSchema.properties
    );

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} requireTestConnection />);
    });

    expect(screen.getByTestId('form-builder')).toHaveAttribute(
      'data-no-validate',
      'true'
    );

    fireEvent.click(screen.getByTestId('change-valid-form'));
    fireEvent.click(screen.getByTestId('mark-test-connection-success'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });
  });

  it('should not submit or move to the next step when the test connection succeeds', async () => {
    const onSave = jest.fn();

    await act(async () => {
      render(
        <ConnectionConfigForm
          {...mockProps}
          requireTestConnection
          onSave={onSave}
        />
      );
    });

    fireEvent.click(screen.getByTestId('mark-test-connection-success'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('should keep next enabled when the form emits an equivalent change after test succeeds', async () => {
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} requireTestConnection />);
    });

    fireEvent.click(screen.getByTestId('change-valid-form'));
    fireEvent.click(screen.getByTestId('mark-test-connection-success'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('change-valid-form'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });
  });

  it('should disable next when the form changes after test succeeds', async () => {
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} requireTestConnection />);
    });

    fireEvent.click(screen.getByTestId('change-valid-form'));
    fireEvent.click(screen.getByTestId('mark-test-connection-success'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('change-edited-form'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeDisabled();
    });
  });

  it('should disable next until a flat credential method is filled', async () => {
    (hasMissingRequiredFlatCredential as jest.Mock).mockReturnValueOnce(true);

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    expect(await screen.findByTestId('submit-button')).toBeDisabled();
  });

  it('should render test connection even when airflow status is unavailable', async () => {
    (useAirflowStatus as jest.Mock).mockReturnValue({
      reason: 'reason message',
      isAirflowAvailable: false,
      platform: 'Argo',
    });

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    expect(await screen.findByTestId('test-connection')).toBeInTheDocument();
  });

  it('should not display host ip if unable to fetch', async () => {
    (getPipelineServiceHostIp as jest.Mock).mockRejectedValueOnce(new Error());
    render(<ConnectionConfigForm {...mockProps} />);
    await act(async () => {
      expect(screen.queryByTestId('ip-address')).not.toBeInTheDocument();
    });
  });

  it('should not display host ip if status is is not 200', async () => {
    (getPipelineServiceHostIp as jest.Mock).mockImplementationOnce(() => ({
      data: {
        ip: '192.168.0.1',
      },
      status: 201,
    }));
    render(<ConnectionConfigForm {...mockProps} />);
    await act(async () => {
      expect(screen.queryByTestId('ip-address')).not.toBeInTheDocument();
    });
  });

  it('should render with correct brandName keys', async () => {
    const mockTransi18next = jest.fn(({ values }) => (
      <div data-testid="transi18next-mock">
        {values?.hostIp && `Host IP: ${values.hostIp}`}
      </div>
    ));

    jest.spyOn(LocalUtils, 'Transi18next').mockImplementation(mockTransi18next);

    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    const ipAddress = await screen.findByTestId('ip-address');

    expect(ipAddress).toBeInTheDocument();

    expect(mockTransi18next).toHaveBeenCalledWith(
      expect.objectContaining({
        i18nKey: 'message.airflow-host-ip-address',
        values: expect.objectContaining({
          hostIp: '192.168.0.1',
        }),
      }),
      expect.anything()
    );
  });
});

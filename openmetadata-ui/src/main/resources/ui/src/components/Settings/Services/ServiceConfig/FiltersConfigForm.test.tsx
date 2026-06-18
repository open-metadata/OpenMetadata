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
  within,
} from '@testing-library/react';
import { LoadingState } from 'Models';
import { ServiceCategory } from '../../../../enums/service.enum';
import { DatabaseServiceType } from '../../../../generated/entity/services/databaseService';
import {
  ConfigData,
  ServicesType,
} from '../../../../interface/service.interface';
import FiltersConfigForm from './FiltersConfigForm';
import { FiltersConfigFormProps } from './FiltersConfigForm.interface';

const translations: Record<string, string> = {
  'label.add': 'Add',
  'label.always-exclude': 'Always exclude',
  'label.api-collection': 'API Collection',
  'label.api-collection-plural': 'API Collections',
  'label.back': 'Back',
  'label.cancel': 'Cancel',
  'label.contains-lowercase': 'contains',
  'label.create-and-deploy': 'Create & Deploy',
  'label.database': 'Database',
  'label.database-plural': 'Databases',
  'label.ends-with': 'ends with',
  'label.exclude-entity': 'Exclude {{entity}}',
  'label.exclude-system-entity': 'Exclude system {{entity}}',
  'label.hide-equivalent-regex': 'Hide equivalent regex',
  'label.include-entity': 'Include {{entity}}',
  'label.is-exactly': 'is exactly',
  'label.matches-regex': 'matches regex',
  'label.only-specific-entity': 'Only specific {{entity}}',
  'label.preview': 'Preview',
  'label.remove': 'Remove',
  'label.rule-lowercase': 'rule',
  'label.rule-lowercase-plural': 'rules',
  'label.save': 'Save',
  'label.scan-all-entity': 'Scan all {{entity}}',
  'label.schema': 'Schema',
  'label.schema-plural': 'Schemas',
  'label.show-equivalent-regex': 'Show equivalent regex',
  'label.starts-with': 'starts with',
  'label.stored-procedure': 'Stored Procedure',
  'label.stored-procedure-plural': 'Stored Procedures',
  'label.table': 'Table',
  'label.table-plural': 'Tables',
  'label.what-should-we-ingest': 'What should we ingest?',
  'label.what-to-scan': 'What to scan',
  'message.connected-to-host': 'Connected to {{host}}',
  'message.connection-verified-ingestion-scope':
    'Connection verified. Define scope as rules below.',
  'message.entity-name-example': 'a {{entity}} name',
  'message.example-value': 'e.g. {{value}}',
  'message.excludes-regex-line': 'excludes += {{regex}}',
  'message.filter-scope-all-summary':
    'All {{entity}} readable by this connector are in scope.',
  'message.filter-scope-exclude-rule-count': 'Excluding 1 rule',
  'message.filter-scope-exclude-rules-count': 'Excluding {{count}} rules',
  'message.filter-scope-exclude-summary':
    'All {{entity}} readable by this connector are in scope, then names matching {{excludeCount}} exclude {{excludeRule}} are removed.',
  'message.filter-scope-include-exclude-summary':
    'Only {{entity}} matching {{includeCount}} include {{includeRule}} are in scope, then names matching {{excludeCount}} exclude {{excludeRule}} are removed.',
  'message.filter-scope-include-rule-count': 'Including 1 rule',
  'message.filter-scope-include-rules-count': 'Including {{count}} rules',
  'message.filter-scope-include-summary':
    'Only {{entity}} matching {{includeCount}} include {{includeRule}} are in scope.',
  'message.filter-scope-scanning-all': 'Scanning all',
  'message.include-only-entities-where-name':
    'Include only {{entity}} where the name...',
  'message.includes-regex-line': 'includes += {{regex}}',
  'message.no-filter-patterns-available':
    'No filter patterns are available for this connector.',
  'message.what-to-ingest-description':
    'Agents deploy on create and immediately start pulling metadata.',
};

const translate = (key: string, values?: Record<string, string | number>) => {
  const template = translations[key] ?? key;

  return Object.entries(values ?? {}).reduce(
    (message, [valueKey, value]) =>
      message.replace(`{{${valueKey}}}`, String(value)),
    template
  );
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    inlineAlertDetails: undefined,
  }),
}));

jest.mock('../../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForSubmit: jest.fn((data) => data),
}));

jest.mock('../../../../utils/ServiceConnectionUtils', () => {
  const actual = jest.requireActual('../../../../utils/ServiceConnectionUtils');

  return {
    ...actual,
    buildValidConfig: jest.fn(),
    loadConnectionSchema: jest.fn(),
  };
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

const mockFormatFormDataForSubmit = jest.requireMock(
  '../../../../utils/JSONSchemaFormUtils'
).formatFormDataForSubmit;

const mockUseApplicationStore = jest.requireMock(
  '../../../../hooks/useApplicationStore'
).useApplicationStore;

const filterPatternProperty = (
  title: string,
  defaultPattern?: { excludes?: string[]; includes?: string[] }
) => ({
  title,
  description: `Regex for ${title}`,
  type: 'object',
  javaType: 'org.openmetadata.schema.metadataIngestion.FilterPattern',
  ...(defaultPattern ? { default: defaultPattern } : {}),
  properties: {
    excludes: {
      items: {
        type: 'string',
      },
      type: 'array',
    },
    includes: {
      items: {
        type: 'string',
      },
      type: 'array',
    },
  },
});

const connectionSchema = {
  schema: {
    additionalProperties: true,
    properties: {
      databaseFilterPattern: filterPatternProperty(
        'Default Database Filter Pattern'
      ),
      hostPort: {
        type: 'string',
      },
      schemaFilterPattern: filterPatternProperty(
        'Default Schema Filter Pattern',
        {
          excludes: ['^information_schema$', '^performance_schema$'],
          includes: [],
        }
      ),
      storedProcedureFilterPattern: filterPatternProperty(
        'Default Stored Procedure Filter Pattern'
      ),
      tableFilterPattern: filterPatternProperty('Default Table Filter Pattern'),
    },
    type: 'object',
  },
  uiSchema: {},
};

const buildServiceData = (config: Record<string, unknown>) =>
  ({
    connection: {
      config,
    },
  } as ServicesType);

const renderForm = async (props: Partial<FiltersConfigFormProps> = {}) => {
  const defaultProps: FiltersConfigFormProps = {
    cancelText: 'Back',
    data: buildServiceData({
      hostPort: 'localhost:3306',
    }),
    serviceCategory: ServiceCategory.DATABASE_SERVICES,
    serviceType: DatabaseServiceType.Mysql,
    status: 'initial' as LoadingState,
    onCancel: jest.fn(),
    onFocus: jest.fn(),
    onSave: jest.fn(),
    showConnectedMessage: true,
  };

  await act(async () => {
    render(<FiltersConfigForm {...defaultProps} {...props} />);
  });

  await screen.findByTestId('filters-config-form');

  return {
    props: {
      ...defaultProps,
      ...props,
    },
  };
};

describe('FiltersConfigForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadConnectionSchema.mockResolvedValue(connectionSchema);
    mockBuildValidConfig.mockImplementation(
      (data?: ServicesType) => data?.connection?.config ?? {}
    );
    mockUseApplicationStore.mockReturnValue({
      inlineAlertDetails: undefined,
    });
  });

  it('renders the ingest design and converts default regex into readable chips', async () => {
    await renderForm();

    expect(screen.getByText('What should we ingest?')).toBeInTheDocument();
    expect(screen.getByText('Connected to localhost:3306')).toBeInTheDocument();
    expect(screen.getByText('Databases')).toBeInTheDocument();
    expect(screen.getByText('Schemas')).toBeInTheDocument();
    expect(screen.getByText('Tables')).toBeInTheDocument();
    expect(screen.getByText('Stored Procedures')).toBeInTheDocument();

    const schemaSection = screen.getByTestId(
      'filter-section-schemaFilterPattern'
    );

    expect(
      within(schemaSection).getAllByText('is exactly', {
        selector: '.filters-config-form__chip-operator',
      })
    ).toHaveLength(2);
    expect(
      within(schemaSection).getAllByText('information_schema')
    ).toHaveLength(2);
    expect(
      within(schemaSection).getAllByText('performance_schema')
    ).toHaveLength(2);
    expect(
      within(schemaSection).queryByText('^information_schema$')
    ).not.toBeInTheDocument();
    expect(
      within(schemaSection).getByText(
        'All schemas readable by this connector are in scope, then names matching 2 exclude rules are removed.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('ANALYTICS')).not.toBeInTheDocument();
    expect(screen.queryByText('DIM_CUSTOMER')).not.toBeInTheDocument();

    fireEvent.click(
      within(schemaSection).getByRole('button', {
        name: 'Show equivalent regex',
      })
    );

    expect(
      within(schemaSection).getByText('excludes += ^information_schema$')
    ).toBeInTheDocument();
  });

  it('adds readable exclude rules and submits them as filter-pattern regex', async () => {
    const onSave = jest.fn();

    await renderForm({ onSave });

    const schemaSection = screen.getByTestId(
      'filter-section-schemaFilterPattern'
    );

    fireEvent.change(within(schemaSection).getByPlaceholderText('e.g. TMP_'), {
      target: {
        value: 'TMP_',
      },
    });
    fireEvent.click(
      within(schemaSection).getAllByRole('button', {
        name: 'Add',
      })[0]
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          schemaFilterPattern: {
            excludes: ['^information_schema$', '^performance_schema$', '^TMP_'],
            includes: [],
          },
        }),
      });
    });

    expect(mockFormatFormDataForSubmit).toHaveBeenCalled();
  });

  it('supports only-specific includes for a collapsed section', async () => {
    const onSave = jest.fn();

    await renderForm({ onSave });

    const tableSection = screen.getByTestId(
      'filter-section-tableFilterPattern'
    );

    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: /Tables/,
      })
    );
    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: 'Only specific tables',
      })
    );
    fireEvent.change(
      within(tableSection).getByPlaceholderText('e.g. a table name'),
      {
        target: {
          value: 'orders',
        },
      }
    );
    fireEvent.click(
      within(tableSection).getAllByRole('button', {
        name: 'Add',
      })[0]
    );

    await waitFor(() => {
      expect(
        within(tableSection).getByText('Include rule')
      ).toBeInTheDocument();
      expect(
        within(tableSection).getByText(
          'Only tables matching 1 include rule are in scope.'
        )
      ).toBeInTheDocument();
      expect(within(tableSection).getAllByText('orders')).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          tableFilterPattern: {
            excludes: [],
            includes: ['orders'],
          },
        }),
      });
    });
  });

  it('keeps existing complex regex readable as regex and preserves it on save', async () => {
    const onSave = jest.fn();

    await renderForm({
      data: buildServiceData({
        hostPort: 'localhost:3306',
        tableFilterPattern: {
          excludes: ['^(?!tmp_).*'],
          includes: [],
        },
      }),
      onSave,
    });

    const tableSection = await screen.findByTestId(
      'filter-section-tableFilterPattern'
    );

    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: /Tables/,
      })
    );

    expect(
      within(tableSection).getAllByText('matches regex', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(within(tableSection).getAllByText('^(?!tmp_).*')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          tableFilterPattern: {
            excludes: ['^(?!tmp_).*'],
            includes: [],
          },
        }),
      });
    });
  });

  it('loads existing saved regex filters as readable operators and preserves original regex', async () => {
    const onSave = jest.fn();
    const existingTablePattern = {
      excludes: ['^tmp_.*', '^.*scratch.*$', 'manual\\.table'],
      includes: ['^orders$', '^finance_.*$', '.*_archive$'],
    };

    await renderForm({
      data: buildServiceData({
        hostPort: 'localhost:3306',
        tableFilterPattern: existingTablePattern,
      }),
      onSave,
    });

    const tableSection = await screen.findByTestId(
      'filter-section-tableFilterPattern'
    );

    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: /Tables/,
      })
    );

    expect(
      within(tableSection).getByText(
        'Only tables matching 3 include rules are in scope, then names matching 3 exclude rules are removed.'
      )
    ).toBeInTheDocument();

    expect(
      within(tableSection).getAllByText('is exactly', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(tableSection).getAllByText('starts with', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(tableSection).getAllByText('ends with', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(tableSection).getAllByText('contains', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(2);

    expect(within(tableSection).getAllByText('orders')).toHaveLength(2);
    expect(within(tableSection).getAllByText('finance_')).toHaveLength(2);
    expect(within(tableSection).getAllByText('_archive')).toHaveLength(2);
    expect(within(tableSection).getAllByText('tmp_')).toHaveLength(2);
    expect(within(tableSection).getAllByText('scratch')).toHaveLength(2);
    expect(within(tableSection).getAllByText('manual.table')).toHaveLength(2);

    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: 'Show equivalent regex',
      })
    );

    expect(
      within(tableSection).getByText('includes += ^orders$')
    ).toBeInTheDocument();
    expect(
      within(tableSection).getByText('includes += ^finance_.*$')
    ).toBeInTheDocument();
    expect(
      within(tableSection).getByText('includes += .*_archive$')
    ).toBeInTheDocument();
    expect(
      within(tableSection).getByText('excludes += ^tmp_.*')
    ).toBeInTheDocument();
    expect(
      within(tableSection).getByText('excludes += ^.*scratch.*$')
    ).toBeInTheDocument();
    expect(
      within(tableSection).getByText('excludes += manual\\.table')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          tableFilterPattern: existingTablePattern,
        }),
      });
    });
  });

  it('preserves supported regex patterns while showing readable operators', async () => {
    const onSave = jest.fn();
    const configuredPatterns = [
      '   ',
      '^exact$',
      '^.*contains.*$',
      '^prefix.*$',
      '^.*suffix$',
      '^legacy.*',
      '^onlyStart',
      '.*onlyEnd$',
      'endOnly$',
      '.*wrapped.*',
      'plain',
      'file\\.json',
      '^(?!tmp_).*',
    ];

    mockLoadConnectionSchema.mockResolvedValue({
      schema: {
        properties: {
          tableFilterPattern: filterPatternProperty(
            'Default Table Filter Pattern',
            {
              excludes: configuredPatterns,
              includes: [],
            }
          ),
        },
        type: 'object',
      },
      uiSchema: {},
    });

    await renderForm({ onSave });

    const tableSection = screen.getByTestId(
      'filter-section-tableFilterPattern'
    );

    expect(
      within(tableSection).getAllByText('is exactly', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(tableSection).getAllByText('contains', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(tableSection).getAllByText('starts with', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(tableSection).getAllByText('ends with', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(tableSection).getAllByText('matches regex', {
        selector: '.filters-config-form__chip-operator',
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(within(tableSection).getAllByText('file.json')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          tableFilterPattern: {
            excludes: configuredPatterns,
            includes: [],
          },
        }),
      });
    });
  });

  it('builds include and exclude regex from the selected readable operators', async () => {
    const onFocus = jest.fn();
    const onSave = jest.fn();

    await renderForm({ onFocus, onSave });

    const tableSection = screen.getByTestId(
      'filter-section-tableFilterPattern'
    );

    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: /Tables/,
      })
    );
    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: 'Only specific tables',
      })
    );

    const [includeOperatorContainer, excludeOperatorContainer] =
      within(tableSection).getAllByTestId('relation-selector');
    const includeInput =
      within(tableSection).getByPlaceholderText('e.g. a table name');

    fireEvent.click(within(includeOperatorContainer).getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'is exactly' }));
    fireEvent.change(includeInput, {
      target: {
        value: 'orders.v1',
      },
    });
    fireEvent.keyDown(includeInput, { key: 'Enter' });

    fireEvent.click(within(includeOperatorContainer).getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'ends with' }));
    fireEvent.change(includeInput, {
      target: {
        value: '_fact',
      },
    });
    fireEvent.click(
      within(tableSection).getAllByRole('button', {
        name: 'Add',
      })[0]
    );

    fireEvent.click(within(excludeOperatorContainer).getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'matches regex' }));

    const excludeInput =
      within(tableSection).getByPlaceholderText('^prefix.*$');

    fireEvent.focus(excludeInput);
    fireEvent.blur(excludeInput);
    fireEvent.change(excludeInput, {
      target: {
        value: '^tmp_[0-9]+$',
      },
    });
    fireEvent.click(
      within(tableSection).getAllByRole('button', {
        name: 'Add',
      })[1]
    );
    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: 'Show equivalent regex',
      })
    );

    expect(onFocus).toHaveBeenCalledWith('tableFilterPattern');
    expect(onFocus).toHaveBeenCalledWith('');
    expect(
      within(tableSection).getByText('includes += ^orders\\.v1$')
    ).toBeInTheDocument();
    expect(
      within(tableSection).getByText('includes += _fact$')
    ).toBeInTheDocument();
    expect(
      within(tableSection).getByText('excludes += ^tmp_[0-9]+$')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          tableFilterPattern: {
            excludes: ['^tmp_[0-9]+$'],
            includes: ['^orders\\.v1$', '_fact$'],
          },
        }),
      });
    });
  });

  it('removes include and exclude chips before saving', async () => {
    const onSave = jest.fn();

    await renderForm({
      data: buildServiceData({
        hostPort: 'localhost:3306',
        tableFilterPattern: {
          excludes: ['^tmp_'],
          includes: ['orders'],
        },
      }),
      onSave,
    });

    const tableSection = screen.getByTestId(
      'filter-section-tableFilterPattern'
    );

    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: /Tables/,
      })
    );

    within(tableSection)
      .getAllByRole('button', {
        name: 'Remove',
      })
      .forEach((button) => fireEvent.click(button));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          tableFilterPattern: {
            excludes: [],
            includes: [],
          },
        }),
      });
    });
  });

  it('clears includes when switching a restricted section back to scan all', async () => {
    const onSave = jest.fn();

    await renderForm({
      data: buildServiceData({
        hostPort: 'localhost:3306',
        tableFilterPattern: {
          excludes: ['^tmp_'],
          includes: ['orders'],
        },
      }),
      onSave,
    });

    const tableSection = screen.getByTestId(
      'filter-section-tableFilterPattern'
    );

    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: /Tables/,
      })
    );
    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: 'Scan all tables',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          tableFilterPattern: {
            excludes: ['^tmp_'],
            includes: [],
          },
        }),
      });
    });
  });

  it('ignores empty composer submissions', async () => {
    const onSave = jest.fn();

    await renderForm({ onSave });

    const tableSection = screen.getByTestId(
      'filter-section-tableFilterPattern'
    );

    fireEvent.click(
      within(tableSection).getByRole('button', {
        name: /Tables/,
      })
    );
    fireEvent.keyDown(within(tableSection).getByPlaceholderText('e.g. TMP_'), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          tableFilterPattern: {
            excludes: [],
            includes: [],
          },
        }),
      });
    });
  });

  it('adds schema system excludes when they are not already enabled', async () => {
    const onSave = jest.fn();

    await renderForm({
      data: buildServiceData({
        hostPort: 'localhost:3306',
        schemaFilterPattern: {
          excludes: [],
          includes: [],
        },
      }),
      onSave,
    });

    const schemaSection = screen.getByTestId(
      'filter-section-schemaFilterPattern'
    );

    fireEvent.click(
      within(schemaSection).getByRole('switch', {
        name: 'Exclude system schemas',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          schemaFilterPattern: {
            excludes: ['^information_schema$', '^performance_schema$'],
            includes: [],
          },
        }),
      });
    });
  });

  it('lets users disable schema system excludes', async () => {
    const onSave = jest.fn();

    await renderForm({ onSave });

    const schemaSection = screen.getByTestId(
      'filter-section-schemaFilterPattern'
    );

    fireEvent.click(
      within(schemaSection).getByRole('switch', {
        name: 'Exclude system schemas',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          schemaFilterPattern: {
            excludes: [],
            includes: [],
          },
        }),
      });
    });
  });

  it('shows an empty state when a connector has no filter fields', async () => {
    const onSave = jest.fn();

    mockLoadConnectionSchema.mockResolvedValue({
      schema: {
        properties: {
          hostPort: {
            type: 'string',
          },
        },
        type: 'object',
      },
      uiSchema: {},
    });

    await renderForm({ onSave });

    expect(screen.getByTestId('no-config-available')).toHaveTextContent(
      'No filter patterns are available for this connector.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        formData: {},
      } as IChangeEvent<ConfigData>);
    });
  });

  it('adds Snowflake sample data to database system excludes for the Snowflake connector design', async () => {
    await renderForm({
      data: buildServiceData({
        account: 'fsad',
      }),
      serviceType: DatabaseServiceType.Snowflake,
    });

    const databaseSection = screen.getByTestId(
      'filter-section-databaseFilterPattern'
    );

    expect(
      screen.getByText('Connected to fsad.snowflakecomputing.com')
    ).toBeInTheDocument();
    expect(
      within(databaseSection).getAllByText('snowflake_sample_data')
    ).toHaveLength(2);
  });

  it('does not trust Snowflake host substrings outside the hostname in scope copy', async () => {
    await renderForm({
      data: buildServiceData({
        account: 'https://example.com/snowflakecomputing.com',
      }),
      serviceType: DatabaseServiceType.Snowflake,
    });

    expect(
      screen.getByText(
        'Connected to https://example.com/snowflakecomputing.com.snowflakecomputing.com'
      )
    ).toBeInTheDocument();
  });

  it('does not duplicate Snowflake sample data when the schema already excludes it', async () => {
    mockLoadConnectionSchema.mockResolvedValue({
      schema: {
        properties: {
          databaseFilterPattern: filterPatternProperty(
            'Default Database Filter Pattern',
            {
              excludes: ['^SNOWFLAKE_SAMPLE_DATA$'],
              includes: [],
            }
          ),
        },
        type: 'object',
      },
      uiSchema: {},
    });

    await renderForm({
      data: buildServiceData({
        account: 'fsad',
      }),
      serviceType: DatabaseServiceType.Snowflake,
    });

    const databaseSection = screen.getByTestId(
      'filter-section-databaseFilterPattern'
    );

    expect(
      within(databaseSection).getAllByText('SNOWFLAKE_SAMPLE_DATA')
    ).toHaveLength(2);
  });

  it('falls back to readable labels for unknown filter sections', async () => {
    mockLoadConnectionSchema.mockResolvedValue({
      schema: {
        properties: {
          boxFilterPattern: filterPatternProperty('Box Filter Pattern'),
          customPolicyFilterPattern: filterPatternProperty(''),
          dataFilterPattern: filterPatternProperty('Data Filter Pattern'),
          policyFilterPattern: filterPatternProperty('Policy Filter Pattern'),
          statusFilterPattern: filterPatternProperty('Status Filter Pattern'),
        },
        type: 'object',
      },
      uiSchema: {},
    });

    await renderForm();

    expect(screen.getByText('Boxs')).toBeInTheDocument();
    expect(screen.getByText('Custom Policies')).toBeInTheDocument();
    expect(screen.getByText('Datas')).toBeInTheDocument();
    expect(screen.getByText('Policies')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('filter-section-boxFilterPattern')).getByRole(
        'button',
        {
          name: 'Only specific boxs',
        }
      )
    );

    expect(
      within(
        screen.getByTestId('filter-section-boxFilterPattern')
      ).getByPlaceholderText('e.g. a box name')
    ).toBeInTheDocument();

    const dataSection = screen.getByTestId('filter-section-dataFilterPattern');

    fireEvent.click(
      within(dataSection).getByRole('button', {
        name: /Datas/,
      })
    );
    fireEvent.click(
      within(dataSection).getByRole('button', {
        name: 'Only specific datas',
      })
    );

    expect(
      within(dataSection).getByPlaceholderText('e.g. a data name')
    ).toBeInTheDocument();
  });

  it('ignores malformed non-filter schema properties', async () => {
    mockLoadConnectionSchema.mockResolvedValue({
      schema: {
        properties: {
          ignoredNullProperty: null,
          ignoredArrayProperty: [],
        },
        type: 'object',
      },
      uiSchema: {},
    });

    await renderForm();

    expect(screen.getByTestId('no-config-available')).toHaveTextContent(
      'No filter patterns are available for this connector.'
    );
  });

  it('shows the empty state when schema loading fails', async () => {
    mockLoadConnectionSchema.mockRejectedValue(new Error('schema load failed'));

    await renderForm();

    expect(screen.getByTestId('no-config-available')).toHaveTextContent(
      'No filter patterns are available for this connector.'
    );
  });

  it('renders inline alerts from the application store', async () => {
    mockUseApplicationStore.mockReturnValue({
      inlineAlertDetails: {
        message: 'Error message',
        type: 'error',
      },
    });

    await renderForm();

    expect(screen.getByTestId('inline-alert')).toBeInTheDocument();
  });

  it('does not render the connection message banner when showConnectedMessage is false', async () => {
    await renderForm({ showConnectedMessage: false });

    expect(
      screen.queryByText('Connected to localhost:3306')
    ).not.toBeInTheDocument();
  });
});

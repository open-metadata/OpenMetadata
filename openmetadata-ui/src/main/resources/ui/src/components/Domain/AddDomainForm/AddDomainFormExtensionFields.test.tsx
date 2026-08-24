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
import {
  Controller,
  FormProvider,
  useForm,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';
import { SearchIndex } from '../../../enums/search.enum';
import { CustomProperty } from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeFormField,
} from '../../../generated/governance/intakeForm';
import { searchQuery } from '../../../rest/searchAPI';
import { DomainFormValues } from './AddDomainForm.interface';
import AddDomainFormExtensionFields, {
  fetchExtensionReferenceOptions,
} from './AddDomainFormExtensionFields';
import {
  getExtensionFieldKind,
  getExtensionFormKey,
  getExtensionPropertyName,
  getExtensionPropertyNameFromFormKey,
} from './AddDomainFormExtensionFields.utils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: () => <div data-testid="avatar" />,
  Badge: ({
    children,
    'data-testid': dataTestId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={dataTestId}>{children}</span>,
  Box: ({
    children,
    direction: _direction,
    ...props
  }: {
    children?: ReactNode;
    direction?: string;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
  Divider: ({ label }: { label?: ReactNode }) => (
    <div role="separator">{label}</div>
  ),
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress?: () => void;
  }) => <button onClick={onPress}>{children}</button>,
  DatePicker: ({ 'aria-label': label }: { 'aria-label'?: string }) => (
    <div data-testid={`${label}-date-picker`} />
  ),
  FieldTypes: {
    MULTI_SELECT: 'multi_select',
    SELECT: 'select',
    TEXT: 'text',
    USER_TEAM_SELECT_INPUT: 'user_team_select_input',
  },
  FormField: <TFieldValues extends FieldValues = FieldValues>({
    children,
    control,
    name,
    rules,
  }: {
    children: (controller: {
      field: import('react-hook-form').ControllerRenderProps<
        TFieldValues,
        FieldPath<TFieldValues>
      >;
      fieldState: import('react-hook-form').ControllerFieldState;
    }) => ReactNode;
    control: Control<TFieldValues>;
    name: FieldPath<TFieldValues>;
    rules?: RegisterOptions<TFieldValues>;
  }) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => <>{children({ field, fieldState })}</>}
      rules={rules}
    />
  ),
  FormItemLabel: ({ label }: { label: ReactNode }) => <div>{label}</div>,
  getField: (field: {
    label?: ReactNode;
    name: string;
    props?: {
      'data-testid'?: string;
      multiple?: boolean;
    };
    type: string;
  }) => (
    <div
      data-field-type={field.type}
      data-multiple={String(Boolean(field.props?.multiple))}
      data-testid={field.props?.['data-testid'] ?? field.name}>
      {field.label}
    </div>
  ),
  HintText: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Input: ({
    hint,
    inputDataTestId,
    label,
    onChange,
    step,
    type,
    value,
  }: {
    hint?: ReactNode;
    inputDataTestId?: string;
    label?: ReactNode;
    onChange?: (value: string) => void;
    step?: number | 'any';
    type?: string;
    value?: string | number;
  }) => (
    <label htmlFor={inputDataTestId}>
      {label}
      <input
        aria-label={inputDataTestId}
        data-testid={inputDataTestId}
        id={inputDataTestId}
        step={step}
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {hint}
    </label>
  ),
  TimePicker: ({ 'aria-label': label }: { 'aria-label'?: string }) => (
    <div data-testid={`${label}-time-picker`} />
  ),
}));

jest.mock('../../../hooks/useGridEditController', () => ({
  useGridEditController: () => ({
    handleAddRow: jest.fn(),
    handleCopy: jest.fn(),
    handleOnRowsChange: jest.fn(),
    handlePaste: jest.fn(),
    setGridContainer: jest.fn(),
  }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../common/RichTextEditor/RichTextEditor', () => () => (
  <div data-testid="rich-text-editor" />
));

jest.mock('../../Database/SchemaEditor/SchemaEditor', () => () => (
  <div data-testid="schema-editor" />
));

jest.mock(
  '../../common/CustomPropertyTable/TableTypeProperty/TableTypePropertyEditTable',
  () => () => <div data-testid="table-editor" />
);

const mockedSearchQuery = searchQuery as jest.MockedFunction<
  typeof searchQuery
>;

const buildDefinition = (
  propertyType: string,
  config?: CustomProperty['customPropertyConfig']
): CustomProperty => ({
  customPropertyConfig: config,
  description: '',
  name: `${propertyType.replaceAll('-', '')}Field`,
  propertyType: {
    id: `${propertyType}-id`,
    name: propertyType,
    type: 'type',
  },
});

const buildFormField = (
  definition: CustomProperty,
  required = true
): IntakeFormField => ({
  fieldKind: FieldKind.CustomProperty,
  fieldLabel: definition.name,
  fieldPath: `extension.${definition.name}`,
  required,
});

const ExtensionFieldsHarness = ({
  definition,
  onValidation,
  required = true,
}: {
  definition: CustomProperty;
  onValidation?: (valid: boolean) => void;
  required?: boolean;
}) => {
  const form = useForm<DomainFormValues>({
    defaultValues: {
      extension: {},
    },
  });
  const extensionFormValues = form.watch('extensionFormValues');

  return (
    <FormProvider {...form}>
      <AddDomainFormExtensionFields
        control={form.control}
        customProperties={[definition]}
        formFields={[buildFormField(definition, required)]}
      />
      <output data-testid="extension-form-value">
        {typeof extensionFormValues?.[getExtensionFormKey(definition.name)]}:
        {String(
          extensionFormValues?.[getExtensionFormKey(definition.name)] ?? ''
        )}
      </output>
      <button
        type="button"
        onClick={() => void form.trigger().then(onValidation)}>
        validate
      </button>
    </FormProvider>
  );
};

const MissingDefinitionHarness = ({
  formFields,
}: {
  formFields: IntakeFormField[];
}) => {
  const form = useForm<DomainFormValues>({
    defaultValues: {
      extension: {},
    },
  });

  return (
    <FormProvider {...form}>
      <AddDomainFormExtensionFields
        control={form.control}
        customProperties={[]}
        formFields={formFields}
      />
      <button type="button" onClick={() => void form.trigger()}>
        validate
      </button>
    </FormProvider>
  );
};

describe('AddDomainFormExtensionFields', () => {
  it.each([
    ['string', undefined, 'text'],
    ['email', undefined, 'text'],
    ['duration', undefined, 'text'],
    ['integer', undefined, undefined],
    ['number', undefined, undefined],
    ['enum', { config: { multiSelect: false, values: ['Gold'] } }, 'select'],
    ['entityReference', { config: ['glossaryTerm'] }, 'user_team_select_input'],
    [
      'entityReferenceList',
      { config: ['table', 'dashboard'] },
      'user_team_select_input',
    ],
    ['hyperlink-cp', undefined, undefined],
    ['markdown', undefined, undefined],
    ['date-cp', { config: 'yyyy-MM-dd' }, undefined],
    ['dateTime-cp', { config: 'yyyy-MM-dd HH:mm:ss' }, undefined],
    ['time-cp', { config: 'HH:mm:ss' }, undefined],
    ['timestamp', undefined, undefined],
    ['timeInterval', undefined, undefined],
    ['sqlQuery', undefined, undefined],
    ['table-cp', { config: { columns: ['name'] } }, undefined],
    ['unsupported', undefined, 'text'],
  ])(
    'renders the %s custom property with its stable test id',
    (propertyType, customPropertyConfig, fieldType) => {
      const definition = buildDefinition(
        propertyType,
        customPropertyConfig as CustomProperty['customPropertyConfig']
      );
      const testId = `extension-${definition.name}`;

      render(<ExtensionFieldsHarness definition={definition} />);

      const field = screen.getByTestId(testId);

      expect(field).toBeInTheDocument();

      if (fieldType) {
        expect(field).toHaveAttribute('data-field-type', fieldType);
      }

      if (propertyType === 'integer' || propertyType === 'number') {
        expect(field).toHaveAttribute('type', 'number');
        expect(field).toHaveAttribute(
          'step',
          propertyType === 'number' ? 'any' : '1'
        );
      }

      if (propertyType === 'entityReferenceList') {
        expect(field).toHaveAttribute('data-multiple', 'true');
      }
    }
  );

  it('renders exactly the URL and display-text inputs for a hyperlink', () => {
    const definition = buildDefinition('hyperlink-cp');

    render(<ExtensionFieldsHarness definition={definition} />);

    expect(
      screen.getByTestId(`extension-${definition.name}-url`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`extension-${definition.name}-displayText`)
    ).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { hidden: true })).toHaveLength(2);
  });

  it('groups the intake fields under a custom properties section', () => {
    const definition = buildDefinition('string');

    render(<ExtensionFieldsHarness definition={definition} />);

    const section = screen.getByTestId('custom-properties-section');

    expect(section).toBeInTheDocument();
    expect(section).toContainElement(
      screen.getByTestId(`extension-${definition.name}`)
    );
  });

  it.each([
    ['entityReference', { config: ['glossaryTerm'] }, 'ENTITYREFERENCE'],
    ['hyperlink-cp', undefined, 'HYPERLINK'],
    ['date-cp', { config: 'yyyy-MM-dd' }, 'DATE'],
    ['string', undefined, 'STRING'],
  ])(
    'shows the %s property type badge next to the label',
    (propertyType, customPropertyConfig, badgeText) => {
      const definition = buildDefinition(
        propertyType,
        customPropertyConfig as CustomProperty['customPropertyConfig']
      );

      render(<ExtensionFieldsHarness definition={definition} />);

      expect(
        screen.getByTestId('custom-property-type-badge')
      ).toHaveTextContent(badgeText);
    }
  );

  it('blocks submit for a required property whose definition failed to load', async () => {
    const definition = buildDefinition('hyperlink-cp');

    render(
      <MissingDefinitionHarness formFields={[buildFormField(definition)]} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'validate' }));

    await waitFor(() =>
      expect(document.body).toHaveTextContent(
        'message.custom-property-definition-unavailable'
      )
    );

    // A plain text input here would submit an untyped value the backend rejects.
    expect(screen.queryAllByRole('textbox', { hidden: true })).toHaveLength(0);
  });

  it('omits the type badge when the property has no definition', () => {
    const definition = buildDefinition('string');

    render(
      <MissingDefinitionHarness formFields={[buildFormField(definition)]} />
    );

    expect(
      screen.getByTestId(`extension-${definition.name}`)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-property-type-badge')
    ).not.toBeInTheDocument();
  });

  it('uses the multi-select widget for a multi-select enum', () => {
    const definition = buildDefinition('enum', {
      config: { multiSelect: true, values: ['Gold', 'Silver'] },
    });

    render(<ExtensionFieldsHarness definition={definition} />);

    expect(screen.getByTestId(`extension-${definition.name}`)).toHaveAttribute(
      'data-field-type',
      'multi_select'
    );
  });

  it('preserves a decimal draft while typing', async () => {
    const definition = buildDefinition('number');

    render(<ExtensionFieldsHarness definition={definition} />);

    const input = screen.getByTestId(`extension-${definition.name}`);

    fireEvent.change(input, { target: { value: '42.5' } });

    expect(input).toHaveValue(42.5);
    expect(screen.getByTestId('extension-form-value')).toHaveTextContent(
      'string:42.5'
    );
  });

  it('marks an empty required table as invalid for drawer scrolling', async () => {
    const definition = buildDefinition('table-cp', {
      config: { columns: ['id'] },
    });

    render(<ExtensionFieldsHarness definition={definition} />);

    fireEvent.click(screen.getByRole('button', { name: 'validate' }));

    await waitFor(() =>
      expect(
        screen
          .getByTestId(`extension-${definition.name}`)
          .closest('[aria-invalid="true"]')
      ).toBeInTheDocument()
    );
  });

  it('renders an included optional field without requiring a value', async () => {
    const definition = buildDefinition('string');
    const onValidation = jest.fn();

    render(
      <ExtensionFieldsHarness
        definition={definition}
        required={false}
        onValidation={onValidation}
      />
    );

    expect(screen.getByTestId(`extension-${definition.name}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'validate' }));

    await waitFor(() => expect(onValidation).toHaveBeenCalledWith(true));
  });

  it.each([
    ['integer', 'integerField'],
    ['timeInterval', 'timeIntervalField-start'],
  ])('rejects a fractional %s value', async (propertyType, fieldTestId) => {
    const definition = buildDefinition(propertyType);

    render(<ExtensionFieldsHarness definition={definition} />);

    fireEvent.change(screen.getByTestId(`extension-${fieldTestId}`), {
      target: { value: '1.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'validate' }));

    await waitFor(() =>
      expect(document.body).toHaveTextContent('label.field-invalid')
    );
  });
});

describe('fetchExtensionReferenceOptions', () => {
  beforeEach(() => {
    mockedSearchQuery.mockResolvedValue({
      hits: {
        hits: [],
        max_score: 0,
        total: { relation: 'eq', value: 0 },
      },
      timed_out: false,
      took: 1,
    } as never);
  });

  it.each([
    [['glossaryTerm'], SearchIndex.GLOSSARY_TERM],
    [['table', 'dashboard'], 'table,dashboard'],
    [[], SearchIndex.ALL],
  ])(
    'searches the configured indexes %p',
    async (allowedTypes, expectedIndex) => {
      const definition = buildDefinition('entityReference', {
        config: allowedTypes,
      });

      await fetchExtensionReferenceOptions(definition, 'revenue');

      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '*revenue*',
          searchIndex: expectedIndex,
        })
      );
      expect(searchQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({ searchIndex: SearchIndex.USER })
      );
      expect(searchQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({ searchIndex: SearchIndex.TEAM })
      );
    }
  );

  it('keeps the hit entity type in the selected option value', async () => {
    mockedSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'term-1',
            _index: 'glossary_term_search_index',
            _score: 1,
            _source: {
              entityType: 'glossaryTerm',
              fullyQualifiedName: 'Business.Revenue',
              id: 'term-1',
              name: 'Revenue',
            },
          },
        ],
        max_score: 1,
        total: { relation: 'eq', value: 1 },
      },
      timed_out: false,
      took: 1,
    } as never);

    const options = await fetchExtensionReferenceOptions(
      buildDefinition('entityReference', { config: ['glossaryTerm'] })
    );

    expect(options).toHaveLength(1);
    expect(options[0].value).toMatchObject({
      id: 'term-1',
      type: 'glossaryTerm',
    });
  });
});

describe('AddDomainFormExtensionFields helpers', () => {
  it.each([
    ['string', 'text'],
    ['email', 'email'],
    ['duration', 'duration'],
    ['integer', 'number'],
    ['number', 'number'],
    ['enum', 'enum'],
    ['entityReference', 'reference'],
    ['entityReferenceList', 'reference'],
    ['hyperlink-cp', 'hyperlink'],
    ['markdown', 'markdown'],
    ['date-cp', 'date'],
    ['dateTime-cp', 'dateTime'],
    ['time-cp', 'time'],
    ['timestamp', 'timestamp'],
    ['timeInterval', 'timeInterval'],
    ['sqlQuery', 'sqlQuery'],
    ['table-cp', 'table'],
    ['unknown', 'text'],
  ])('maps %s to %s', (propertyType, expectedKind) => {
    expect(getExtensionFieldKind(propertyType)).toBe(expectedKind);
  });

  it('normalizes extension field paths', () => {
    expect(getExtensionPropertyName('extension.steward')).toBe('steward');
    expect(getExtensionPropertyName('legacyField')).toBe('legacyField');
  });

  it.each(['sla.target', 'threshold[0]', 'review status'])(
    'round-trips the punctuated property name %s through an RHF-safe key',
    (propertyName) => {
      const formKey = getExtensionFormKey(propertyName);

      expect(formKey).toMatch(/^[a-z0-9_]+$/);
      expect(getExtensionPropertyNameFromFormKey(formKey)).toBe(propertyName);
    }
  );
});

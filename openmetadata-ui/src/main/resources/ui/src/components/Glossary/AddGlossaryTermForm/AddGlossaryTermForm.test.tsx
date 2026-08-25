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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { CreateGlossaryTerm } from '../../../generated/api/data/createGlossaryTerm';
import { Config, CustomProperty } from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  IntakeFormField,
  RequiredField,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import AddGlossaryTermForm from './AddGlossaryTermForm.component';
import { GlossaryTermForm } from './AddGlossaryTermForm.interface';

// AddGlossaryTermForm is a legacy antd form whose required `formRef` prop must be
// a real antd FormInstance from the same module instance the component uses.
// `jest.requireActual` returns a separate copy (fields stay unregistered,
// validation hangs), and a static antd import is blocked by the antd/less
// deprecation guard for new files. `require` returns the shared jest-registry
// instance the component consumes and is not matched by the guard.
const { Form } = require('antd') as typeof import('antd');

const mockDataAssetSelectProps: Array<Record<string, unknown>> = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: {
      id: 'current-user-id',
    },
  }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleTeamOwner: true,
      canAddMultipleUserOwners: true,
    },
  }),
}));

jest.mock('../../../rest/intakeFormsAPI', () => ({
  getIntakeFormByEntityType: jest.fn(),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/formUtils', () => {
  const { Form: AntForm } = jest.requireActual<typeof import('antd')>('antd');
  const MockInput = ({
    'data-testid': dataTestId,
    onChange,
    value = '',
  }: {
    'data-testid': string;
    onChange?: import('react').ChangeEventHandler<HTMLInputElement>;
    value?: unknown;
  }) => (
    <input
      aria-label="input"
      data-testid={dataTestId}
      value={
        typeof value === 'string' || typeof value === 'number' ? value : ''
      }
      onChange={onChange}
    />
  );

  const renderField = (
    field: import('../../../interface/FormUtils.interface').FieldProp
  ) => (
    <AntForm.Item
      key={field.id}
      label={field.label}
      name={field.name}
      required={field.required}
      rules={field.rules}>
      <MockInput
        data-testid={
          (field.props?.['data-testid'] as string | undefined) ?? field.id
        }
      />
    </AntForm.Item>
  );

  return {
    generateFormFields: (
      fields: import('../../../interface/FormUtils.interface').FieldProp[]
    ) => <>{fields.map(renderField)}</>,
    getField: renderField,
  };
});

jest.mock(
  '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () =>
    jest.fn().mockImplementation((props: Record<string, unknown>) => {
      mockDataAssetSelectProps.push(props);

      return (
        <input
          aria-label="input"
          data-testid={props['data-testid'] as string}
          value=""
          onChange={() => undefined}
        />
      );
    })
);

jest.mock('../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn().mockReturnValue(<textarea aria-label="editor" />)
);

jest.mock('../../common/DatePicker/DatePicker', () =>
  jest.fn().mockReturnValue(<input aria-label="date-picker" />)
);

jest.mock('../../common/RichTextEditor/RichTextEditor', () =>
  jest
    .fn()
    .mockImplementation(({ 'data-testid': dataTestId }) => (
      <textarea aria-label="editor" data-testid={dataTestId} />
    ))
);

jest.mock(
  '../../common/CustomPropertyTable/TableTypeProperty/EditTableTypePropertyModal',
  () => ({
    getGridColumns: (columns: string[]) =>
      columns.map((column) => ({ key: column, name: column })),
  })
);

jest.mock(
  '../../common/CustomPropertyTable/TableTypeProperty/TableTypePropertyEditTable',
  () => jest.fn().mockReturnValue(<div data-testid="table-editor" />)
);

const mockedGetIntakeForm = getIntakeFormByEntityType as jest.MockedFunction<
  typeof getIntakeFormByEntityType
>;
const mockedGetCustomProperties =
  getCustomPropertiesByEntityType as jest.MockedFunction<
    typeof getCustomPropertiesByEntityType
  >;

const createCustomProperty = (
  name: string,
  propertyType: string,
  config?: Config | string[] | string
): CustomProperty => ({
  customPropertyConfig:
    config === undefined
      ? undefined
      : {
          config,
        },
  description: '',
  name,
  propertyType: {
    id: `${propertyType}-id`,
    name: propertyType,
    type: 'type',
  },
});

const createRequiredField = (
  name: string,
  fieldKind = FieldKind.CustomProperty
): RequiredField => ({
  fieldKind,
  fieldLabel: name,
  fieldPath:
    fieldKind === FieldKind.CustomProperty ? `extension.${name}` : name,
});

const createIntakeForm = (requiredFields: RequiredField[]): IntakeForm => ({
  entityType: TargetEntityType.GlossaryTerm,
  id: 'intake-form-id',
  name: 'glossaryTermIntakeForm',
  requiredFields,
});

const createIntakeFormWithFields = (
  formFields: IntakeFormField[]
): IntakeForm => ({
  entityType: TargetEntityType.GlossaryTerm,
  formFields,
  id: 'intake-form-id',
  name: 'glossaryTermIntakeForm',
});

interface FormHarnessProps {
  editMode?: boolean;
  formValues?: Partial<CreateGlossaryTerm>;
  onSave: (value: GlossaryTermForm) => void | Promise<void>;
}

const FormHarness = ({
  editMode = false,
  formValues,
  onSave,
}: FormHarnessProps) => {
  const [form] = Form.useForm<CreateGlossaryTerm>();

  return (
    <>
      <AddGlossaryTermForm
        editMode={editMode}
        formRef={form}
        onCancel={jest.fn()}
        onSave={onSave}
      />
      {formValues && (
        <button
          data-testid="submit-values"
          onClick={() => {
            form.setFieldsValue(formValues);
            form.submit();
          }}>
          Submit
        </button>
      )}
    </>
  );
};

// Text-ish extension fields put their test id on the field wrapper rendered by
// core-components, so reach through to the control the user actually types in.
const extensionInput = (testId: string): HTMLElement => {
  const field = screen.getByTestId(testId);

  return field.tagName === 'INPUT'
    ? field
    : (field.querySelector('input') as HTMLElement);
};

describe('AddGlossaryTermForm intake fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataAssetSelectProps.length = 0;
    mockedGetIntakeForm.mockResolvedValue(null);
    mockedGetCustomProperties.mockResolvedValue([]);
  });

  it('renders configured custom intake fields in create mode', async () => {
    const requiredFields = [
      createRequiredField('summary'),
      createRequiredField('relatedTerm'),
      createRequiredField('documentation'),
    ];
    mockedGetIntakeForm.mockResolvedValue(createIntakeForm(requiredFields));
    mockedGetCustomProperties.mockResolvedValue([
      createCustomProperty('summary', 'string'),
      createCustomProperty('relatedTerm', 'entityReference', ['glossaryTerm']),
      createCustomProperty('documentation', 'hyperlink-cp'),
    ]);

    render(<FormHarness onSave={jest.fn()} />);

    expect(await screen.findByTestId('extension-summary')).toBeInTheDocument();
    expect(screen.getByTestId('extension-relatedTerm')).toBeInTheDocument();
    expect(
      screen.getByTestId('extension-documentation-url')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('extension-documentation-displayText')
    ).toBeInTheDocument();
    expect(mockedGetIntakeForm).toHaveBeenCalledWith(
      TargetEntityType.GlossaryTerm
    );
    expect(mockedGetCustomProperties).toHaveBeenCalledWith(
      TargetEntityType.GlossaryTerm
    );

    const section = screen.getByTestId('custom-properties-section');
    const badges = screen.getAllByTestId('custom-property-type-badge');

    expect(section).toBeInTheDocument();
    expect(badges).toHaveLength(3);
    expect(badges.map((badge) => badge.textContent)).toEqual([
      'STRING',
      'ENTITYREFERENCE',
      'HYPERLINK',
    ]);

    const reviewersField = screen.getByTestId('root/reviewers');

    expect(
      reviewersField.compareDocumentPosition(section) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('submits without a value for an included optional custom field', async () => {
    mockedGetIntakeForm.mockResolvedValue(
      createIntakeFormWithFields([
        {
          fieldKind: FieldKind.CustomProperty,
          fieldLabel: 'Summary',
          fieldPath: 'extension.summary',
          required: false,
        },
      ])
    );
    mockedGetCustomProperties.mockResolvedValue([
      createCustomProperty('summary', 'string'),
    ]);
    const onSave = jest.fn();

    render(
      <FormHarness
        formValues={{
          description: 'Description',
          name: 'term-name',
        }}
        onSave={onSave}
      />
    );

    expect(await screen.findByTestId('extension-summary')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-values'));
    });

    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it('waits for custom-property definitions before rendering intake fields', async () => {
    const requiredFields = [createRequiredField('summary')];
    const customProperties = [createCustomProperty('summary', 'string')];
    let resolveCustomProperties: (properties: CustomProperty[]) => void = (
      _properties
    ) => undefined;
    const customPropertiesRequest = new Promise<CustomProperty[]>((resolve) => {
      resolveCustomProperties = resolve;
    });
    mockedGetIntakeForm.mockResolvedValue(createIntakeForm(requiredFields));
    mockedGetCustomProperties.mockReturnValue(customPropertiesRequest);

    render(<FormHarness onSave={jest.fn()} />);

    await waitFor(() => expect(mockedGetIntakeForm).toHaveBeenCalled());

    expect(screen.queryByTestId('extension-summary')).not.toBeInTheDocument();

    await act(async () => resolveCustomProperties(customProperties));

    expect(await screen.findByTestId('extension-summary')).toBeInTheDocument();
  });

  it('does not fetch or render intake fields in edit mode', () => {
    render(<FormHarness editMode onSave={jest.fn()} />);

    expect(mockedGetIntakeForm).not.toHaveBeenCalled();
    expect(mockedGetCustomProperties).not.toHaveBeenCalled();
    expect(screen.queryByTestId('extension-summary')).not.toBeInTheDocument();
  });

  it('serializes values typed into the intake fields into the submit payload', async () => {
    mockedGetIntakeForm.mockResolvedValue(
      createIntakeForm([
        createRequiredField('score'),
        createRequiredField('summary'),
        createRequiredField('documentation'),
      ])
    );
    mockedGetCustomProperties.mockResolvedValue([
      createCustomProperty('score', 'integer'),
      createCustomProperty('summary', 'string'),
      createCustomProperty('documentation', 'hyperlink-cp'),
    ]);
    const onSave = jest.fn();

    render(
      <FormHarness
        formValues={{
          description: 'Description',
          displayName: 'Display name',
          name: ' term-name ',
        }}
        onSave={onSave}
      />
    );

    await screen.findByTestId('extension-score');

    fireEvent.change(extensionInput('extension-score'), {
      target: { value: '42' },
    });
    fireEvent.change(extensionInput('extension-summary'), {
      target: { value: 'governed term' },
    });
    fireEvent.change(extensionInput('extension-documentation-url'), {
      target: { value: 'https://example.com/docs' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-values'));
    });

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: {
            // The integer arrives as a JSON number and the hyperlink as an
            // object; an empty display text is dropped rather than sent.
            documentation: { url: 'https://example.com/docs' },
            score: 42,
            summary: 'governed term',
          },
          name: 'term-name',
        })
      )
    );
  });

  it('blocks submit while a required intake field is empty', async () => {
    mockedGetIntakeForm.mockResolvedValue(
      createIntakeForm([createRequiredField('summary')])
    );
    mockedGetCustomProperties.mockResolvedValue([
      createCustomProperty('summary', 'string'),
    ]);
    const onSave = jest.fn();

    render(
      <FormHarness
        formValues={{ description: 'Description', name: 'term-name' }}
        onSave={onSave}
      />
    );

    await screen.findByTestId('extension-summary');

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-values'));
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(['displayName', 'synonyms', 'tags', 'reviewers'])(
    'applies the intake required rule to the native %s field',
    async (fieldPath) => {
      const errorMessage = `${fieldPath} intake required`;
      mockedGetIntakeForm.mockResolvedValue(
        createIntakeForm([
          {
            errorMessage,
            fieldKind: FieldKind.Native,
            fieldLabel: fieldPath,
            fieldPath,
          },
        ])
      );

      render(
        <FormHarness
          formValues={{
            description: 'Description',
            name: 'term-name',
          }}
          onSave={jest.fn()}
        />
      );

      await waitFor(() => expect(mockedGetIntakeForm).toHaveBeenCalled());

      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-values'));
      });

      expect(await screen.findByText(errorMessage)).toBeInTheDocument();
    }
  );
});

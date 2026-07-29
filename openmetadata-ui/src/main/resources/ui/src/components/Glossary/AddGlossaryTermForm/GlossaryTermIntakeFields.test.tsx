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
import { Form } from 'antd';
import { DateTime } from 'luxon';
import moment from 'moment';
import { Config, CustomProperty } from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeFormField,
} from '../../../generated/governance/intakeForm';
import GlossaryTermIntakeFields from './GlossaryTermIntakeFields.component';

const mockDataAssetSelectProps: Array<Record<string, unknown>> = [];
const mockDatePickerProps: Array<Record<string, unknown>> = [];
const mockTimePickerProps: Array<Record<string, unknown>> = [];
const mockSelectProps: Array<Record<string, unknown>> = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('antd', () => {
  const actual = jest.requireActual<typeof import('antd')>('antd');
  const Select = (props: Record<string, unknown>) => {
    mockSelectProps.push(props);

    return <input readOnly data-testid={props['data-testid'] as string} />;
  };
  const TimePicker = (props: Record<string, unknown>) => {
    mockTimePickerProps.push(props);

    return <input readOnly data-testid={props['data-testid'] as string} />;
  };

  return {
    ...actual,
    Select,
    TimePicker,
  };
});

jest.mock(
  '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () =>
    jest.fn().mockImplementation((props: Record<string, unknown>) => {
      mockDataAssetSelectProps.push(props);

      return (
        <input readOnly data-testid={props['data-testid'] as string} value="" />
      );
    })
);

jest.mock('../../common/DatePicker/DatePicker', () =>
  jest.fn().mockImplementation((props: Record<string, unknown>) => {
    mockDatePickerProps.push(props);

    return <input readOnly data-testid={props['data-testid'] as string} />;
  })
);

jest.mock('../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn().mockReturnValue(<textarea data-testid="schema-editor-input" />)
);

jest.mock('../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<textarea data-testid="rich-text-editor-input" />)
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

jest.mock('../../../hooks/useGridEditController', () => ({
  useGridEditController: () => ({
    handleAddRow: jest.fn(),
    handleCopy: jest.fn(),
    handleOnRowsChange: jest.fn(),
    handlePaste: jest.fn(),
    setGridContainer: jest.fn(),
  }),
}));

const createCustomProperty = (
  name: string,
  propertyType: string,
  config?: Config | string[] | string
): CustomProperty => ({
  customPropertyConfig: config === undefined ? undefined : { config },
  description: '',
  name,
  propertyType: {
    id: `${propertyType}-id`,
    name: propertyType,
    type: 'type',
  },
});

const createFormField = (name: string, required = true): IntakeFormField => ({
  fieldKind: FieldKind.CustomProperty,
  fieldLabel: name,
  fieldPath: `extension.${name}`,
  required,
});

interface IntakeHarnessProps {
  customProperties: CustomProperty[];
  formFields: IntakeFormField[];
  initialValues?: Record<string, unknown>;
  onFinish?: (values: Record<string, unknown>) => void;
}

const IntakeHarness = ({
  customProperties,
  formFields,
  initialValues,
  onFinish,
}: IntakeHarnessProps) => {
  const [form] = Form.useForm();

  return (
    <Form form={form} initialValues={initialValues} onFinish={onFinish}>
      <GlossaryTermIntakeFields
        customProperties={customProperties}
        formFields={formFields}
      />
      <button data-testid="submit-intake" type="submit">
        submit
      </button>
    </Form>
  );
};

const submitForm = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('submit-intake'));
  });
};

describe('GlossaryTermIntakeFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataAssetSelectProps.length = 0;
    mockDatePickerProps.length = 0;
    mockTimePickerProps.length = 0;
    mockSelectProps.length = 0;
  });

  it('shows the property type badge next to each configured field label', () => {
    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('summary', 'string'),
          createCustomProperty('documentation', 'hyperlink-cp'),
        ]}
        formFields={[
          createFormField('summary'),
          createFormField('documentation'),
        ]}
      />
    );

    const badges = screen.getAllByTestId('custom-property-type-badge');

    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent('STRING');
    expect(badges[1]).toHaveTextContent('HYPERLINK');
  });

  it('omits the type badge when the property has no definition', () => {
    render(
      <IntakeHarness
        customProperties={[]}
        formFields={[createFormField('ghost')]}
      />
    );

    expect(screen.getByTestId('extension-ghost')).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-property-type-badge')
    ).not.toBeInTheDocument();
  });

  it('renders an included optional field without requiring a value', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[createCustomProperty('summary', 'string')]}
        formFields={[createFormField('summary', false)]}
        onFinish={onFinish}
      />
    );

    expect(screen.getByTestId('extension-summary')).toBeVisible();

    await submitForm();

    await waitFor(() => expect(onFinish).toHaveBeenCalled());
  });

  it('renders a multi-select for a multi-select enum', () => {
    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('tiers', 'enum', {
            multiSelect: true,
            values: ['Gold', 'Silver'],
          }),
        ]}
        formFields={[createFormField('tiers')]}
      />
    );

    expect(mockSelectProps.at(-1)).toMatchObject({
      mode: 'multiple',
      options: [
        { label: 'Gold', value: 'Gold' },
        { label: 'Silver', value: 'Silver' },
      ],
    });
  });

  it('restricts an entityReferenceList to the configured search indexes', () => {
    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('assets', 'entityReferenceList', [
            'glossaryTerm',
            'table',
          ]),
        ]}
        formFields={[createFormField('assets')]}
      />
    );

    expect(mockDataAssetSelectProps.at(-1)).toMatchObject({
      mode: 'multiple',
      searchIndex: 'glossaryTerm,table',
    });
  });

  it('renders the markdown and sql editors for their property types', () => {
    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('notes', 'markdown'),
          createCustomProperty('query', 'sqlQuery'),
        ]}
        formFields={[createFormField('notes'), createFormField('query')]}
      />
    );

    expect(screen.getByTestId('rich-text-editor-input')).toBeInTheDocument();
    expect(screen.getByTestId('schema-editor-input')).toBeInTheDocument();
  });

  it('renders the ISO-8601 hint for a duration property', () => {
    render(
      <IntakeHarness
        customProperties={[createCustomProperty('sla', 'duration')]}
        formFields={[createFormField('sla')]}
      />
    );

    expect(screen.getByTestId('extension-sla')).toHaveAttribute(
      'placeholder',
      'message.duration-in-iso-format'
    );
  });

  it('round-trips a date-cp value through the configured format', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('launchDate', 'date-cp', 'yyyy-MM-dd'),
        ]}
        formFields={[createFormField('launchDate')]}
        initialValues={{ extension: { launchDate: '2026-01-05' } }}
        onFinish={onFinish}
      />
    );

    const pickerValue = mockDatePickerProps.at(-1)?.value as DateTime;

    expect(pickerValue.isValid).toBe(true);
    expect(pickerValue.toFormat('yyyy-MM-dd')).toBe('2026-01-05');

    const onChange = mockDatePickerProps.at(-1)?.onChange as (
      value: DateTime | null
    ) => void;

    await act(async () => {
      onChange(DateTime.fromFormat('2026-02-11', 'yyyy-MM-dd'));
    });
    await submitForm();

    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: expect.objectContaining({ launchDate: '2026-02-11' }),
        })
      )
    );
  });

  it('formats a dateTime-cp value with the configured format on change', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty(
            'reviewedAt',
            'dateTime-cp',
            'yyyy-MM-dd HH:mm:ss'
          ),
        ]}
        formFields={[createFormField('reviewedAt')]}
        onFinish={onFinish}
      />
    );

    const onChange = mockDatePickerProps.at(-1)?.onChange as (
      value: DateTime | null
    ) => void;

    await act(async () => {
      onChange(
        DateTime.fromFormat('2026-02-11 14:30:15', 'yyyy-MM-dd HH:mm:ss')
      );
    });
    await submitForm();

    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: expect.objectContaining({
            reviewedAt: '2026-02-11 14:30:15',
          }),
        })
      )
    );
  });

  it('round-trips a time-cp value through the configured format', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('cutoff', 'time-cp', 'HH:mm:ss'),
        ]}
        formFields={[createFormField('cutoff')]}
        initialValues={{ extension: { cutoff: '09:15:00' } }}
        onFinish={onFinish}
      />
    );

    const pickerValue = mockTimePickerProps.at(-1)?.value as moment.Moment;

    expect(pickerValue.format('HH:mm:ss')).toBe('09:15:00');

    const onChange = mockTimePickerProps.at(-1)?.onChange as (
      value: moment.Moment | null
    ) => void;

    await act(async () => {
      onChange(moment('14:30:00', 'HH:mm:ss'));
    });
    await submitForm();

    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: expect.objectContaining({ cutoff: '14:30:00' }),
        })
      )
    );
  });

  it('rejects a timestamp that is not unix epoch milliseconds', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[createCustomProperty('capturedAt', 'timestamp')]}
        formFields={[createFormField('capturedAt')]}
        initialValues={{ extension: { capturedAt: 123 } }}
        onFinish={onFinish}
      />
    );

    await submitForm();

    expect(
      await screen.findByText('message.invalid-unix-epoch-time-milliseconds')
    ).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('submits a valid timestamp as a number', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[createCustomProperty('capturedAt', 'timestamp')]}
        formFields={[createFormField('capturedAt')]}
        initialValues={{ extension: { capturedAt: 1706000000000 } }}
        onFinish={onFinish}
      />
    );

    await submitForm();

    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: expect.objectContaining({ capturedAt: 1706000000000 }),
        })
      )
    );
  });

  it('validates both timeInterval bounds as epoch milliseconds', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[createCustomProperty('window', 'timeInterval')]}
        formFields={[createFormField('window')]}
        initialValues={{
          extension: { window: { end: 1706000001000, start: 12 } },
        }}
        onFinish={onFinish}
      />
    );

    expect(screen.getByTestId('extension-window-start')).toBeInTheDocument();
    expect(screen.getByTestId('extension-window-end')).toBeInTheDocument();

    await submitForm();

    expect(
      await screen.findByText('message.invalid-unix-epoch-time-milliseconds')
    ).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it.each([
    ['ftp://example.com', 'message.url-must-use-http-or-https'],
    ['not-a-url', 'message.invalid-url'],
  ])('rejects the hyperlink url %s', async (url, expectedError) => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('documentation', 'hyperlink-cp'),
        ]}
        formFields={[createFormField('documentation')]}
        initialValues={{ extension: { documentation: { url } } }}
        onFinish={onFinish}
      />
    );

    await submitForm();

    expect(await screen.findByText(expectedError)).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('submits a valid hyperlink value', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('documentation', 'hyperlink-cp'),
        ]}
        formFields={[createFormField('documentation')]}
        initialValues={{
          extension: {
            documentation: {
              displayText: 'Docs',
              url: 'https://example.com/docs',
            },
          },
        }}
        onFinish={onFinish}
      />
    );

    await submitForm();

    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: expect.objectContaining({
            documentation: {
              displayText: 'Docs',
              url: 'https://example.com/docs',
            },
          }),
        })
      )
    );
  });

  it('validates an email property against the email rule', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[createCustomProperty('contact', 'email')]}
        formFields={[createFormField('contact')]}
        initialValues={{ extension: { contact: 'foo' } }}
        onFinish={onFinish}
      />
    );

    await submitForm();

    expect(onFinish).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('extension-contact'), {
      target: { value: 'john@doe.com' },
    });
    await submitForm();

    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: expect.objectContaining({ contact: 'john@doe.com' }),
        })
      )
    );
  });

  it('requires at least one populated table row', async () => {
    const onFinish = jest.fn();

    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('matrix', 'table-cp', {
            columns: ['name'],
          }),
        ]}
        formFields={[createFormField('matrix')]}
        onFinish={onFinish}
      />
    );

    expect(screen.getByTestId('add-new-row')).toBeInTheDocument();

    await submitForm();

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('accepts a table value that already has populated rows', async () => {
    const onFinish = jest.fn();
    const tableValue = { columns: ['name'], rows: [{ name: 'orders' }] };

    render(
      <IntakeHarness
        customProperties={[
          createCustomProperty('matrix', 'table-cp', {
            columns: ['name'],
          }),
        ]}
        formFields={[createFormField('matrix')]}
        initialValues={{ extension: { matrix: tableValue } }}
        onFinish={onFinish}
      />
    );

    await submitForm();

    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: expect.objectContaining({ matrix: tableValue }),
        })
      )
    );
  });
});

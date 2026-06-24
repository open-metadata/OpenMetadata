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
  ArrayFieldTemplateItemType,
  ArrayFieldTemplateProps,
  FieldErrorProps,
  FieldTemplateProps,
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
  WrapIfAdditionalTemplateProps,
} from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { CoreArrayFieldTemplate } from './CoreArrayFieldTemplate';
import { CoreFieldErrorTemplate } from './CoreFieldErrorTemplate';
import { CoreFieldTemplate } from './CoreFieldTemplate';
import { CoreObjectFieldTemplate } from './CoreObjectFieldTemplate';
import { CoreWrapIfAdditionalTemplate } from './CoreWrapIfAdditionalTemplate';

const wrapIfAdditionalRegistry = {
  templates: {
    WrapIfAdditionalTemplate: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
} as unknown as FieldTemplateProps['registry'];

jest.mock('@openmetadata/ui-core-components', () => {
  const ActualReact = jest.requireActual('react');
  const AccordionContext = ActualReact.createContext({
    expandedItem: undefined,
    setExpandedItem: jest.fn(),
  });
  const AccordionItemContext = ActualReact.createContext(undefined);

  return {
    Accordion: jest.fn(({ children }: { children: React.ReactNode }) => {
      const [expandedItem, setExpandedItem] = ActualReact.useState(
        undefined as string | undefined
      );

      return (
        <AccordionContext.Provider value={{ expandedItem, setExpandedItem }}>
          {children}
        </AccordionContext.Provider>
      );
    }),
    AccordionHeader: jest.fn(({ children }: { children: React.ReactNode }) => {
      const { expandedItem, setExpandedItem } =
        ActualReact.useContext(AccordionContext);
      const itemId = ActualReact.useContext(AccordionItemContext);
      const isExpanded = expandedItem === itemId;

      return (
        <button
          aria-expanded={isExpanded}
          type="button"
          onClick={() => setExpandedItem(isExpanded ? undefined : itemId)}>
          {children}
        </button>
      );
    }),
    AccordionItem: jest.fn(
      ({ children, id }: { children: React.ReactNode; id: string }) => (
        <AccordionItemContext.Provider value={id}>
          {children}
        </AccordionItemContext.Provider>
      )
    ),
    AccordionPanel: jest.fn(
      ({ children, ...props }: { children: React.ReactNode }) => {
        const { expandedItem } = ActualReact.useContext(AccordionContext);
        const itemId = ActualReact.useContext(AccordionItemContext);

        return expandedItem === itemId ? (
          <div {...props}>{children}</div>
        ) : null;
      }
    ),
    Button: jest.fn(
      ({
        children,
        isDisabled,
        onClick,
        iconLeading: _iconLeading,
        iconTrailing: _iconTrailing,
        ...props
      }: {
        children: React.ReactNode;
        isDisabled?: boolean;
        onClick?: () => void;
        iconLeading?: React.ReactNode;
        iconTrailing?: React.ReactNode;
      }) => (
        <button
          disabled={isDisabled}
          type="button"
          onClick={onClick}
          {...props}>
          {children}
        </button>
      )
    ),
    Input: jest.fn(
      ({
        id,
        label,
        placeholder,
        value,
        onBlur,
        onChange,
      }: {
        id?: string;
        label?: string;
        placeholder?: string;
        value?: string;
        onBlur?: () => void;
        onChange?: (v: string) => void;
      }) => (
        <div>
          {label && <label htmlFor={id}>{label}</label>}
          <input
            id={id}
            placeholder={placeholder}
            value={value}
            onBlur={onBlur}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </div>
      )
    ),
    Typography: jest.fn(
      ({
        children,
        as: Tag = 'span',
        ...props
      }: {
        children: React.ReactNode;
        as?: React.ElementType;
      }) => <Tag {...props}>{children}</Tag>
    ),
  };
});

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <span aria-hidden="true">chevron-down-icon</span>,
  Hexagon01: (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>hexagon-icon</span>
  ),
  Plus: () => <span>plus-icon</span>,
  Trash01: () => <span>trash-icon</span>,
}));

jest.mock('@rjsf/utils', () => ({
  ...jest.requireActual('@rjsf/utils'),
  ADDITIONAL_PROPERTY_FLAG: '__additional_property',
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, params?: Record<string, string>) =>
      params?.entity ? `${key}:${params.entity}` : key,
  }),
}));

describe('FormBuilderV1 templates', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('renders array items and add/remove controls', () => {
    const onAddClick = jest.fn();
    const onDropIndexClick = jest.fn(() => jest.fn());

    render(
      <CoreArrayFieldTemplate
        {...{
          canAdd: true,
          idSchema: { $id: 'array-field' },
          registry: {} as ArrayFieldTemplateProps['registry'],
          schema: {},
          title: 'Tags',
          onAddClick,
          items: [
            {
              children: <div>first child</div>,
              className: '',
              canAdd: false,
              disabled: false,
              hasCopy: false,
              hasMoveDown: false,
              hasMoveUp: false,
              hasRemove: true,
              index: 0,
              key: 'first',
              onCopyIndexClick: jest.fn(() => jest.fn()),
              onDropIndexClick,
              onReorderClick: jest.fn(() => jest.fn()),
              readonly: false,
              registry: {} as ArrayFieldTemplateItemType['registry'],
            },
            {
              children: <div>second child</div>,
              className: '',
              canAdd: false,
              disabled: false,
              hasCopy: false,
              hasMoveDown: false,
              hasMoveUp: false,
              hasRemove: false,
              index: 1,
              key: 'second',
              onCopyIndexClick: jest.fn(() => jest.fn()),
              onDropIndexClick,
              onReorderClick: jest.fn(() => jest.fn()),
              readonly: false,
              registry: {} as ArrayFieldTemplateItemType['registry'],
            },
          ] as unknown as ArrayFieldTemplateItemType[],
        }}
      />
    );

    fireEvent.click(screen.getByTestId('add-item-Tags'));

    expect(onAddClick).toHaveBeenCalled();
    expect(screen.getByText('first child')).toBeInTheDocument();
    expect(screen.getByText('second child')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.remove' }));

    expect(onDropIndexClick).toHaveBeenCalledWith(0);
  });

  it('renders hidden and visible field templates correctly', () => {
    const fieldTemplateBase = {
      classNames: 'field-wrapper',
      disabled: false,
      id: 'field-id',
      label: 'Field',
      onChange: jest.fn(),
      rawDescription: undefined,
      rawErrors: [],
      rawHelp: undefined,
      readonly: false,
      registry: wrapIfAdditionalRegistry,
      required: false,
      schema: { type: 'string' as const },
      onDropPropertyClick: jest.fn(),
      onKeyChange: jest.fn(),
    } as unknown as FieldTemplateProps;

    const { rerender, container } = render(
      <CoreFieldTemplate
        {...fieldTemplateBase}
        hidden={false}
        style={{ marginTop: '8px' } as unknown as FieldTemplateProps['style']}>
        <div>content</div>
      </CoreFieldTemplate>
    );

    expect(container.firstChild).not.toHaveClass('field-wrapper');
    expect(screen.getByText('content')).toBeVisible();

    rerender(
      <CoreFieldTemplate {...fieldTemplateBase} hidden>
        <div>hidden content</div>
      </CoreFieldTemplate>
    );

    expect(container.firstChild).toHaveClass('tw:hidden');
    expect(screen.getByText('hidden content')).toBeInTheDocument();
  });

  it('renders object template content and toggles advanced properties', () => {
    const onAddClick = jest.fn(() => jest.fn());

    render(
      <CoreObjectFieldTemplate
        {...{
          idSchema: { $id: 'object-field' },
          registry: {} as ObjectFieldTemplateProps['registry'],
          schema: { additionalProperties: true },
          title: 'Connection',
          onAddClick,
          properties: [
            {
              content: <div>basic property</div>,
              hidden: false,
              name: 'name',
            },
            {
              content: <div>advanced property</div>,
              hidden: false,
              name: 'connectionOptions',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('basic property')).toBeInTheDocument();
    expect(screen.queryByText('advanced property')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-item-Connection'));

    expect(onAddClick).toHaveBeenCalledWith({ additionalProperties: true });

    const advancedConfigToggle = screen.getByRole('button', {
      name: 'Connection label.advanced-config',
    });

    expect(advancedConfigToggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(advancedConfigToggle);

    expect(screen.getByText('advanced property')).toBeInTheDocument();
    expect(advancedConfigToggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(advancedConfigToggle);

    expect(screen.queryByText('advanced property')).not.toBeInTheDocument();
    expect(advancedConfigToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('adds stable layout classes for sample data storage nested configs', () => {
    const { container, rerender } = render(
      <CoreObjectFieldTemplate
        {...{
          idSchema: { $id: 'root/sampleDataStorageConfig/config' },
          registry: {} as ObjectFieldTemplateProps['registry'],
          schema: {},
          title: 'Sample Data Storage Config',
          onAddClick: jest.fn(),
          properties: [
            {
              content: <div>file path field</div>,
              hidden: false,
              name: 'filePathPattern',
            },
            {
              content: <div>bucket field</div>,
              hidden: false,
              name: 'bucketName',
            },
            {
              content: <div>prefix field</div>,
              hidden: false,
              name: 'prefix',
            },
            {
              content: <div>overwrite field</div>,
              hidden: false,
              name: 'overwriteData',
            },
            {
              content: <div>storage field</div>,
              hidden: false,
              name: 'storageConfig',
            },
          ],
        }}
      />
    );

    expect(
      container.querySelector('.core-object-field-template-sample-data-config')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.core-object-field-template-body-grid')
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '.core-object-field-template-property-filePathPattern'
      )
    ).toHaveTextContent('file path field');
    expect(
      container.querySelector(
        '.core-object-field-template-property-storageConfig'
      )
    ).toHaveTextContent('storage field');
    expect(
      Array.from(
        container.querySelectorAll(
          '.core-object-field-template-sample-data-config > .core-object-field-template-body > .core-object-field-template-property'
        )
      ).map((element) => element.getAttribute('data-field-name'))
    ).toEqual([
      'bucketName',
      'prefix',
      'filePathPattern',
      'overwriteData',
      'storageConfig',
    ]);

    rerender(
      <CoreObjectFieldTemplate
        {...{
          idSchema: {
            $id: 'root/sampleDataStorageConfig/config/storageConfig',
          },
          formData: { enabled: true },
          registry: {} as ObjectFieldTemplateProps['registry'],
          schema: {},
          title: 'AWS S3 Storage Config',
          onAddClick: jest.fn(),
          properties: [
            {
              content: <div>assume role field</div>,
              hidden: false,
              name: 'assumeRoleArn',
            },
            {
              content: <div>region field</div>,
              hidden: false,
              name: 'awsRegion',
            },
            {
              content: <div>enabled field</div>,
              hidden: false,
              name: 'enabled',
            },
            {
              content: <input data-testid="field-awsSecretAccessKey" />,
              hidden: false,
              name: 'awsSecretAccessKey',
            },
            {
              content: <input data-testid="field-awsAccessKeyId" />,
              hidden: false,
              name: 'awsAccessKeyId',
            },
            {
              content: <input data-testid="field-awsSessionToken" />,
              hidden: false,
              name: 'awsSessionToken',
            },
          ],
        }}
      />
    );

    expect(screen.getByTestId('storage-config-title-icon')).toBeInTheDocument();
    expect(
      container.querySelector('.core-object-field-template-storage-config')
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '.core-object-field-template-gated-credential-block'
      )
    ).toBeInTheDocument();
    expect(
      container.querySelector('.core-object-field-template-property-enabled')
    ).toHaveTextContent('enabled field');
    expect(
      container.querySelector('.core-object-field-template-property-enabled')
    ).toHaveClass('core-object-field-template-property-toggle-banner');
    expect(
      container.querySelector('.core-object-field-template-property-awsRegion')
    ).toHaveTextContent('region field');
    expect(
      Array.from(
        container.querySelectorAll(
          '.core-object-field-template-storage-config > .core-object-field-template-body-gated > .core-object-field-template-property'
        )
      ).map((element) => element.getAttribute('data-field-name'))
    ).toEqual(['enabled']);
    expect(
      Array.from(
        container.querySelectorAll(
          '.core-object-field-template-storage-config .core-object-field-template-credential-field-grid > .core-object-field-template-property'
        )
      ).map((element) => element.getAttribute('data-field-name'))
    ).toEqual(['awsAccessKeyId', 'awsSecretAccessKey', 'awsRegion']);
    expect(screen.getByTestId('field-awsAccessKeyId')).toBeDisabled();
    expect(screen.getByTestId('field-awsSecretAccessKey')).toBeDisabled();
    expect(
      container.querySelector(
        '.core-object-field-template-property-awsAccessKeyId'
      )
    ).toHaveClass('core-object-field-template-property-disabled');

    const advancedCredentialToggle = screen.getByRole('button', {
      name: 'label.show label.advanced-config (2)',
    });

    expect(
      screen.queryByTestId('field-awsSessionToken')
    ).not.toBeInTheDocument();

    fireEvent.click(advancedCredentialToggle);

    expect(screen.getByTestId('field-awsSessionToken')).toBeDisabled();
    expect(
      container.querySelector('.core-object-field-template-advanced-grid')
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '.core-object-field-template-property-assumeRoleArn'
      )
    ).not.toHaveClass('core-object-field-template-property-full-width');
  });

  it('uses a generic two-column layout for nested credential configs', () => {
    const { container } = render(
      <CoreObjectFieldTemplate
        {...({
          idSchema: { $id: 'root/authType/cloudConfig/cloudConfig' },
          registry: {} as ObjectFieldTemplateProps['registry'],
          schema: {
            type: 'object',
            properties: {
              connectTimeout: {
                title: 'Connect Timeout',
                type: 'integer',
              },
              requestTimeout: {
                title: 'Request Timeout',
                type: 'integer',
              },
              token: {
                title: 'Token',
                type: 'string',
              },
              secureConnectBundle: {
                description:
                  'File path to the Secure Connect Bundle (.zip) used for a secure connection.',
                title: 'Secure Connect Bundle',
                type: 'string',
              },
            },
          },
          title: 'DataStax Astra DB Configuration',
          onAddClick: jest.fn(),
          properties: [
            {
              content: <div>connect timeout field</div>,
              hidden: false,
              name: 'connectTimeout',
            } as ObjectFieldTemplatePropertyType,
            {
              content: <div>request timeout field</div>,
              hidden: false,
              name: 'requestTimeout',
            } as ObjectFieldTemplatePropertyType,
            {
              content: <div>token field</div>,
              hidden: false,
              name: 'token',
            } as ObjectFieldTemplatePropertyType,
            {
              content: <div>secure bundle field</div>,
              hidden: false,
              name: 'secureConnectBundle',
            } as ObjectFieldTemplatePropertyType,
          ],
        } as unknown as ObjectFieldTemplateProps)}
      />
    );

    expect(
      container.querySelector('.core-object-field-template-credential-block')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.core-object-field-template-body-grid')
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '.core-object-field-template-property-connectTimeout'
      )
    ).not.toHaveClass('core-object-field-template-property-full-width');
    expect(
      container.querySelector(
        '.core-object-field-template-property-requestTimeout'
      )
    ).not.toHaveClass('core-object-field-template-property-full-width');
    expect(
      container.querySelector('.core-object-field-template-property-token')
    ).toHaveClass('core-object-field-template-property-full-width');
    expect(
      container.querySelector(
        '.core-object-field-template-property-secureConnectBundle'
      )
    ).toHaveClass('core-object-field-template-property-full-width');
  });

  it('disables static AWS credentials for AWS S3 configs with IAM auth', () => {
    const { container } = render(
      <CoreObjectFieldTemplate
        {...{
          idSchema: { $id: 'root/securityConfig' },
          formData: { enabled: true },
          registry: {} as ObjectFieldTemplateProps['registry'],
          schema: {},
          title: 'AWS S3 Storage Config',
          onAddClick: jest.fn(),
          properties: [
            {
              content: <div>enabled field</div>,
              hidden: false,
              name: 'enabled',
            },
            {
              content: <input data-testid="generic-awsAccessKeyId" />,
              hidden: false,
              name: 'awsAccessKeyId',
            },
            {
              content: <input data-testid="generic-awsSecretAccessKey" />,
              hidden: false,
              name: 'awsSecretAccessKey',
            },
            {
              content: <div>region field</div>,
              hidden: false,
              name: 'awsRegion',
            },
          ],
        }}
      />
    );

    expect(
      container.querySelector('.core-object-field-template-storage-config')
    ).toBeInTheDocument();
    expect(screen.getByTestId('storage-config-title-icon')).toBeInTheDocument();
    expect(screen.getByTestId('generic-awsAccessKeyId')).toBeDisabled();
    expect(screen.getByTestId('generic-awsSecretAccessKey')).toBeDisabled();
  });

  it('renders wrap-if-additional as plain children when not an additional property', () => {
    render(
      <CoreWrapIfAdditionalTemplate
        {...({
          id: 'field-id',
          label: 'myKey',
          schema: {},
          disabled: false,
          readonly: false,
          onKeyChange: jest.fn(),
          onDropPropertyClick: jest.fn(() => jest.fn()),
          registry: {} as WrapIfAdditionalTemplateProps['registry'],
        } as unknown as WrapIfAdditionalTemplateProps)}>
        <div>plain child</div>
      </CoreWrapIfAdditionalTemplate>
    );

    expect(screen.getByText('plain child')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('label.key')).not.toBeInTheDocument();
  });

  it('renders wrap-if-additional key input and calls handlers for additional properties', () => {
    const onKeyChange = jest.fn();
    const onDropIndexFn = jest.fn();
    const onDropPropertyClick = jest.fn(() => onDropIndexFn);

    render(
      <CoreWrapIfAdditionalTemplate
        {...({
          id: 'field-id',
          label: 'myKey',
          schema: { __additional_property: true },
          disabled: false,
          readonly: false,
          onKeyChange,
          onDropPropertyClick,
          registry: {} as WrapIfAdditionalTemplateProps['registry'],
        } as unknown as WrapIfAdditionalTemplateProps)}>
        <div>value child</div>
      </CoreWrapIfAdditionalTemplate>
    );

    expect(screen.getByText('value child')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('label.option')).toHaveValue('myKey');

    const keyInput = screen.getByDisplayValue('myKey');

    fireEvent.change(keyInput, { target: { value: 'newKey' } });
    fireEvent.blur(keyInput);

    expect(onKeyChange).toHaveBeenCalledWith('newKey');

    fireEvent.click(screen.getByRole('button', { name: 'label.remove' }));

    expect(onDropPropertyClick).toHaveBeenCalledWith('myKey');
    expect(onDropIndexFn).toHaveBeenCalled();
  });

  it('renders de-duplicated field errors only when errors exist', () => {
    const fieldErrorBase: Omit<FieldErrorProps, 'errors'> = {
      idSchema: { $id: 'field-id' },
      registry: {} as FieldErrorProps['registry'],
      schema: { $id: 'schema-id' },
    };

    const { rerender } = render(
      <CoreFieldErrorTemplate
        {...fieldErrorBase}
        errors={['Required', 'Required', 'Invalid']}
      />
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();

    rerender(<CoreFieldErrorTemplate {...fieldErrorBase} errors={[]} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

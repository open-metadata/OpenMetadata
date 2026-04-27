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
} from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { CoreArrayFieldTemplate } from './CoreArrayFieldTemplate';
import { CoreFieldErrorTemplate } from './CoreFieldErrorTemplate';
import { CoreFieldTemplate } from './CoreFieldTemplate';
import { CoreObjectFieldTemplate } from './CoreObjectFieldTemplate';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      onClick,
      ...props
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => (
      <button type="button" onClick={onClick} {...props}>
        {children}
      </button>
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
}));

jest.mock('@untitledui/icons', () => ({
  Plus: () => <span>plus-icon</span>,
  Trash01: () => <span>trash-icon</span>,
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
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders array items and add/remove controls', () => {
    const onAddClick = jest.fn();
    const onDropIndexClick = jest.fn(() => jest.fn());

    render(
      <CoreArrayFieldTemplate
        {...({
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
        } as unknown as ArrayFieldTemplateProps)}
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
      registry: {} as FieldTemplateProps['registry'],
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

    expect(container.firstChild).toHaveClass('field-wrapper');
    expect(container.firstChild).toHaveStyle({ marginTop: '8px' });
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
        {...({
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
            } as ObjectFieldTemplatePropertyType,
            {
              content: <div>advanced property</div>,
              hidden: false,
              name: 'connectionOptions',
            } as ObjectFieldTemplatePropertyType,
          ],
        } as unknown as ObjectFieldTemplateProps)}
      />
    );

    expect(screen.getByText('basic property')).toBeInTheDocument();
    expect(screen.queryByText('advanced property')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-item-Connection'));

    expect(onAddClick).toHaveBeenCalledWith({ additionalProperties: true });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'label.show-entity:label.advanced-config',
      })
    );

    expect(screen.getByText('advanced property')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'label.hide-entity:label.advanced-config',
      })
    );

    expect(screen.queryByText('advanced property')).not.toBeInTheDocument();
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

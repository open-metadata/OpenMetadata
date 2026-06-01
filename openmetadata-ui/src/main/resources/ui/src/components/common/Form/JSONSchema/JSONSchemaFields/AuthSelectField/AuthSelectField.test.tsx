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

import { FieldProps } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import AuthSelectField from './AuthSelectField';

jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: ({
    children,
    as: Tag = 'span',
  }: {
    children: React.ReactNode;
    as?: React.ElementType;
  }) => <Tag>{children}</Tag>,
}));

jest.mock('@untitledui/icons', () => ({
  InfoCircle: () => <span data-testid="info-icon" />,
  Key01: () => <span data-testid="key-icon" />,
  Lock01: () => <span data-testid="lock-icon" />,
}));

jest.mock('../../../../../../utils/i18next/LocalUtil', () => ({
  Transi18next: ({ values }: { values?: { method?: string } }) => (
    <span data-testid="affirmation-text">{values?.method}</span>
  ),
}));

jest.mock('react-aria-components', () => {
  const ReactLib = require('react');

  return {
    RadioGroup: ({
      children,
      value,
      onChange,
    }: {
      children: React.ReactNode;
      value: string;
      onChange: (value: string) => void;
    }) => (
      <div role="radiogroup">
        {ReactLib.Children.map(children, (child: React.ReactElement) =>
          ReactLib.cloneElement(child, {
            __selectedValue: value,
            __onChange: onChange,
          })
        )}
      </div>
    ),
    Radio: ({
      children,
      value,
      className,
      __selectedValue,
      __onChange,
      ...rest
    }: {
      children: (props: { isSelected: boolean }) => React.ReactNode;
      value: string;
      className?: (props: { isSelected: boolean }) => string;
      __selectedValue?: string;
      __onChange?: (value: string) => void;
      'data-testid'?: string;
    }) => {
      const isSelected = String(__selectedValue) === String(value);

      return (
        <button
          aria-checked={isSelected}
          className={
            typeof className === 'function'
              ? className({ isSelected })
              : className
          }
          data-testid={rest['data-testid']}
          role="radio"
          type="button"
          onClick={() => __onChange?.(value)}>
          {typeof children === 'function' ? children({ isSelected }) : children}
        </button>
      );
    },
  };
});

const PASSWORD_BRANCH = {
  title: 'Password',
  type: 'object',
  properties: { password: { type: 'string', format: 'password' } },
};
const KEY_PAIR_BRANCH = {
  title: 'Key pair',
  type: 'object',
  properties: { privateKey: { type: 'string', format: 'password' } },
};

const sanitizeSpy = jest.fn(
  (
    _newSchema: unknown,
    _currentSchema: unknown,
    data: Record<string, unknown>
  ) => data
);
const onChangeSpy = jest.fn();

const getProps = (
  formData: Record<string, unknown>,
  uiSchema: Record<string, unknown> = {},
  schema: Record<string, unknown> = {
    title: 'Authentication',
    oneOf: [PASSWORD_BRANCH, KEY_PAIR_BRANCH],
  }
) =>
  ({
    formData,
    uiSchema,
    idSchema: { $id: 'root/authType' },
    name: 'authType',
    onBlur: jest.fn(),
    onChange: onChangeSpy,
    onFocus: jest.fn(),
    registry: {
      fields: {
        SchemaField: ({
          schema,
          uiSchema,
        }: {
          schema: { properties?: object };
          uiSchema?: Record<string, unknown>;
        }) => (
          <div
            data-testid="schema-field"
            data-ui-field={String(uiSchema?.['ui:field'] ?? '')}>
            {Object.keys(schema.properties ?? {}).join(',')}
          </div>
        ),
      },
      schemaUtils: {
        getClosestMatchingOption: (
          data: Record<string, unknown>,
          _options: unknown[],
          selectedOption: number
        ) => (data.privateKey ? 1 : selectedOption),
        getDefaultFormState: (
          _schema: unknown,
          data: Record<string, unknown> | undefined
        ) => data ?? {},
        retrieveSchema: (schema: unknown) => schema,
        sanitizeDataForNewSchema: sanitizeSpy,
        toIdSchema: () => ({ $id: 'root/authType' }),
      },
    },
    schema,
  } as unknown as FieldProps);

describe('AuthSelectField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders one segmented option per oneOf branch using their titles', () => {
    render(<AuthSelectField {...getProps({})} />);

    expect(screen.getByRole('radio', { name: /Password/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Key pair/ })).toBeInTheDocument();
  });

  it('shows only the active branch fields and the single-credential affirmation', () => {
    render(<AuthSelectField {...getProps({})} />);

    expect(screen.getByTestId('schema-field')).toHaveTextContent('password');
    expect(screen.getByTestId('schema-field')).not.toHaveTextContent(
      'privateKey'
    );
    expect(screen.getByTestId('auth-affirmation')).toBeInTheDocument();
    expect(screen.getByTestId('affirmation-text')).toHaveTextContent(
      'Password'
    );
  });

  it('clears the previous branch credential when switching methods (one-of guarantee)', () => {
    sanitizeSpy.mockReturnValueOnce({});

    render(<AuthSelectField {...getProps({ password: 'secret' })} />);

    fireEvent.click(screen.getByRole('radio', { name: /Key pair/ }));

    expect(sanitizeSpy).toHaveBeenCalledWith(KEY_PAIR_BRANCH, PASSWORD_BRANCH, {
      password: 'secret',
    });
    expect(onChangeSpy).toHaveBeenCalledWith(
      {},
      undefined,
      'root/authType__oneof_select'
    );
    expect(screen.getByRole('radio', { name: /Key pair/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByTestId('schema-field')).toHaveTextContent('privateKey');
  });

  it('marks the recommended branch only while it is selected', () => {
    render(
      <AuthSelectField
        {...getProps(
          { privateKey: 'pem' },
          { 'ui:options': { recommended: 'Key pair' } }
        )}
      />
    );

    expect(screen.getByTestId('recommended-indicator')).toBeInTheDocument();
  });

  it('does not pass its authSelect ui field to the selected schema branch', () => {
    render(<AuthSelectField {...getProps({}, { 'ui:field': 'authSelect' })} />);

    expect(screen.getByTestId('schema-field')).toHaveAttribute(
      'data-ui-field',
      ''
    );
  });

  it('renders a single auth branch without the segmented method selector', () => {
    render(
      <AuthSelectField
        {...getProps(
          {},
          {},
          {
            title: 'Authentication',
            oneOf: [PASSWORD_BRANCH],
          }
        )}
      />
    );

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByTestId('schema-field')).toHaveTextContent('password');
  });

  it('renders an empty selected schema when no auth branches are provided', () => {
    render(
      <AuthSelectField
        {...getProps(
          {},
          {},
          {
            title: 'Authentication',
            oneOf: [],
          }
        )}
      />
    );

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByTestId('schema-field')).toHaveTextContent('');
  });
});

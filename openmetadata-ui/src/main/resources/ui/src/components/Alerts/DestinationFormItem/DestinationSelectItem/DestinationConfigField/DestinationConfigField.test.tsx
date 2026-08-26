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

import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  SubscriptionCategory,
  SubscriptionType,
  Type,
} from '../../../../../generated/events/eventSubscription';
import DestinationConfigField from './DestinationConfigField';

jest.mock('@openmetadata/ui-core-components', () => {
  const Grid = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  Grid.Item = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Select = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  Select.Item = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    Accordion: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    AccordionHeader: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    AccordionItem: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    AccordionPanel: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    BadgeWithButton: ({
      children,
      'data-testid': dataTestId,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
    }) => <span data-testid={dataTestId}>{children}</span>,
    Button: ({
      children,
      'data-testid': dataTestId,
      onPress,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
      onPress?: () => void;
    }) => (
      <button data-testid={dataTestId} onClick={onPress}>
        {children}
      </button>
    ),
    Badge: ({
      children,
      'data-testid': dataTestId,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
    }) => <span data-testid={dataTestId}>{children}</span>,
    Grid,
    Input: forwardRef<
      HTMLInputElement,
      {
        inputDataTestId?: string;
        value?: string;
        onChange?: (value: string) => void;
        onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
        isDisabled?: boolean;
      }
    >(({ inputDataTestId, value, onChange, onKeyDown, isDisabled }, ref) => (
      <input
        aria-label={inputDataTestId ?? 'Input'}
        data-testid={inputDataTestId}
        disabled={isDisabled}
        ref={ref}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={onKeyDown}
      />
    )),
    PasswordInput: forwardRef<HTMLInputElement, { 'data-testid'?: string }>(
      ({ 'data-testid': dataTestId }, ref) => (
        <input
          aria-label={dataTestId ?? 'Password'}
          data-testid={dataTestId}
          ref={ref}
        />
      )
    ),
    RadioButton: ({ value }: { value: string }) => <span>{value}</span>,
    RadioGroup: ({
      children,
      'data-testid': dataTestId,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={dataTestId}>{children}</div>,
    Select,
  };
});

jest.mock('@untitledui/icons', () => ({
  ConfigIcon: () => null,
}));

jest.mock(
  '../../TeamAndUserSelectItem/TeamAndUserSelectItem',
  () => () => null
);

function renderEmailField() {
  function Wrapper() {
    const methods = useForm({
      defaultValues: { destinations: [{ config: { receivers: [] } }] },
    });

    return (
      <FormProvider {...methods}>
        <DestinationConfigField fieldName={0} type={SubscriptionType.Email} />
      </FormProvider>
    );
  }

  return render(<Wrapper />);
}

function renderDisabledEmailField() {
  function Wrapper() {
    const methods = useForm({
      defaultValues: { destinations: [{ config: { receivers: [] } }] },
    });

    return (
      <FormProvider {...methods}>
        <DestinationConfigField
          isViewMode
          fieldName={0}
          type={SubscriptionType.Email}
        />
      </FormProvider>
    );
  }

  return render(<Wrapper />);
}

function renderValidationField(
  type: SubscriptionType | SubscriptionCategory,
  onSubmit: jest.Mock
) {
  function Wrapper() {
    const methods = useForm({
      defaultValues: { destinations: [{ config: { receivers: [] } }] },
    });

    return (
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <DestinationConfigField fieldName={0} type={type} />
          <button data-testid="submit" type="submit">
            Submit
          </button>
        </form>
      </FormProvider>
    );
  }

  return render(<Wrapper />);
}

function renderWebhookField() {
  function Wrapper() {
    const methods = useForm({
      defaultValues: {
        destinations: [
          {
            config: {
              authType: { type: Type.Oauth2 },
              headers: [{ key: 'Content-Type', value: 'application/json' }],
              queryParams: [{ key: 'channel', value: 'alerts' }],
            },
          },
        ],
      },
    });

    return (
      <FormProvider {...methods}>
        <DestinationConfigField fieldName={0} type={SubscriptionType.Webhook} />
      </FormProvider>
    );
  }

  return render(<Wrapper />);
}

describe('DestinationConfigField', () => {
  it('rejects invalid email receivers and accepts valid ones', () => {
    renderEmailField();

    const input = screen.getByTestId('email-input-field-0');
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('message.email-is-invalid')).toBeInTheDocument();
    expect(
      screen.queryByTestId('email-tag-not-an-email')
    ).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'alerts@example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(
      screen.getByTestId('email-tag-alerts@example.com')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.email-is-invalid')
    ).not.toBeInTheDocument();
  });

  it('disables the email receiver input in view mode', () => {
    renderDisabledEmailField();

    expect(screen.getByTestId('email-input-field-0')).toBeDisabled();
  });

  it.each([SubscriptionType.Email, SubscriptionCategory.Teams])(
    'requires receivers for %s destinations',
    async (type) => {
      const onSubmit = jest.fn();
      renderValidationField(type, onSubmit);

      fireEvent.click(screen.getByTestId('submit'));

      expect(
        await screen.findByText('message.field-text-is-required')
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    }
  );

  it('supports the complete webhook configuration', () => {
    renderWebhookField();

    expect(screen.getByTestId('scope-input-field-0')).toBeInTheDocument();
    expect(screen.getByTestId('header-key-input-field-0')).toHaveValue(
      'Content-Type'
    );
    expect(screen.getByTestId('header-value-input-field-0')).toHaveValue(
      'application/json'
    );
    expect(screen.getByTestId('query-param-key-input-field-0')).toHaveValue(
      'channel'
    );
    expect(screen.getByTestId('query-param-value-input-field-0')).toHaveValue(
      'alerts'
    );
    expect(screen.getByTestId('http-method-0')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-header-button-0'));

    expect(screen.getByTestId('header-key-input-field-1')).toBeInTheDocument();
  });
});

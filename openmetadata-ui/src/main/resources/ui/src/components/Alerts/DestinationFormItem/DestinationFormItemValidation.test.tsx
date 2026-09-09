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
import { useState } from 'react';
import {
  HTTPMethod,
  SubscriptionCategory,
  SubscriptionType,
  Type,
} from '../../../generated/events/eventSubscription';
import DestinationFormItemFormBridge, {
  DestinationFormFields,
} from './DestinationFormItemFormBridge';

const OAUTH_DESTINATION_VALUES: Partial<DestinationFormFields> = {
  destinations: [
    {
      category: SubscriptionCategory.External,
      config: {
        authType: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          tokenUrl: 'https://auth.example.com/oauth/token',
          type: Type.Oauth2,
        },
        endpoint: 'https://hooks.slack.com/services/test',
        httpMethod: HTTPMethod.Post,
      },
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
    },
  ],
};

interface ValidationHarnessProps {
  initialValues?: Partial<DestinationFormFields>;
  isRequired?: boolean;
  onFinish: jest.Mock;
}

function ValidationHarness({
  initialValues,
  isRequired,
  onFinish,
}: ValidationHarnessProps) {
  const [values, setValues] = useState<Partial<DestinationFormFields>>(
    initialValues ?? {}
  );
  const [isBlocked, setIsBlocked] = useState(false);
  const [validationError, setValidationError] = useState('');

  return (
    <>
      <DestinationFormItemFormBridge
        isRequired={isRequired}
        renderValidationField={(validate) => (
          <button
            type="button"
            onClick={async () => {
              try {
                await validate();
                onFinish();
              } catch (error) {
                setIsBlocked(true);
                setValidationError((error as Error).message);
              }
            }}>
            Save
          </button>
        )}
        values={values}
        onChange={(nextValues) => setValues(nextValues)}
      />
      {isBlocked && <span>parent-form-blocked</span>}
      <output data-testid="parent-validation-error">
        {JSON.stringify(validationError)}
      </output>
    </>
  );
}

function ParentFormFocusHarness() {
  const [values, setValues] = useState<Partial<DestinationFormFields>>(
    OAUTH_DESTINATION_VALUES
  );

  return (
    <>
      <output data-testid="parent-token-url">
        {values.destinations?.[0]?.config?.authType?.tokenUrl}
      </output>
      <DestinationFormItemFormBridge values={values} onChange={setValues} />
    </>
  );
}

function ParentFormDestinationChangeHarness() {
  const [values, setValues] = useState<Partial<DestinationFormFields>>({
    destinations: OAUTH_DESTINATION_VALUES.destinations,
    resources: ['table'],
  });

  return <DestinationFormItemFormBridge values={values} onChange={setValues} />;
}

describe('DestinationFormItem validation', () => {
  it('shows the minimum destination error when required submission is blocked', async () => {
    const onFinish = jest.fn();
    render(<ValidationHarness onFinish={onFinish} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('parent-form-blocked');

    expect(screen.getByText('message.length-validator-error')).toHaveClass(
      'tw:text-error-primary'
    );
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('allows submission without a destination when optional', async () => {
    const onFinish = jest.fn();
    render(<ValidationHarness isRequired={false} onFinish={onFinish} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));

    expect(
      screen.queryByText('message.length-validator-error')
    ).not.toBeInTheDocument();
  });

  it('does not report a missing destination when nested config is invalid', async () => {
    const onFinish = jest.fn();
    render(
      <ValidationHarness
        initialValues={{
          destinations: [
            {
              category: SubscriptionCategory.External,
              config: { endpoint: '' },
              destinationType: SubscriptionType.Slack,
              type: SubscriptionType.Slack,
            },
          ],
        }}
        onFinish={onFinish}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('parent-form-blocked');

    expect(screen.getByTestId('parent-validation-error')).not.toHaveTextContent(
      'message.length-validator-error'
    );
    expect(screen.getByTestId('parent-validation-error')).not.toHaveTextContent(
      'message.minimum-count-error'
    );
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('keeps a destination input focused when the parent form echoes its value', async () => {
    render(<ParentFormFocusHarness />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'label.advanced-configuration',
      })
    );

    const tokenUrlInput = screen.getByPlaceholderText(
      'https://auth.example.com/oauth/token'
    );
    tokenUrlInput.focus();
    fireEvent.change(tokenUrlInput, {
      target: { value: 'https://auth.example.com/oauth/token/v2' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('parent-token-url')).toHaveTextContent(
        'https://auth.example.com/oauth/token/v2'
      )
    );

    expect(document.activeElement).toBe(tokenUrlInput);
  });

  it('clears registered config fields when the destination changes', async () => {
    render(<ParentFormDestinationChangeHarness />);

    fireEvent.click(
      (
        await screen.findByTestId('destination-category-select-0')
      ).querySelector('button') as HTMLElement
    );
    fireEvent.click(await screen.findByRole('option', { name: 'G Chat' }));

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(
          'https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=XXXXX'
        )
      ).toHaveValue('')
    );
  });
});

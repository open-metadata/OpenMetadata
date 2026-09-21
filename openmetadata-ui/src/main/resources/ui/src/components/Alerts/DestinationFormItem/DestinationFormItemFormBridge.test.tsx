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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import DestinationFormItemFormBridge, {
  DestinationFormFields,
} from './DestinationFormItemFormBridge';

const mockWatchSubscription = jest.fn();

jest.mock('react-hook-form', () => {
  const actual = jest.requireActual(
    'react-hook-form'
  ) as typeof import('react-hook-form');
  const wrappedWatches = new WeakMap<object, object>();

  return {
    ...actual,
    useForm: (...args: Parameters<typeof actual.useForm>) => {
      const methods = actual.useForm(...args);
      const originalWatch = methods.watch;
      let wrappedWatch = wrappedWatches.get(originalWatch) as
        | typeof originalWatch
        | undefined;

      if (!wrappedWatch) {
        wrappedWatch = new Proxy(originalWatch, {
          apply(target, thisArg, argArray) {
            if (typeof argArray[0] === 'function') {
              mockWatchSubscription();
            }

            return Reflect.apply(target, thisArg, argArray);
          },
        });
        wrappedWatches.set(originalWatch, wrappedWatch);
      }

      return { ...methods, watch: wrappedWatch };
    },
  };
});

jest.mock('./DestinationFormItem.component', () => {
  const { useFormContext, useWatch } = jest.requireActual(
    'react-hook-form'
  ) as typeof import('react-hook-form');

  return function MockDestinationFormItem() {
    const { control, setValue } = useFormContext();
    const destinations = useWatch({ control, name: 'destinations' }) ?? [];

    return (
      <div>
        <output data-testid="destinations-value">
          {JSON.stringify(destinations)}
        </output>
        <button
          data-testid="add-core-destination"
          type="button"
          onClick={() =>
            setValue('destinations', [
              {
                category: SubscriptionCategory.External,
                destinationType: SubscriptionType.Slack,
                type: SubscriptionType.Slack,
              },
            ])
          }>
          Add
        </button>
      </div>
    );
  };
});

interface HarnessProps {
  initialValues?: Partial<DestinationFormFields>;
  isRequired?: boolean;
  onFinish: (values: Partial<DestinationFormFields>) => void;
}

function Harness({ initialValues, isRequired, onFinish }: HarnessProps) {
  const [values, setValues] = useState(initialValues ?? {});
  const [validationError, setValidationError] = useState<string>();
  const [renderCount, setRenderCount] = useState(0);

  return (
    <>
      <DestinationFormItemFormBridge
        isRequired={isRequired}
        renderValidationField={(validate) => (
          <button
            data-testid="submit"
            type="button"
            onClick={async () => {
              try {
                await validate();
                setValidationError(undefined);
                onFinish(values);
              } catch (error) {
                setValidationError((error as Error).message);
              }
            }}>
            Submit
          </button>
        )}
        values={{ ...values }}
        onChange={(nextValues) => setValues(nextValues)}
      />
      {validationError}
      <button
        data-testid="external-update"
        type="button"
        onClick={() => setValues(initialValues ?? {})}>
        Reset
      </button>
      <button
        data-testid="submit-values"
        type="button"
        onClick={() => onFinish(values)}>
        Submit
      </button>
      <button
        data-testid="rerender-parent"
        type="button"
        onClick={() => setRenderCount((count) => count + 1)}>
        {renderCount}
      </button>
    </>
  );
}

describe('DestinationFormItemFormBridge', () => {
  it('provides controlled destination values to the core form', () => {
    render(
      <Harness
        initialValues={{
          destinations: [
            {
              category: SubscriptionCategory.External,
              destinationType: SubscriptionType.Slack,
              type: SubscriptionType.Slack,
            },
          ],
        }}
        onFinish={jest.fn()}
      />
    );

    expect(screen.getByTestId('destinations-value')).toHaveTextContent('Slack');
  });

  it('writes core form changes back to controlled parent values', async () => {
    const onFinish = jest.fn();
    render(<Harness onFinish={onFinish} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-core-destination'));
    });

    fireEvent.click(screen.getByTestId('submit-values'));

    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          destinations: [expect.objectContaining({ destinationType: 'Slack' })],
        })
      )
    );
  });

  it('blocks the parent form when a required destination is missing', async () => {
    const onFinish = jest.fn();
    render(<Harness isRequired onFinish={onFinish} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    expect(
      await screen.findByText('message.length-validator-error')
    ).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('resets the core form when controlled values change', async () => {
    render(
      <Harness
        initialValues={{
          destinations: [
            {
              category: SubscriptionCategory.External,
              destinationType: SubscriptionType.Email,
              type: SubscriptionType.Email,
            },
          ],
        }}
        onFinish={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-core-destination'));
    fireEvent.click(screen.getByTestId('external-update'));

    await waitFor(() =>
      expect(screen.getByTestId('destinations-value')).toHaveTextContent(
        'Email'
      )
    );
  });

  it('keeps one form subscription across unrelated parent renders', () => {
    mockWatchSubscription.mockClear();
    render(<Harness onFinish={jest.fn()} />);

    expect(mockWatchSubscription).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('rerender-parent'));

    expect(mockWatchSubscription).toHaveBeenCalledTimes(1);
  });
});

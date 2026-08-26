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
import { Form } from 'antd';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import DestinationFormItemFormBridge from './DestinationFormItemFormBridge';

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
  initialValues?: Partial<ModifiedCreateEventSubscription>;
  isRequired?: boolean;
  onFinish: (values: ModifiedCreateEventSubscription) => void;
}

function Harness({ initialValues, isRequired, onFinish }: HarnessProps) {
  return (
    <Form<ModifiedCreateEventSubscription>
      initialValues={initialValues}
      onFinish={onFinish}>
      <DestinationFormItemFormBridge isRequired={isRequired} />
      <button data-testid="submit" type="submit">
        Submit
      </button>
    </Form>
  );
}

describe('DestinationFormItemFormBridge', () => {
  it('provides Ant Form destination values to the core form', () => {
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

  it('writes core form changes back to Ant Form submission values', async () => {
    const onFinish = jest.fn();
    render(<Harness onFinish={onFinish} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-core-destination'));
      fireEvent.click(screen.getByTestId('submit'));
    });

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
      await screen.findByText('message.minimum-count-error')
    ).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });
});

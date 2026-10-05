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
import { Form } from 'antd';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import { testAlertDestination } from '../../../rest/alertsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import DestinationFormItem from './DestinationFormItem.component';

jest.mock('../../../rest/alertsAPI', () => ({
  testAlertDestination: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: '' }),
}));

const clickTestButtonFor = async (destination: Record<string, unknown>) => {
  render(
    <Form
      initialValues={{
        resources: ['table'],
        destinations: [
          { category: SubscriptionCategory.External, ...destination },
        ],
      }}>
      <Form.Item hidden name="resources" />
      <DestinationFormItem />
    </Form>
  );

  const testButton = screen.getByTestId('test-destination-button');

  await waitFor(() => expect(testButton).toBeEnabled());
  fireEvent.click(testButton);
};

describe('DestinationFormItem test destination button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([SubscriptionType.Email, SubscriptionType.Slack])(
    'shows required errors instead of testing an unconfigured %s destination',
    async (type) => {
      await clickTestButtonFor({ destinationType: type, type });

      expect(
        await screen.findByText('message.field-text-is-required')
      ).toBeInTheDocument();
      expect(testAlertDestination).not.toHaveBeenCalled();
      expect(showErrorToast).not.toHaveBeenCalled();
    }
  );

  it('still tests a configured destination', async () => {
    await clickTestButtonFor({
      destinationType: SubscriptionType.Email,
      type: SubscriptionType.Email,
      config: { receivers: ['user@example.com'] },
    });

    await waitFor(() =>
      expect(testAlertDestination).toHaveBeenCalledWith({
        destinations: [
          expect.objectContaining({
            category: SubscriptionCategory.External,
            type: SubscriptionType.Email,
            config: { receivers: ['user@example.com'] },
          }),
        ],
      })
    );
  });
});

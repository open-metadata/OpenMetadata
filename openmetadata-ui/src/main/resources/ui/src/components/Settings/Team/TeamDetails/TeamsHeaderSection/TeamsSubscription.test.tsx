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
import { act, fireEvent, render, screen } from '@testing-library/react';
import TeamsSubscription from './TeamsSubscription.component';

describe('TeamsSubscription', () => {
  const mockUpdateTeamSubscription = jest.fn();

  const teamProps = {
    hasEditPermission: true,
    updateTeamSubscription: mockUpdateTeamSubscription,
  };

  it('renders Teams Subscription', async () => {
    await act(async () => {
      render(<TeamsSubscription {...teamProps} />);
    });
    const subscription = screen.getByTestId('teams-subscription');

    expect(subscription).toBeInTheDocument();
  });

  it('should handle edit team subscription', () => {
    const { getByTestId } = render(<TeamsSubscription {...teamProps} />);
    const editButton = getByTestId('edit-team-subscription');
    fireEvent.click(editButton);
    const subscriptionModal = getByTestId('subscription-modal');

    expect(subscriptionModal).toBeInTheDocument();
  });

  it('should handle save team subscription', async () => {
    const { getByTestId, getByText } = render(
      <TeamsSubscription {...teamProps} />
    );
    const editButton = getByTestId('edit-team-subscription');
    await act(async () => {
      fireEvent.click(editButton);
    });
    const saveButton = getByText('label.confirm');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockUpdateTeamSubscription).toHaveBeenCalled();
  });

  it('should render no data when no subscription', async () => {
    const { getByTestId } = render(<TeamsSubscription {...teamProps} />);
    const noData = getByTestId('subscription-no-data');

    expect(noData).toBeInTheDocument();
  });

  it('should not render subscriptionRenderElement when no edit permission', async () => {
    teamProps.hasEditPermission = false;

    const { queryByTestId } = render(
      <TeamsSubscription
        {...teamProps}
        subscription={{
          gChat: { endpoint: 'test-endpoint' },
        }}
      />
    );
    const noData = queryByTestId('subscription-no-data');

    expect(noData).not.toBeInTheDocument();
  });
});

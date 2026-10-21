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
import {
  addServiceFollower,
  removeServiceFollower,
} from '../../../rest/serviceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ServiceFollowButton } from './ServiceFollowButton';

jest.mock('../../../rest/serviceAPI', () => ({
  addServiceFollower: jest.fn(),
  removeServiceFollower: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me' } }),
}));

jest.mock('../../DataAssets/DataAssetsHeader/FollowStarIcon.component', () => ({
  FollowStarIcon: ({ selected }: { selected: boolean }) => (
    <span data-testid={selected ? 'star-filled' : 'star-outline'} />
  ),
}));

const ME = { id: 'me', type: 'user' };
const OTHER = { id: 'other', type: 'user' };
const onFollowersChange = jest.fn();

const renderButton = (followers = [OTHER]) =>
  render(
    <ServiceFollowButton
      followers={followers}
      serviceId="svc-1"
      serviceName="sales_db"
      onFollowersChange={onFollowersChange}
    />
  );

describe('ServiceFollowButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('follows the service and hands back the followers it now has', async () => {
    (addServiceFollower as jest.Mock).mockResolvedValue({
      changeDescription: { fieldsAdded: [{ newValue: [ME] }] },
    });
    renderButton();

    expect(screen.getByTestId('star-outline')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.follow' }));

    await waitFor(() =>
      expect(onFollowersChange).toHaveBeenCalledWith([OTHER, ME])
    );

    expect(addServiceFollower).toHaveBeenCalledWith('svc-1', 'me');
  });

  it('unfollows a service the user follows', async () => {
    (removeServiceFollower as jest.Mock).mockResolvedValue({});
    renderButton([OTHER, ME]);

    expect(screen.getByTestId('star-filled')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.un-follow' }));

    await waitFor(() =>
      expect(onFollowersChange).toHaveBeenCalledWith([OTHER])
    );

    expect(removeServiceFollower).toHaveBeenCalledWith('svc-1', 'me');
  });

  it('keeps the followers and says why when following fails', async () => {
    const error = new Error('boom');
    (addServiceFollower as jest.Mock).mockRejectedValue(error);
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'label.follow' }));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        error,
        'server.entity-follow-error'
      )
    );

    expect(onFollowersChange).not.toHaveBeenCalled();
  });
});

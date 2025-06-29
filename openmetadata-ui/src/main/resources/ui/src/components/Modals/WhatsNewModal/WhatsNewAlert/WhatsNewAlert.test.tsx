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
import { useAuth } from '../../../../hooks/authHooks';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import WhatsNewAlert from './WhatsNewAlert.component';

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: '/my-data' }));
});

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({
    isFirstTimeUser: true,
  })),
}));

jest.mock('../../../../utils/WhatsNewModal.util', () => ({
  getReleaseVersionExpiry: jest.fn().mockImplementation(() => new Date()),
}));

jest.mock('../WhatsNewModal', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="whats-new-dialog">WhatsNewModal</div>);
});

describe('WhatsNewAlert', () => {
  it('should render Whats New Alert Card', () => {
    const { getByTestId } = render(<WhatsNewAlert />);

    expect(getByTestId('whats-new-alert-card')).toBeInTheDocument();
    expect(getByTestId('whats-new-alert-header')).toBeInTheDocument();
    expect(getByTestId('close-whats-new-alert')).toBeInTheDocument();
  });

  it('should close the alert when the close button is clicked', () => {
    const { getByTestId, queryByTestId } = render(<WhatsNewAlert />);

    fireEvent.click(getByTestId('close-whats-new-alert'));

    expect(queryByTestId('whats-new-alert-card')).not.toBeInTheDocument();
  });

  it('should open the modal when the alert card is clicked', async () => {
    const { getByTestId } = render(<WhatsNewAlert />);
    await act(async () => {
      fireEvent.click(getByTestId('whats-new-alert-card'));
    });

    expect(getByTestId('whats-new-dialog')).toBeInTheDocument();
  });

  it('should not render the alert when the user is not on the home page', () => {
    (useCustomLocation as jest.Mock).mockImplementation(() => ({
      pathname: '/',
    }));

    const { queryByTestId } = render(<WhatsNewAlert />);

    expect(queryByTestId('whats-new-alert-card')).not.toBeInTheDocument();
  });

  it('should not render the alert when the user is not a first-time user', () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isFirstTimeUser: false,
    }));

    const { queryByTestId, container } = render(<WhatsNewAlert />);
    screen.debug(container);

    expect(queryByTestId('whats-new-alert-card')).not.toBeInTheDocument();
  });
});

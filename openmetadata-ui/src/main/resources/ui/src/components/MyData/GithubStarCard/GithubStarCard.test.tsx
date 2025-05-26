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
import { TWO_MINUTE_IN_MILLISECOND } from '../../../constants/constants';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import GithubStarCard from './GithubStarCard.component';

const mockLinkButton = jest.fn();

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: '/my-data' }));
});

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, ...rest }) => (
    <a {...rest} onClick={mockLinkButton}>
      {children}
    </a>
  )),
}));

jest.mock('../../../utils/WhatsNewModal.util', () => ({
  getReleaseVersionExpiry: jest.fn().mockImplementation(() => new Date()),
}));

jest.mock('../../../rest/commonAPI', () => ({
  getRepositoryData: jest.fn().mockImplementation(() =>
    Promise.resolve({
      stargazers_count: 10,
    })
  ),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: {
      name: 'admin',
    },
  })),
}));

jest.useFakeTimers();

describe('GithubStarCard', () => {
  it('should render GithubStarCard', async () => {
    render(<GithubStarCard />);
    jest.advanceTimersByTime(TWO_MINUTE_IN_MILLISECOND);

    expect(
      await screen.findByTestId('github-star-popup-card')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.star-on-github-description')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('close-github-star-popup-card')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.star' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });

  it('check redirect buttons', async () => {
    render(<GithubStarCard />);
    jest.advanceTimersByTime(TWO_MINUTE_IN_MILLISECOND);

    const starTextButton = await screen.findByRole('button', {
      name: 'label.star',
    });

    fireEvent.click(starTextButton);

    const countButton = screen.getByRole('button', { name: '10' });

    fireEvent.click(countButton);

    expect(mockLinkButton).toHaveBeenCalledTimes(2);
  });

  it('should close the alert when the close button is clicked', async () => {
    render(<GithubStarCard />);
    jest.advanceTimersByTime(TWO_MINUTE_IN_MILLISECOND);

    fireEvent.click(await screen.findByTestId('close-github-star-popup-card'));

    expect(
      screen.queryByTestId('github-star-popup-card')
    ).not.toBeInTheDocument();
  });

  it('should not render card if not my-data page', async () => {
    (useCustomLocation as jest.Mock).mockImplementation(() => ({
      pathname: '/',
    }));

    render(<GithubStarCard />);
    jest.advanceTimersByTime(TWO_MINUTE_IN_MILLISECOND);

    expect(
      screen.queryByTestId('github-star-popup-card')
    ).not.toBeInTheDocument();
  });
});

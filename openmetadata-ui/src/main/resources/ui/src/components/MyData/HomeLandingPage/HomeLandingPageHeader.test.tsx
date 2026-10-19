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

import { render, screen } from '@testing-library/react';
import HomeLandingPageHeader from './HomeLandingPageHeader';

let mockCurrentUser: { name: string; displayName?: string } | undefined = {
  displayName: 'dale kim',
  name: 'dale.kim',
};

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn(() => <span data-testid="profile-picture" />)
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { user?: string }) =>
      options?.user ? `${key}:${options.user}` : key,
  }),
}));

describe('HomeLandingPageHeader', () => {
  beforeEach(() => {
    mockCurrentUser = { displayName: 'dale kim', name: 'dale.kim' };
  });

  it('greets the signed-in user by name, with their avatar', () => {
    render(<HomeLandingPageHeader />);

    expect(screen.getByTestId('home-landing-page-header')).toHaveTextContent(
      'message.hi-user:Dale Kim'
    );
    expect(screen.getByTestId('profile-picture')).toBeInTheDocument();
    expect(
      screen.getByText('message.home-landing-page-subtitle')
    ).toBeInTheDocument();
  });

  // The wash itself is an inline `linear-gradient`, which jsdom drops; what it
  // can see is the header leaving its default gradient for the tinted one.
  it("swaps the default gradient for the persona's Header Theme colour", () => {
    render(<HomeLandingPageHeader headerColor="#123456" />);

    expect(
      screen.getByTestId('home-landing-page-header').className
    ).not.toContain('tw:bg-[linear-gradient');
  });

  // A legacy gradient value is the old default, not a chosen colour.
  it('keeps the default gradient when no plain colour is saved', () => {
    render(<HomeLandingPageHeader headerColor="linear-gradient(red, blue)" />);

    expect(screen.getByTestId('home-landing-page-header').className).toContain(
      'tw:bg-[linear-gradient'
    );
  });

  it('falls back to a generic greeting before the user loads', () => {
    mockCurrentUser = undefined;
    render(<HomeLandingPageHeader />);

    expect(screen.getByTestId('home-landing-page-header')).toHaveTextContent(
      'message.hi-user:label.user'
    );
    expect(screen.queryByTestId('profile-picture')).not.toBeInTheDocument();
  });
});

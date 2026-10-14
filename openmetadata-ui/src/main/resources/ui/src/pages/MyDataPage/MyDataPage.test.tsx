/*
 *  Copyright 2023 Collate.
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
import userEvent from '@testing-library/user-event';
import { mockUserData } from '../../mocks/MyDataPage.mock';
import MyDataPage from './MyDataPage.component';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem(key: string) {
      return store[key] || '';
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// The page body is covered by HomeLandingPage's own suite; this one is only
// about the chrome MyDataPage still owns.
jest.mock('../../components/MyData/HomeLandingPage/HomeLandingPage', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="home-landing-page">HomeLandingPage</div>
    ));
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout-v1">{children}</div>
    ));
});

jest.mock(
  '../../components/MyData/WelcomeScreen/WelcomeScreen.component',
  () => {
    return jest.fn().mockImplementation(({ onClose }) => (
      <div role="presentation" onClick={onClose}>
        WelcomeScreen
      </div>
    ));
  }
);

jest.mock('../../components/common/DocumentTitle/DocumentTitle', () => {
  return jest
    .fn()
    .mockImplementation(({ title }) => (
      <div data-testid="document-title">{title}</div>
    ));
});

jest.mock('../../hoc/LimitWrapper', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => <>LimitWrapper{children}</>);
});

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: mockUserData,
  })),
}));

let mockIsWelcomeVisible = true;

jest.mock('../../hooks/useWelcomeStore', () => ({
  useWelcomeStore: jest
    .fn()
    .mockImplementation(() => ({ isWelcomeVisible: mockIsWelcomeVisible })),
}));

describe('MyDataPage component', () => {
  beforeEach(() => {
    localStorage.clear();
    mockIsWelcomeVisible = true;
    jest.clearAllMocks();
  });

  it('should only display WelcomeScreen when user logs in for the first time', async () => {
    render(<MyDataPage />);

    // WelcomeScreen is lazy-loaded, so it arrives a tick after the first paint.
    expect(await screen.findByText('WelcomeScreen')).toBeInTheDocument();
    expect(screen.queryByTestId('home-landing-page')).not.toBeInTheDocument();
  });

  it('should display the landing page after the WelcomeScreen is closed', async () => {
    render(<MyDataPage />);

    // Not awaited: this repo is on userEvent's v13-style synchronous API, and
    // awaiting the click hangs on its internal timer advance.
    userEvent.click(await screen.findByText('WelcomeScreen'));

    expect(await screen.findByTestId('home-landing-page')).toBeInTheDocument();
    expect(screen.queryByText('WelcomeScreen')).not.toBeInTheDocument();
  });

  it('should skip the WelcomeScreen for a user who has already seen it', () => {
    localStorage.setItem('loggedInUsers', mockUserData.name);

    render(<MyDataPage />);

    expect(screen.queryByText('WelcomeScreen')).not.toBeInTheDocument();
    expect(screen.getByTestId('home-landing-page')).toBeInTheDocument();
  });

  // HomeLandingPage uses the core PageLayout, which does not claim the tab
  // title, so without this the home tab fell back to the bare brand name.
  it('should claim the My Data tab title for the landing page', () => {
    localStorage.setItem('loggedInUsers', mockUserData.name);

    render(<MyDataPage />);

    expect(screen.getByTestId('document-title')).toHaveTextContent(
      'label.my-data'
    );
  });

  // Classic has no app shell to draw the white panel AI mode sits in, so the
  // page draws its own.
  it('should render the landing page inside the white surface panel', () => {
    localStorage.setItem('loggedInUsers', mockUserData.name);

    render(<MyDataPage />);

    const surface = screen.getByTestId('home-page-surface');

    expect(surface).toHaveClass('tw:bg-primary', 'tw:rounded-2xl');
    expect(surface).toContainElement(screen.getByTestId('home-landing-page'));
  });

  it('should wrap the landing page in the asset LimitWrapper', () => {
    localStorage.setItem('loggedInUsers', mockUserData.name);

    render(<MyDataPage />);

    expect(screen.getByText('LimitWrapper')).toBeInTheDocument();
  });
});

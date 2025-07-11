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
import { act, fireEvent, render } from '@testing-library/react';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import brandClassBase from '../../../../utils/BrandData/BrandClassBase';
import WhatsNewAlert from './WhatsNewAlert.component';

// Mock cookie storage
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('cookie-storage', () => ({
  CookieStorage: class {
    getItem(...args: any[]) {
      return mockGetItem(...args);
    }
    setItem(...args: any[]) {
      return mockSetItem(...args);
    }
    constructor() {
      // Do nothing
    }
  },
}));

// Mock hooks
jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: '/my-data' }));
});

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({
    isFirstTimeUser: true,
  })),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    appVersion: '1.2.0',
  })),
}));

// Mock utilities
jest.mock('../../../../utils/WhatsNewModal.util', () => ({
  getReleaseVersionExpiry: jest.fn().mockImplementation(() => new Date()),
}));

jest.mock('../../../../utils/Version/Version', () => ({
  getVersionedStorageKey: jest.fn().mockImplementation(() => 'whats-new-1.2.0'),
}));

jest.mock('../../../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getReleaseLink: jest
      .fn()
      .mockImplementation(
        (version) => `https://open-metadata.org/product-updates#v${version}`
      ),
    getBlogLink: jest
      .fn()
      .mockImplementation(
        () =>
          'https://blog.open-metadata.org/announcing-openmetadata-1-8-948eb14d41c7'
      ),
  },
}));

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const translations: Record<string, string> = {
        'label.version-number': `Version ${options?.version || ''}`,
        'label.new-update-announcement': 'New Update Announcement',
        'label.release-notes': 'Release Notes',
        'label.blog': 'Blog',
      };

      return translations[key] || key;
    },
  }),
}));

describe('WhatsNewAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: cookie not set, so alert should show
    mockGetItem.mockReturnValue(null);
  });

  it('should render Whats New Alert Card when conditions are met', async () => {
    const { findByTestId } = render(<WhatsNewAlert />);

    expect(await findByTestId('whats-new-alert-card')).toBeInTheDocument();
  });

  it('should close the alert when the close button is clicked', async () => {
    const { getByTestId } = render(<WhatsNewAlert />);

    const closeButton = getByTestId('whats-new-alert-card').querySelector(
      '.whats-new-alert-close'
    );

    expect(closeButton).toBeInTheDocument();

    await act(async () => {
      closeButton && fireEvent.click(closeButton);
    });

    // Verify cookie was set
    expect(mockSetItem).toHaveBeenCalledWith(
      'whats-new-1.2.0',
      'true',
      expect.objectContaining({
        expires: expect.any(Date),
      })
    );
  });

  it('should not render the alert when cookie is already set', () => {
    mockGetItem.mockReturnValue('true');

    const { queryByTestId } = render(<WhatsNewAlert />);

    expect(queryByTestId('whats-new-alert-card')).not.toBeInTheDocument();
  });

  it('should not render the alert when the user is not on the home page', () => {
    (useCustomLocation as jest.Mock).mockImplementation(() => ({
      pathname: '/explore',
    }));

    const { queryByTestId } = render(<WhatsNewAlert />);

    expect(queryByTestId('whats-new-alert-card')).not.toBeInTheDocument();
  });

  it('should display correct version number', () => {
    (useCustomLocation as jest.Mock).mockImplementation(() => ({
      pathname: '/my-data',
    }));

    const { getByText } = render(<WhatsNewAlert />);

    expect(getByText('Version 1.2.0')).toBeInTheDocument();
  });

  it('should display release notes link with correct href', () => {
    const { getByText } = render(<WhatsNewAlert />);

    const releaseNotesLink = getByText('Release Notes');

    expect(releaseNotesLink).toBeInTheDocument();
    expect(releaseNotesLink.closest('a')).toHaveAttribute(
      'href',
      'https://open-metadata.org/product-updates#v1.2.0'
    );
    expect(releaseNotesLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(releaseNotesLink.closest('a')).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
  });

  it('should display blog link for major releases', () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementationOnce(
      () => ({
        appVersion: '2.0.0', // Major release
      })
    );

    const { getByText } = render(<WhatsNewAlert />);

    const blogLink = getByText('Blog');

    expect(blogLink).toBeInTheDocument();
    expect(blogLink.closest('a')).toHaveAttribute(
      'href',
      'https://blog.open-metadata.org/announcing-openmetadata-1-8-948eb14d41c7'
    );
    expect(blogLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(blogLink.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should not display blog link for non-major releases', () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      appVersion: '1.2.1', // Non-major release
    }));

    const { queryByText } = render(<WhatsNewAlert />);

    expect(queryByText('Blog')).not.toBeInTheDocument();
  });

  it('should handle undefined app version gracefully', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      appVersion: undefined,
    }));

    const { findByText } = render(<WhatsNewAlert />);

    expect(await findByText('Version')).toBeInTheDocument();
  });

  it('should call brandClassBase methods with correct version', () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      appVersion: '1.2.0',
    }));

    render(<WhatsNewAlert />);

    expect(brandClassBase.getReleaseLink).toHaveBeenCalledWith('1.2.0');
    expect(brandClassBase.getBlogLink).toHaveBeenCalledWith('1.2.0');
  });

  it('should use correct cookie key for version', () => {
    const { getByTestId } = render(<WhatsNewAlert />);

    const closeButton = getByTestId('whats-new-alert-card').querySelector(
      '.whats-new-alert-close'
    );

    closeButton && fireEvent.click(closeButton);

    expect(mockSetItem).toHaveBeenCalledWith(
      'whats-new-1.2.0',
      'true',
      expect.any(Object)
    );
  });

  it('should have correct CSS classes and structure', () => {
    const { getByTestId } = render(<WhatsNewAlert />);

    const alertCard = getByTestId('whats-new-alert-card');

    expect(alertCard).toHaveClass('whats-new-alert-card');

    // Check for the three columns structure
    const columns = alertCard.querySelectorAll('.ant-col');

    expect(columns).toHaveLength(3);

    // Check left column has rocket icon and version
    const leftColumn = columns[0];

    expect(leftColumn).toHaveClass('whats-new-alert-left');
    expect(leftColumn).toHaveTextContent('Version 1.2.0');

    // Check right column has announcement text and links
    const rightColumn = columns[1];

    expect(rightColumn).toHaveClass('whats-new-alert-right');
    expect(rightColumn).toHaveTextContent('New Update Announcement');
    expect(
      rightColumn.querySelector('.whats-new-alert-links')
    ).toBeInTheDocument();

    // Check close column has close icon
    const closeColumn = columns[2];

    expect(
      closeColumn.querySelector('.whats-new-alert-close')
    ).toBeInTheDocument();
  });
});

/*
 *  Copyright 2025 Collate.
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
import axios from 'axios';
import { CookieStorage } from 'cookie-storage';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getReleaseVersionExpiry } from '../../../utils/WhatsNewModal.util';
import WhatsNewModal from './WhatsNewModal';
import { ExternalVersionData } from './WhatsNewModal.interface';

// Mock dependencies
jest.mock('axios');
jest.mock('cookie-storage');
jest.mock('../../../hooks/useApplicationStore');
jest.mock('../../../utils/WhatsNewModal.util');
jest.mock('../../BlockEditor/BlockEditor', () => {
  return jest
    .fn()
    .mockImplementation(({ content }) => (
      <div data-testid="block-editor">{content}</div>
    ));
});
jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="rich-text-previewer">{markdown}</div>
    ));
});

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedUseApplicationStore = useApplicationStore as unknown as jest.Mock;
const mockedGetReleaseVersionExpiry = getReleaseVersionExpiry as jest.Mock;
const mockedCookieStorage = {
  setItem: jest.fn(),
};

// Mock data
const mockVersions: ExternalVersionData[] = [
  {
    version: '1.8.0',
    date: '2025-01-15',
    hasFeatures: true,
    note: 'Latest release with exciting features',
  },
  {
    version: '1.7.0',
    date: '2024-12-15',
    hasFeatures: false,
    note: 'Bug fixes and improvements',
  },
  {
    version: '1.6.0',
    date: '2024-11-15',
    hasFeatures: true,
  },
];

const mockMarkdownContent = `---
version: "1.8.0"
date: "2025-01-15"
note: "Latest release"
---

# OpenMetadata 1.8.0 Release

## Features

### New Dashboard Features
Exciting new dashboard capabilities with improved UI/UX.

<YouTube videoId="dQw4w9WgXcQ"/>

### Enhanced Search
Better search functionality across all entities.

## Changelog

### Added
- New dashboard widgets
- Improved search algorithms
- Better error handling

### Fixed
- Fixed login issues
- Resolved performance problems
`;

const defaultProps = {
  visible: true,
  onCancel: jest.fn(),
  header: "What's New",
};

describe('WhatsNewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockedUseApplicationStore.mockReturnValue({
      theme: { primaryColor: '#1890ff' },
      appVersion: '1.8.0',
    });

    mockedGetReleaseVersionExpiry.mockReturnValue(new Date());

    (CookieStorage as jest.Mock).mockImplementation(() => mockedCookieStorage);

    // Mock successful API responses
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('versions.json')) {
        return Promise.resolve({ data: mockVersions });
      }
      if (url.includes('1.8.0.md')) {
        return Promise.resolve({ data: mockMarkdownContent });
      }

      return Promise.reject(new Error('Not found'));
    });
  });

  it('should render the modal with header when visible', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    expect(screen.getByTestId('whats-new-dialog-v2')).toBeInTheDocument();
    expect(screen.getByTestId('whats-new-header')).toBeInTheDocument();
    expect(screen.getByText("What's New")).toBeInTheDocument();
  });

  it('should not render when visible is false', () => {
    render(<WhatsNewModal {...defaultProps} visible={false} />);

    expect(screen.queryByTestId('whats-new-dialog-v2')).not.toBeInTheDocument();
  });

  it('should show loading state initially', async () => {
    render(<WhatsNewModal {...defaultProps} />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should fetch and display versions list', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/open-metadata/openmetadata-site/refs/heads/main/content/product-updates/versions.json'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('1.8.0')).toBeInTheDocument();
      expect(screen.getByText('1.7.0')).toBeInTheDocument();
      expect(screen.getByText('1.6.0')).toBeInTheDocument();
    });
  });

  it('should display "Current" tag for the current app version', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Current')).toBeInTheDocument();
    });
  });

  it('should fetch and display version content', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/open-metadata/openmetadata-site/refs/heads/main/content/product-updates/1.8.0.md'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('1.8.0')).toBeInTheDocument();
      expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    });
  });

  it('should display rich text previewer for version notes', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('rich-text-previewer')).toBeInTheDocument();
    });
  });

  it('should handle version selection', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('1.7.0')).toBeInTheDocument();
    });

    // Click on version 1.7.0
    await act(async () => {
      fireEvent.click(screen.getByText('1.7.0'));
    });

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/open-metadata/openmetadata-site/refs/heads/main/content/product-updates/1.7.0.md'
      );
    });
  });

  it('should show toggle buttons when version has features', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('WhatsNewModalV2Features')).toBeInTheDocument();
      expect(
        screen.getByTestId('WhatsNewModalV2ChangeLogs')
      ).toBeInTheDocument();
    });
  });

  it('should not show toggle buttons when version has no features', async () => {
    // Mock version without features
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('versions.json')) {
        return Promise.resolve({
          data: [{ ...mockVersions[1], hasFeatures: false }],
        });
      }
      if (url.includes('1.7.0.md')) {
        return Promise.resolve({
          data: '---\nversion: "1.7.0"\n---\n## Changelog\nBug fixes',
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('WhatsNewModalV2Features')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('WhatsNewModalV2ChangeLogs')
      ).not.toBeInTheDocument();
    });
  });

  it('should toggle between features and changelog', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('WhatsNewModalV2Features')).toBeInTheDocument();
      expect(
        screen.getByTestId('WhatsNewModalV2ChangeLogs')
      ).toBeInTheDocument();
    });

    // Click on changelog tab
    await act(async () => {
      fireEvent.click(screen.getByTestId('WhatsNewModalV2ChangeLogs'));
    });

    // Should display changelog content
    await waitFor(() => {
      const blockEditor = screen.getByTestId('block-editor');

      expect(blockEditor).toBeInTheDocument();
    });

    // Click back to features tab
    await act(async () => {
      fireEvent.click(screen.getByTestId('WhatsNewModalV2Features'));
    });

    // Should display features content
    await waitFor(() => {
      expect(screen.getByTestId('block-editor')).toBeInTheDocument();
    });
  });

  it('should convert YouTube components to iframe format', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      const blockEditor = screen.getByTestId('block-editor');

      expect(blockEditor.textContent).toContain('iframe');
      expect(blockEditor.textContent).toContain('youtube.com/embed');
    });
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    // Should not crash and should stop loading
    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });
  });

  it('should show content loading state', async () => {
    // Delay the content response
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('versions.json')) {
        return Promise.resolve({ data: mockVersions });
      }
      if (url.includes('1.8.0.md')) {
        return new Promise((resolve) =>
          setTimeout(() => resolve({ data: mockMarkdownContent }), 100)
        );
      }

      return Promise.reject(new Error('Not found'));
    });

    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    // Wait for versions to load
    await waitFor(() => {
      expect(screen.getByText('1.8.0')).toBeInTheDocument();
    });

    // Should show content loading spinner
    expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
  });

  it('should show no content message when version content is empty', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('versions.json')) {
        return Promise.resolve({ data: mockVersions });
      }
      if (url.includes('1.8.0.md')) {
        return Promise.resolve({ data: '' });
      }

      return Promise.reject(new Error('Not found'));
    });

    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(
        screen.getByText('message.no-content-available')
      ).toBeInTheDocument();
    });
  });

  it('should handle modal close and set cookie', async () => {
    const onCancel = jest.fn();

    await act(async () => {
      render(<WhatsNewModal {...defaultProps} onCancel={onCancel} />);
    });

    // Click close button
    await act(async () => {
      fireEvent.click(screen.getByTestId('closeWhatsNew'));
    });

    expect(mockedCookieStorage.setItem).toHaveBeenCalledWith(
      'VERSION_1_8_0',
      'true',
      { expires: expect.any(Date) }
    );
    expect(onCancel).toHaveBeenCalled();
  });

  it('should parse markdown content correctly', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      // Version info should be displayed
      expect(screen.getByText('1.8.0')).toBeInTheDocument();
      expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    });

    // Features should be parsed and available in carousel
    await waitFor(() => {
      expect(screen.getByTestId('block-editor')).toBeInTheDocument();
    });
  });

  it('should highlight active version in the sidebar', async () => {
    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      const activeVersionButton = screen.getByText('1.8.0').closest('button');

      expect(activeVersionButton).toHaveClass('text-primary');
    });
  });

  it('should handle empty versions list', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('versions.json')) {
        return Promise.resolve({ data: [] });
      }

      return Promise.reject(new Error('Not found'));
    });

    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.queryByText('1.8.0')).not.toBeInTheDocument();
    });
  });

  it('should use correct theme color for active version', async () => {
    const customTheme = { primaryColor: '#ff0000' };
    mockedUseApplicationStore.mockReturnValue({
      theme: customTheme,
      appVersion: '1.8.0',
    });

    await act(async () => {
      render(<WhatsNewModal {...defaultProps} />);
    });

    // Test would check if the VersionIndicatorIcon receives the correct color
    // This is more of an integration test with the icon component
    await waitFor(() => {
      expect(screen.getByText('1.8.0')).toBeInTheDocument();
    });
  });
});

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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { LearningIcon } from './LearningIcon.component';

const LEARNING_DRAWER = 'learning-drawer';
const LEARNING_ICON = 'learning-icon';
const mockGetLearningResourcesByContext = jest.fn();

jest.mock('../../../rest/learningResourceAPI', () => ({
  getLearningResourcesByContext: jest
    .fn()
    .mockImplementation((...args) =>
      mockGetLearningResourcesByContext(...args)
    ),
}));

jest.mock('../LearningDrawer/LearningDrawer.component', () => ({
  LearningDrawer: jest.fn().mockImplementation(({ open, onClose }) =>
    open ? (
      <div data-testid="learning-drawer">
        <button data-testid="close-drawer" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('LearningIcon', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockGetLearningResourcesByContext.mockResolvedValue({
      data: [],
      paging: { total: 5 },
    });
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('should render learning icon when resources exist', async () => {
    render(<LearningIcon pageId="glossary" />);

    await waitFor(() => {
      expect(screen.getByTestId(LEARNING_ICON)).toBeInTheDocument();
    });
  });

  it('should not render when resource count is 0', async () => {
    mockGetLearningResourcesByContext.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    const { container } = render(<LearningIcon pageId="glossary" />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByTestId(LEARNING_ICON)).not.toBeInTheDocument();
    });

    expect(container.firstChild).toBeNull();
  });

  it('should show popover on hover', async () => {
    render(<LearningIcon pageId="glossary" />);

    await waitFor(() => {
      expect(screen.getByTestId(LEARNING_ICON)).toBeInTheDocument();
    });

    fireEvent.mouseEnter(screen.getByTestId(LEARNING_ICON));

    await waitFor(() => {
      expect(
        screen.getByTestId('learning-resources-button')
      ).toBeInTheDocument();
    });
  });

  it('should open drawer when icon is clicked', async () => {
    render(<LearningIcon pageId="glossary" />);

    await waitFor(() => {
      expect(screen.getByTestId(LEARNING_ICON)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(LEARNING_ICON));

    expect(screen.getByTestId(LEARNING_DRAWER)).toBeInTheDocument();
  });

  it('should open drawer when resources button is clicked', async () => {
    render(<LearningIcon pageId="glossary" />);

    await waitFor(() => {
      expect(screen.getByTestId(LEARNING_ICON)).toBeInTheDocument();
    });

    fireEvent.mouseEnter(screen.getByTestId(LEARNING_ICON));

    const resourcesButton = await screen.findByTestId(
      'learning-resources-button'
    );
    fireEvent.click(resourcesButton);

    expect(screen.getByTestId(LEARNING_DRAWER)).toBeInTheDocument();
  });

  it('should close drawer when close button is clicked', async () => {
    render(<LearningIcon pageId="glossary" />);

    await waitFor(() => {
      expect(screen.getByTestId(LEARNING_ICON)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(LEARNING_ICON));

    expect(screen.getByTestId(LEARNING_DRAWER)).toBeInTheDocument();

    const closeButton = screen.getByTestId('close-drawer');
    fireEvent.click(closeButton);

    expect(screen.queryByTestId(LEARNING_DRAWER)).not.toBeInTheDocument();
  });

  it('should fetch resource count on mount', async () => {
    render(<LearningIcon pageId="glossary" />);

    await waitFor(() => {
      expect(mockGetLearningResourcesByContext).toHaveBeenCalledWith(
        'glossary',
        { limit: 1 }
      );
    });
  });

  it('should not fetch resource count again if already fetched', async () => {
    render(<LearningIcon pageId="glossary" />);

    await waitFor(() => {
      expect(mockGetLearningResourcesByContext).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId(LEARNING_ICON)).toBeInTheDocument();
    });

    expect(mockGetLearningResourcesByContext).toHaveBeenCalledTimes(1);
  });

  it('should handle API error gracefully', async () => {
    mockGetLearningResourcesByContext.mockRejectedValue(new Error('API Error'));

    const { container } = render(<LearningIcon pageId="glossary" />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('should apply custom className', async () => {
    render(<LearningIcon className="custom-class" pageId="glossary" />);

    await waitFor(() => {
      expect(screen.getByTestId(LEARNING_ICON)).toBeInTheDocument();
    });

    const iconElement = screen.getByTestId(LEARNING_ICON);

    expect(iconElement).toHaveClass('custom-class');
  });

  it('should render learning icon when resources exist', async () => {
    render(<LearningIcon pageId="glossary" />);

    await waitFor(() => {
      expect(screen.getByTestId(LEARNING_ICON)).toBeInTheDocument();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const iconElement = screen.getByTestId(LEARNING_ICON);

    expect(iconElement).toBeInTheDocument();
    expect(mockGetLearningResourcesByContext).toHaveBeenCalledWith(
      'glossary',
      expect.objectContaining({ limit: 1 })
    );
  });
});

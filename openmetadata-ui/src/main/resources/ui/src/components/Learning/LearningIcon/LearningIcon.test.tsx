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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { LearningIcon } from './LearningIcon.component';

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
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.count) {
        return `${key} (${params.count})`;
      }

      return key;
    },
  }),
}));

describe('LearningIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLearningResourcesByContext.mockResolvedValue({
      data: [],
      paging: { total: 5 },
    });
  });

  it('should render learning icon button', () => {
    render(<LearningIcon pageId="glossary" />);

    expect(screen.getByTestId('learning-icon-glossary')).toBeInTheDocument();
  });

  it('should render with correct data-testid based on pageId', () => {
    render(<LearningIcon pageId="domain" />);

    expect(screen.getByTestId('learning-icon-domain')).toBeInTheDocument();
  });

  it('should render label when provided', () => {
    render(<LearningIcon label="Learn More" pageId="glossary" />);

    expect(screen.getByText('Learn More')).toBeInTheDocument();
  });

  it('should open drawer when clicked', async () => {
    render(<LearningIcon pageId="glossary" />);

    const button = screen.getByTestId('learning-icon-glossary');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByTestId('learning-drawer')).toBeInTheDocument();
  });

  it('should close drawer when close button is clicked', async () => {
    render(<LearningIcon pageId="glossary" />);

    const button = screen.getByTestId('learning-icon-glossary');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByTestId('learning-drawer')).toBeInTheDocument();

    const closeButton = screen.getByTestId('close-drawer');

    await act(async () => {
      fireEvent.click(closeButton);
    });

    expect(screen.queryByTestId('learning-drawer')).not.toBeInTheDocument();
  });

  it('should fetch resource count on mouse enter', async () => {
    render(<LearningIcon pageId="glossary" />);

    const button = screen.getByTestId('learning-icon-glossary');

    await act(async () => {
      fireEvent.mouseEnter(button);
    });

    await waitFor(() => {
      expect(mockGetLearningResourcesByContext).toHaveBeenCalledWith(
        'glossary',
        { limit: 1 }
      );
    });
  });

  it('should not fetch resource count again if already fetched', async () => {
    render(<LearningIcon pageId="glossary" />);

    const button = screen.getByTestId('learning-icon-glossary');

    await act(async () => {
      fireEvent.mouseEnter(button);
    });

    await waitFor(() => {
      expect(mockGetLearningResourcesByContext).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      fireEvent.mouseEnter(button);
    });

    // Should still be 1 since count is cached
    expect(mockGetLearningResourcesByContext).toHaveBeenCalledTimes(1);
  });

  it('should handle API error gracefully', async () => {
    mockGetLearningResourcesByContext.mockRejectedValueOnce(
      new Error('API Error')
    );

    render(<LearningIcon pageId="glossary" />);

    const button = screen.getByTestId('learning-icon-glossary');

    await act(async () => {
      fireEvent.mouseEnter(button);
    });

    // Should not throw error
    expect(screen.getByTestId('learning-icon-glossary')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<LearningIcon className="custom-class" pageId="glossary" />);

    const button = screen.getByTestId('learning-icon-glossary');

    expect(button).toHaveClass('custom-class');
  });

  it('should render with small size', () => {
    render(<LearningIcon pageId="glossary" size="small" />);

    const button = screen.getByTestId('learning-icon-glossary');

    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('learning-icon');
  });

  it('should render with large size', () => {
    render(<LearningIcon pageId="glossary" size="large" />);

    const button = screen.getByTestId('learning-icon-glossary');

    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('learning-icon');
  });
});

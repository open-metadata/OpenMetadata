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
import { fireEvent, render, screen } from '@testing-library/react';
import LineageSection from './LineageSection';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        if (key === 'label.-with-colon') {
          return `${options.text}:`;
        }

        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

jest.mock('../../../assets/svg/lineage-upstream-icon.svg', () => ({
  ReactComponent: () => <div data-testid="upstream-icon">Upstream</div>,
}));

jest.mock('../../../assets/svg/lineage-downstream-icon.svg', () => ({
  ReactComponent: () => <div data-testid="downstream-icon">Downstream</div>,
}));

jest.mock('../Loader/Loader', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loading...</div>);
});

describe('LineageSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering - Loading State', () => {
    it('renders title and loader when isLoading is true', () => {
      render(
        <LineageSection downstreamCount={0} isLoading upstreamCount={0} />
      );

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('does not render upstream/downstream counts when loading', () => {
      render(
        <LineageSection downstreamCount={5} isLoading upstreamCount={10} />
      );

      expect(screen.queryByTestId('upstream-lineage')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('downstream-lineage')
      ).not.toBeInTheDocument();
    });
  });

  describe('Rendering - No Lineage', () => {
    it('renders "no lineage available" message when both counts are zero', () => {
      render(<LineageSection downstreamCount={0} upstreamCount={0} />);

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
      expect(
        screen.getByText('message.no-lineage-available')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('upstream-lineage')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('downstream-lineage')
      ).not.toBeInTheDocument();
    });
  });

  describe('Rendering - With Lineage Data', () => {
    it('renders upstream and downstream counts when both are non-zero', () => {
      render(<LineageSection downstreamCount={12} upstreamCount={22} />);

      expect(screen.getByText('label.lineage')).toBeInTheDocument();

      const upstreamSection = screen.getByTestId('upstream-lineage');
      const downstreamSection = screen.getByTestId('downstream-lineage');

      expect(upstreamSection).toBeInTheDocument();
      expect(downstreamSection).toBeInTheDocument();

      expect(screen.getByText('label.upstream:')).toBeInTheDocument();
      expect(screen.getByText('22')).toBeInTheDocument();

      expect(screen.getByText('label.downstream:')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('renders divider between upstream and downstream sections', () => {
      const { container } = render(
        <LineageSection downstreamCount={5} upstreamCount={10} />
      );

      const divider = container.querySelector('.MuiDivider-root');

      expect(divider).toBeInTheDocument();
    });

    it('renders when only upstream count is non-zero', () => {
      render(<LineageSection downstreamCount={0} upstreamCount={15} />);

      expect(screen.getByTestId('upstream-lineage')).toBeInTheDocument();
      expect(screen.getByTestId('downstream-lineage')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders when only downstream count is non-zero', () => {
      render(<LineageSection downstreamCount={8} upstreamCount={0} />);

      expect(screen.getByTestId('upstream-lineage')).toBeInTheDocument();
      expect(screen.getByTestId('downstream-lineage')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  describe('Click Interactions', () => {
    it('calls onLineageClick when upstream section is clicked', () => {
      const onLineageClick = jest.fn();

      render(
        <LineageSection
          downstreamCount={5}
          upstreamCount={10}
          onLineageClick={onLineageClick}
        />
      );

      const upstreamSection = screen.getByTestId('upstream-lineage');
      fireEvent.click(upstreamSection);

      expect(onLineageClick).toHaveBeenCalledTimes(1);
    });

    it('calls onLineageClick when downstream section is clicked', () => {
      const onLineageClick = jest.fn();

      render(
        <LineageSection
          downstreamCount={5}
          upstreamCount={10}
          onLineageClick={onLineageClick}
        />
      );

      const downstreamSection = screen.getByTestId('downstream-lineage');
      fireEvent.click(downstreamSection);

      expect(onLineageClick).toHaveBeenCalledTimes(1);
    });

    it('does not throw error when clicked without onLineageClick handler', () => {
      render(<LineageSection downstreamCount={5} upstreamCount={10} />);

      const upstreamSection = screen.getByTestId('upstream-lineage');

      expect(() => fireEvent.click(upstreamSection)).not.toThrow();
    });
  });

  describe('CSS Structure', () => {
    it('verifies clickable sections have proper data-testid attributes', () => {
      render(<LineageSection downstreamCount={5} upstreamCount={10} />);

      const upstreamSection = screen.getByTestId('upstream-lineage');
      const downstreamSection = screen.getByTestId('downstream-lineage');

      expect(upstreamSection).toBeInTheDocument();
      expect(downstreamSection).toBeInTheDocument();
    });

    it('verifies count elements have proper data-testid attributes', () => {
      render(<LineageSection downstreamCount={5} upstreamCount={10} />);

      const upstreamCount = screen.getByTestId('upstream-count');
      const downstreamCount = screen.getByTestId('downstream-count');

      expect(upstreamCount).toBeInTheDocument();
      expect(downstreamCount).toBeInTheDocument();
      expect(upstreamCount).toHaveTextContent('10');
      expect(downstreamCount).toHaveTextContent('5');
    });
  });

  describe('Edge Cases - State Transitions', () => {
    it('transitions from loading to no lineage correctly', () => {
      const { rerender } = render(
        <LineageSection downstreamCount={0} isLoading upstreamCount={0} />
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(
        screen.queryByText('message.no-lineage-available')
      ).not.toBeInTheDocument();

      rerender(
        <LineageSection
          downstreamCount={0}
          isLoading={false}
          upstreamCount={0}
        />
      );

      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      expect(
        screen.getByText('message.no-lineage-available')
      ).toBeInTheDocument();
    });

    it('transitions from loading to with data correctly', () => {
      const { rerender } = render(
        <LineageSection downstreamCount={0} isLoading upstreamCount={0} />
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();

      rerender(
        <LineageSection
          downstreamCount={5}
          isLoading={false}
          upstreamCount={10}
        />
      );

      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      expect(screen.getByTestId('upstream-lineage')).toBeInTheDocument();
      expect(screen.getByTestId('downstream-lineage')).toBeInTheDocument();
    });

    it('transitions from data to loading correctly', () => {
      const { rerender } = render(
        <LineageSection downstreamCount={5} isLoading={false} upstreamCount={10} />
      );

      expect(screen.getByTestId('upstream-lineage')).toBeInTheDocument();
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();

      rerender(
        <LineageSection downstreamCount={5} isLoading upstreamCount={10} />
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(
        screen.queryByTestId('upstream-lineage')
      ).not.toBeInTheDocument();
    });

    it('handles loading state with non-zero counts', () => {
      render(
        <LineageSection downstreamCount={10} isLoading upstreamCount={20} />
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(
        screen.queryByTestId('upstream-lineage')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('downstream-lineage')
      ).not.toBeInTheDocument();
    });
  });
});

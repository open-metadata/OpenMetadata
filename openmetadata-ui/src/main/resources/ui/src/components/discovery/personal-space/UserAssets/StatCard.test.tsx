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
import { MemoryRouter } from 'react-router-dom';
import StatCard from './StatCard';

const renderCard = (props: Partial<Parameters<typeof StatCard>[0]> = {}) =>
  render(
    <MemoryRouter>
      <StatCard
        icon={<span />}
        label="Assets Owned"
        testId="stat"
        value={42}
        {...props}
      />
    </MemoryRouter>
  );

describe('StatCard', () => {
  it('renders value, label, subtitle and breakdown', () => {
    renderCard({
      breakdown: [
        { label: 'Tables', value: 3 },
        { label: 'Dashboards', value: 1 },
      ],
      subtitle: '0 Require Attention',
    });

    expect(screen.getByTestId('stat-value')).toHaveTextContent('42');
    expect(screen.getByText('Assets Owned')).toBeInTheDocument();
    expect(screen.getByTestId('stat-subtitle')).toHaveTextContent(
      '0 Require Attention'
    );
    expect(screen.getByTestId('stat-breakdown')).toHaveTextContent(
      '3Tables1Dashboards'
    );
  });

  it('truncates a long subtitle instead of overflowing', () => {
    renderCard({ subtitle: 'A long subtitle' });

    expect(screen.getByTestId('stat-subtitle')).toHaveClass(
      'tw:truncate',
      'tw:max-w-full'
    );
  });

  it('marks only the selected tile as selected', () => {
    const { unmount } = renderCard({ isSelected: true });

    expect(screen.getByTestId('stat')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('stat')).toHaveClass('tw:border-brand');

    unmount();
    renderCard();

    expect(screen.getByTestId('stat')).toHaveAttribute(
      'data-selected',
      'false'
    );
    expect(screen.getByTestId('stat')).not.toHaveClass('tw:border-brand');
  });

  it('links the whole tile when a destination is given', () => {
    renderCard({ to: '/incidents' });

    expect(screen.getByTestId('stat-link')).toHaveAttribute(
      'href',
      '/incidents'
    );
    expect(screen.getByTestId('stat-link')).toHaveAccessibleName(
      'Assets Owned'
    );
  });

  it('shows skeletons instead of the value and subtitle while loading', () => {
    renderCard({ loading: true, subtitle: 'sub' });

    expect(screen.queryByTestId('stat-value')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-subtitle')).not.toBeInTheDocument();
  });
});

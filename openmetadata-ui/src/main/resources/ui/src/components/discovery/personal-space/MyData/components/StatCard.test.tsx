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
import { ReactNode } from 'react';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Divider: () => <hr />,
  FeaturedIcon: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Typography: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

import StatCard from './StatCard';

describe('StatCard', () => {
  it('renders value, label, subtitle and breakdown', () => {
    render(
      <StatCard
        breakdown={[
          { label: 'Tables', value: 3 },
          { label: 'Dashboards', value: 1 },
        ]}
        icon={<span />}
        label="Assets Owned"
        subtitle="0 Require Attention"
        value={42}
      />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Assets Owned')).toBeInTheDocument();
    expect(screen.getByText('0 Require Attention')).toBeInTheDocument();
    expect(screen.getByText('Tables')).toBeInTheDocument();
  });

  it('truncates a long subtitle instead of overflowing', () => {
    render(
      <StatCard
        icon={<span />}
        label="Assets Owned"
        subtitle="A very long subtitle that would otherwise overflow its card"
        value={42}
      />
    );

    const subtitle = screen.getByText(
      'A very long subtitle that would otherwise overflow its card'
    );

    expect(subtitle.className).toContain('truncate');
    expect(subtitle.className).toContain('max-w-full');
  });
});

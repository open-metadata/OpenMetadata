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

import { render, screen } from '@testing-library/react';
import { ChangeSource } from '../../../generated/type/changeSummaryMap';
import DescriptionSourceBadge from './DescriptionSourceBadge';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDate: jest.fn((ts: number) => `date-${ts}`),
  formatDateTime: jest.fn((ts: number) => `formatted-${ts}`),
  getShortRelativeTime: jest.fn((ts: number) => `relative-${ts}`),
}));

jest.mock('../../../assets/svg/ic-ai-suggestion.svg', () => ({
  ReactComponent: () => <div data-testid="ai-suggestion-icon" />,
}));

jest.mock('../../../assets/svg/ic-automated.svg', () => ({
  ReactComponent: () => <div data-testid="automated-icon" />,
}));

jest.mock('../../../assets/svg/ic-propagated.svg', () => ({
  ReactComponent: () => <div data-testid="propagated-icon" />,
}));

jest.mock('../../../assets/svg/ic-check-circle.svg', () => ({
  ReactComponent: () => <div data-testid="check-circle-icon" />,
}));

jest.mock('../PopOverCard/UserPopOverCard', () => ({
  __esModule: true,
  default: ({ displayName }: { displayName: string }) => (
    <span data-testid="user-popover">{displayName}</span>
  ),
}));

jest.mock('antd', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('DescriptionSourceBadge', () => {
  it('should render nothing when changeSummaryEntry is undefined', () => {
    const { container } = render(
      <DescriptionSourceBadge changeSummaryEntry={undefined} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when changeSource is undefined', () => {
    const { container } = render(
      <DescriptionSourceBadge changeSummaryEntry={{ changedBy: 'admin' }} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render authored-by metadata for Manual changeSource', () => {
    render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Manual,
          changedBy: 'admin',
          changedAt: 1700000000000,
        }}
      />
    );

    expect(screen.getByTestId('source-actor')).toHaveTextContent(
      /label\.authored-by.*admin/
    );
    expect(screen.getByTestId('source-timestamp')).toHaveTextContent(
      'relative-1700000000000'
    );
  });

  it('should render AI suggestion icon for Suggested changeSource', () => {
    render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Suggested,
          changedBy: 'admin',
          changedAt: 1700000000000,
        }}
      />
    );

    const badge = screen.getByTestId('ai-suggested-badge');

    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe('OUTPUT');
    expect(screen.queryByText('label.ai')).not.toBeInTheDocument();
  });

  it('should render Automated badge for Automated changeSource', () => {
    render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Automated,
          changedBy: 'bot',
        }}
      />
    );

    const badge = screen.getByTestId('automated-badge');

    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe('OUTPUT');
    expect(screen.queryByText('label.automated')).not.toBeInTheDocument();
  });

  it('should render Propagated badge for Propagated changeSource', () => {
    render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Propagated,
          changedBy: 'lineage',
        }}
      />
    );

    const badge = screen.getByTestId('propagated-badge');

    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe('OUTPUT');
    expect(screen.queryByText('label.propagated')).not.toBeInTheDocument();
  });

  it('should render accepted-by metadata when changedBy is present', () => {
    render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Suggested,
          changedBy: 'John Doe',
          changedAt: 1700000000000,
        }}
      />
    );

    const actor = screen.getByTestId('source-actor');

    expect(actor).toBeInTheDocument();
    expect(actor).toHaveTextContent('John Doe');
  });

  it('should not render accepted-by metadata when changedBy is absent', () => {
    render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Automated,
        }}
      />
    );

    expect(screen.queryByTestId('source-actor')).not.toBeInTheDocument();
  });

  it('should render badge only when metadata is disabled', () => {
    render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Suggested,
          changedBy: 'admin',
          changedAt: 1700000000000,
        }}
        showAcceptedBy={false}
        showTimestamp={false}
      />
    );

    expect(screen.getByTestId('ai-suggested-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('source-actor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('source-timestamp')).not.toBeInTheDocument();
  });

  it('should not render badge for Ingested changeSource', () => {
    const { container } = render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Ingested,
          changedBy: 'ingestion',
        }}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render badge for Derived changeSource', () => {
    const { container } = render(
      <DescriptionSourceBadge
        changeSummaryEntry={{
          changeSource: ChangeSource.Derived,
        }}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

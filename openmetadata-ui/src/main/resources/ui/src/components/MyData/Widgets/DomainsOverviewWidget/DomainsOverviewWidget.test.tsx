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
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  OverviewFilter,
  useDomainOverview,
} from '../../../../hooks/useDomainOverview';
import DomainsOverviewWidget from './DomainsOverviewWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echoes the options, so a test can tell which figures a label carries.
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

jest.mock('../../../../hooks/useDomainOverview', () => ({
  OverviewFilter: { ALL: 'all', EMPTY: 'empty', NO_OWNER: 'noOwner' },
  useDomainOverview: jest.fn(),
}));

let mockPermissions: Record<string, Record<string, boolean>> = {};
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getDomainPath: (fqn: string) => `/domain/${fqn}`,
}));

const DOMAINS = [
  {
    assetCount: 12,
    fullyQualifiedName: 'finance',
    id: 'finance',
    name: 'Finance',
    ownerName: 'Dale Kim',
  },
  {
    assetCount: 0,
    fullyQualifiedName: 'marketing',
    id: 'marketing',
    name: 'Marketing',
    ownerName: undefined,
  },
];

const OVERVIEW = {
  domains: DOMAINS,
  emptyCount: 6,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
  totalCount: 30,
  unownedCount: 4,
};

const renderWidget = (overview: Partial<typeof OVERVIEW> = {}) => {
  (useDomainOverview as jest.Mock).mockReturnValue({
    ...OVERVIEW,
    ...overview,
  });

  return render(<DomainsOverviewWidget widgetKey="KnowledgePanel.Domains-1" />);
};

describe('DomainsOverviewWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('names each domain and pluralises its asset count', () => {
    renderWidget();

    expect(
      screen.getAllByTestId('domain-name').map((node) => node.textContent)
    ).toEqual(['Finance', 'Marketing']);
    expect(screen.getAllByTestId('domain-asset-count')[0]).toHaveTextContent(
      'label.count-asset {"count":12}'
    );
  });

  // "All" was the estate total while "No owner" and "Empty" were counted over
  // the ten rows in hand — three numbers about two different sets.
  it('shows the estate-wide count on each chip', () => {
    renderWidget();

    expect(screen.getByTestId('domains-filter-all-count')).toHaveTextContent(
      '30'
    );
    expect(
      screen.getByTestId('domains-filter-noOwner-count')
    ).toHaveTextContent('4');
    expect(screen.getByTestId('domains-filter-empty-count')).toHaveTextContent(
      '6'
    );
  });

  it('queries the selected bucket instead of filtering the page', () => {
    renderWidget();

    expect(useDomainOverview).toHaveBeenLastCalledWith(OverviewFilter.ALL);

    fireEvent.click(screen.getByTestId('domains-filter-noOwner'));

    expect(useDomainOverview).toHaveBeenLastCalledWith(OverviewFilter.NO_OWNER);
  });

  // Exposed as a radiogroup by react-aria, which also gives it the arrow-key
  // movement a hand-rolled `role="radio"` promised and did not deliver.
  it('exposes the chips as one labelled single-choice group', () => {
    renderWidget();

    const group = screen.getByRole('radiogroup');

    expect(group).toHaveAccessibleName('label.domain-plural');
    expect(screen.getByTestId('domains-filter-all')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('builds the summary from one interpolated key', () => {
    renderWidget();

    expect(
      screen.getByText(
        'message.count-domains-count-unowned {"count":30,"unowned":4}'
      )
    ).toBeInTheDocument();
  });

  it('reports what is left of the selected bucket, not of the page', () => {
    renderWidget();

    expect(
      screen.getByText('message.count-more-domains {"count":28}')
    ).toBeInTheDocument();
  });

  it('shows an error body, not the empty-state copy, when the fetch fails', () => {
    const refetch = jest.fn();
    renderWidget({ domains: [], isError: true, refetch, totalCount: 0 });

    expect(screen.getByTestId('topic-error-domains')).toBeInTheDocument();
    expect(screen.queryByText('message.no-domains-yet')).toBeNull();
    expect(screen.queryByTestId('topic-status-domains')).toBeNull();

    fireEvent.click(screen.getByText('label.retry'));

    expect(refetch).toHaveBeenCalled();
  });

  it('offers the first domain to whoever may create one', () => {
    mockPermissions = { domain: { Create: true } };
    renderWidget({
      domains: [],
      emptyCount: 0,
      totalCount: 0,
      unownedCount: 0,
    });

    expect(screen.getByTestId('topic-empty-domains')).toHaveTextContent(
      'message.no-domains-yet'
    );
    // Domains fill through use, not setup, so the header raises no flag.
    expect(screen.queryByTestId('topic-status-domains')).toBeNull();
    expect(screen.queryByTestId('domains-filter-all')).toBeNull();

    fireEvent.click(screen.getByTestId('topic-empty-action-domains'));

    expect(mockNavigate).toHaveBeenCalledWith('/domain');
  });

  it('shows the empty state without a call to action to a viewer', () => {
    mockPermissions = {};
    renderWidget({
      domains: [],
      emptyCount: 0,
      totalCount: 0,
      unownedCount: 0,
    });

    expect(screen.getByTestId('topic-empty-domains')).toBeInTheDocument();
    expect(screen.queryByTestId('topic-empty-action-domains')).toBeNull();
  });
});

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
import { render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { CuratedAsset } from '../../../../hooks/useCuratedAssets';
import CuratedAssetRows from './CuratedAssetRows';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Render `Link` as a real anchor so the test can assert on `href` — the value
// the bug is about — rather than on a mock call argument.
jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) => (
    <a data-testid="entity-link" href={to}>
      {children}
    </a>
  ),
}));

jest.mock('../../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: {
    getServiceLogo: jest.fn().mockReturnValue('service-logo.svg'),
  },
}));

// The real `searchClassBase` is used (not mocked) so the test exercises the
// codebase-standard resolver end-to-end: linkable types resolve to their real
// routes, and un-linkable types resolve to '' — the contract the fix relies on.

const tableAsset: CuratedAsset = {
  entityType: 'table',
  fullyQualifiedName: 'svc.db.schema.table1',
  id: 't1',
  name: 'My Table',
  serviceType: 'Mysql',
  tier: 'Tier1',
};

const topicAsset: CuratedAsset = {
  entityType: 'topic',
  fullyQualifiedName: 'svc.topic-x',
  id: 't2',
  name: 'My Topic',
  serviceType: 'Kafka',
};

const dashboardAsset: CuratedAsset = {
  entityType: 'dashboard',
  fullyQualifiedName: 'svc.dashboard-y',
  id: 'd1',
  name: 'My Dashboard',
  serviceType: 'Superset',
};

// Un-linkable types: present on the `all` index, no dedicated route.
const queryAsset: CuratedAsset = {
  entityType: 'query',
  fullyQualifiedName: 'svc.q-1',
  id: 'q1',
  name: 'My Query',
};

const folderAsset: CuratedAsset = {
  entityType: 'folder',
  fullyQualifiedName: 'MyWorkspace.folderx',
  id: 'f1',
  name: 'My Folder',
};

const auditReportAsset: CuratedAsset = {
  entityType: 'auditReport',
  fullyQualifiedName: 'report.r1',
  id: 'r1',
  name: 'Audit Report',
};

describe('CuratedAssetRows', () => {
  it('renders nothing when there are no assets', () => {
    const { container } = render(<CuratedAssetRows assets={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('links a table asset to its table details page', () => {
    render(<CuratedAssetRows assets={[tableAsset]} />);

    const link = screen.getByTestId('entity-link');

    expect(link).toHaveAttribute('href', '/table/svc.db.schema.table1');
  });

  it('links a topic asset to its topic details page', () => {
    render(<CuratedAssetRows assets={[topicAsset]} />);

    const link = screen.getByTestId('entity-link');

    expect(link).toHaveAttribute('href', '/topic/svc.topic-x');
  });

  it('links a dashboard asset to its dashboard details page', () => {
    render(<CuratedAssetRows assets={[dashboardAsset]} />);

    const link = screen.getByTestId('entity-link');

    expect(link).toHaveAttribute('href', '/dashboard/svc.dashboard-y');
  });

  // The regression this pins: a non-table entity type with no dedicated route
  // must not produce a `/table/<fqn>` link. Previously
  // `entityUtilClassBase.getEntityLink` fell back to the table details path for
  // every unknown type, landing the user on an empty table page.
  it.each<[string, CuratedAsset]>([
    ['query', queryAsset],
    ['folder', folderAsset],
    ['auditReport', auditReportAsset],
  ])(
    'renders a %s asset as a non-interactive tile, not a link',
    (_type, asset) => {
      const { container } = render(<CuratedAssetRows assets={[asset]} />);

      expect(screen.queryByTestId('entity-link')).not.toBeInTheDocument();
      expect(container.querySelector('a')).toBeNull();

      const tile = screen.getByTestId(`curated-asset-no-link-${asset.id}`);

      expect(tile.tagName).toBe('DIV');
      // The asset name still renders so the row is informative even when it
      // can't be opened.
      expect(tile).toHaveTextContent(asset.name);
      // No href is present on the tile.
      expect(tile).not.toHaveAttribute('href');
    }
  );

  it('renders a mix of linkable and un-linkable rows correctly', () => {
    render(
      <CuratedAssetRows
        assets={[tableAsset, queryAsset, topicAsset, folderAsset]}
      />
    );

    const links = screen.getAllByTestId('entity-link');

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/table/svc.db.schema.table1');
    expect(links[1]).toHaveAttribute('href', '/topic/svc.topic-x');

    expect(
      screen.getByTestId(`curated-asset-no-link-${queryAsset.id}`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`curated-asset-no-link-${folderAsset.id}`)
    ).toBeInTheDocument();
  });

  it('renders the service logo when serviceType is present', () => {
    const { container } = render(<CuratedAssetRows assets={[tableAsset]} />);

    const logo = container.querySelector('img');

    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute('src', 'service-logo.svg');
  });

  it('omits the service logo when serviceType is absent', () => {
    const { container } = render(<CuratedAssetRows assets={[queryAsset]} />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the tier when present', () => {
    render(<CuratedAssetRows assets={[tableAsset]} />);

    expect(screen.getByText('Tier1')).toBeInTheDocument();
  });

  it('omits the tier when absent', () => {
    render(<CuratedAssetRows assets={[topicAsset]} />);

    expect(screen.queryByText('Tier1')).not.toBeInTheDocument();
  });

  it('renders a healthy dot with a healthy label when isHealthy is true', () => {
    render(<CuratedAssetRows assets={[{ ...tableAsset, isHealthy: true }]} />);

    const dot = screen.getByTestId('curated-asset-health-t1');

    expect(dot).toHaveAttribute('aria-label', 'label.healthy');
    expect(dot.className).toContain('tw:bg-utility-success-500');
  });

  it('renders a failing dot with a failing label when isHealthy is false', () => {
    render(<CuratedAssetRows assets={[{ ...tableAsset, isHealthy: false }]} />);

    const dot = screen.getByTestId('curated-asset-health-t1');

    expect(dot).toHaveAttribute('aria-label', 'label.failing');
    expect(dot.className).toContain('tw:bg-utility-error-500');
  });

  it('omits the health dot while the test lookup is pending', () => {
    render(
      <CuratedAssetRows assets={[{ ...tableAsset, isHealthy: undefined }]} />
    );

    expect(
      screen.queryByTestId('curated-asset-health-t1')
    ).not.toBeInTheDocument();
  });

  // Ensures the fix holds for the un-linkable tile path too: the health dot and
  // tier render inside the non-link tile exactly as they do inside a link.
  it('renders the health dot and tier inside a non-link tile', () => {
    render(
      <CuratedAssetRows
        assets={[
          {
            ...queryAsset,
            isHealthy: true,
            serviceType: 'Mysql',
            tier: 'Tier1',
          },
        ]}
      />
    );

    const tile = screen.getByTestId(`curated-asset-no-link-${queryAsset.id}`);

    expect(within(tile).getByTestId('curated-asset-health-q1')).toHaveAttribute(
      'aria-label',
      'label.healthy'
    );
    expect(tile).toHaveTextContent('Tier1');
  });
});

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
import TrackedAssetList from './TrackedAssetList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: (type: string, fqn: string) => `/${type}/${fqn}`,
  },
}));

jest.mock('../../../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: { getServiceLogo: () => 'logo.svg' },
}));

const ASSETS = [
  {
    entityType: 'table',
    fullyQualifiedName: 'svc.db.orders',
    hasChanged: true,
    id: 'orders',
    name: 'orders',
    serviceType: 'Snowflake',
  },
  {
    entityType: 'dashboard',
    fullyQualifiedName: 'svc.revenue',
    hasChanged: false,
    id: 'revenue',
    name: 'revenue',
  },
];

describe('TrackedAssetList', () => {
  it('links each asset and marks whether it changed', () => {
    render(
      <TrackedAssetList assets={ASSETS} dataTestId="owned" title="Owned" />
    );

    const orders = screen.getByTestId('owned-orders');

    expect(orders.querySelector('a')).toHaveAttribute(
      'href',
      '/table/svc.db.orders'
    );
    expect(orders).toHaveTextContent('label.changed');
    expect(screen.getByTestId('owned-revenue')).toHaveTextContent(
      'label.stable'
    );
  });

  it('says so when there is nothing to list', () => {
    render(<TrackedAssetList assets={[]} dataTestId="owned" title="Owned" />);

    expect(screen.queryByTestId('owned')).toBeNull();
    expect(screen.getByText('message.no-data-available')).toBeInTheDocument();
  });
});

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
import { ServiceCategory } from '../../../../../enums/service.enum';
import { BucketService } from '../../PlatformHealthWidget/useIngestionPipelineStats';
import BucketServiceRow from './BucketServiceRow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: { getServiceLogo: () => 'logo.svg' },
}));

jest.mock('../../../../../utils/DataAssetServiceUtils', () => ({
  getFormattedDataAssetServiceType: (type: string) => `fmt-${type}`,
}));

const SERVICE: BucketService = {
  displayName: 'Orders DB',
  fqn: 'orders_db',
  id: 'svc-1',
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceType: 'Mysql',
};

const renderRow = (bucket: 'healthy' | 'notRun', onOpen = jest.fn()) => {
  render(
    <ul>
      <BucketServiceRow bucket={bucket} service={SERVICE} onOpen={onOpen} />
    </ul>
  );

  return onOpen;
};

describe('BucketServiceRow', () => {
  it('names the service and its connector', () => {
    renderRow('healthy');

    const row = screen.getByTestId('bucket-service-svc-1');

    expect(row).toHaveTextContent('Orders DB');
    expect(row).toHaveTextContent('fmt-Mysql');
  });

  it.each([
    ['healthy', 'label.healthy'],
    ['notRun', 'label.not-run-yet'],
  ] as const)('labels a %s service with its bucket', (bucket, label) => {
    renderRow(bucket);

    expect(screen.getByTestId('bucket-service-svc-1')).toHaveTextContent(label);
  });

  it('opens the service when the row is picked', () => {
    const onOpen = renderRow('notRun');

    fireEvent.click(screen.getByTestId('bucket-service-svc-1'));

    expect(onOpen).toHaveBeenCalledWith(SERVICE);
  });

  // Power BI's logo is dark artwork: drawn as-is it vanished on a dark card.
  it('inverts dark connector artwork in dark mode only', () => {
    render(
      <ul>
        <BucketServiceRow
          bucket="notRun"
          service={{ ...SERVICE, serviceType: 'PowerBI' }}
          onOpen={jest.fn()}
        />
      </ul>
    );

    expect(
      screen.getByTestId('bucket-service-svc-1').querySelector('img')
    ).toHaveClass('tw:dark:invert');
  });
});

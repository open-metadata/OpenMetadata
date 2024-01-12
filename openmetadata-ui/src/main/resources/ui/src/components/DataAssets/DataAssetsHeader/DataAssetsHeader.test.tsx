/*
 *  Copyright 2023 Collate.
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
import { render } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { Container } from '../../../generated/entity/data/container';
import { getContainerByName } from '../../../rest/storageAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { DataAssetsHeader } from './DataAssetsHeader.component';
import { DataAssetsHeaderProps } from './DataAssetsHeader.interface';

const mockProps: DataAssetsHeaderProps = {
  dataAsset: {
    id: 'assets-id',
    name: 'testContainer',
    parent: {
      id: 'id',
      type: 'container',
      fullyQualifiedName: 'fullyQualifiedName',
    },
    service: {
      id: 'service-id',
      name: 's3_storage_sample',
      type: 'storageService',
    },
  } as Container,
  entityType: EntityType.CONTAINER,
  permissions: DEFAULT_ENTITY_PERMISSION,
  onRestoreDataAsset: jest.fn(),
  onDisplayNameUpdate: jest.fn(),
  onFollowClick: jest.fn(),
  onVersionClick: jest.fn(),
  onTierUpdate: jest.fn(),
  onOwnerUpdate: jest.fn(),
};

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>TitleBreadcrumb.component</div>);
  }
);
jest.mock(
  '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>EntityHeaderTitle.component</div>);
  }
);
jest.mock('../../../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(() => <div>OwnerLabel.component</div>),
}));
jest.mock('../../../components/common/TierCard/TierCard', () =>
  jest.fn().mockImplementation(({ children }) => (
    <div>
      TierCard.component
      <div>{children}</div>
    </div>
  ))
);
jest.mock(
  '../../../components/common/EntityPageInfos/ManageButton/ManageButton',
  () => jest.fn().mockImplementation(() => <div>ManageButton.component</div>)
);
jest.mock(
  '../../../components/common/EntityPageInfos/AnnouncementCard/AnnouncementCard',
  () =>
    jest.fn().mockImplementation(() => <div>AnnouncementCard.component</div>)
);
jest.mock(
  '../../../components/common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer',
  () =>
    jest.fn().mockImplementation(() => <div>AnnouncementDrawer.component</div>)
);
jest.mock('../../../rest/storageAPI', () => ({
  getContainerByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ name: 'test' })),
}));

describe('DataAssetsHeader component', () => {
  it('should call getContainerByName API on Page load for container assets', () => {
    const mockGetContainerByName = getContainerByName as jest.Mock;
    render(<DataAssetsHeader {...mockProps} />);

    expect(mockGetContainerByName).toHaveBeenCalledWith('fullyQualifiedName', {
      fields: 'parent',
    });
  });

  it('should not call getContainerByName API if parent is undefined', () => {
    const mockGetContainerByName = getContainerByName as jest.Mock;
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{ ...mockProps.dataAsset, parent: undefined }}
      />
    );

    expect(mockGetContainerByName).not.toHaveBeenCalled();
  });
});

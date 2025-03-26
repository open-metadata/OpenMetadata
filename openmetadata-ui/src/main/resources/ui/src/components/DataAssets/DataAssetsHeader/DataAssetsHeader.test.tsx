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
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../../enums/entity.enum';
import {
  APIEndpoint,
  APIRequestMethod,
} from '../../../generated/entity/data/apiEndpoint';
import { Container } from '../../../generated/entity/data/container';
import { MOCK_TIER_DATA } from '../../../mocks/TableData.mock';
import { getDataQualityLineage } from '../../../rest/lineageAPI';
import { getContainerByName } from '../../../rest/storageAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { DataAssetsHeader, ExtraInfoLink } from './DataAssetsHeader.component';
import { DataAssetsHeaderProps } from './DataAssetsHeader.interface';

import { LabelType, State, TagSource } from '../../../generated/tests/testCase';
import { AssetCertification } from '../../../generated/type/assetCertification';
const mockProps: DataAssetsHeaderProps = {
  dataAsset: {
    id: 'assets-id',
    name: 'testContainer',
    fullyQualifiedName: 'fullyQualifiedName',
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

jest.mock('../../Tag/TagsV1/TagsV1.component', () =>
  jest.fn().mockImplementation(() => <div>TagsV1.component</div>)
);

jest.mock('../../../rest/storageAPI', () => ({
  getContainerByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ name: 'test' })),
}));

let mockIsAlertSupported = false;
jest.mock('../../../utils/TableClassBase', () => ({
  getAlertEnableStatus: jest
    .fn()
    .mockImplementation(() => mockIsAlertSupported),
}));

jest.mock('../../../rest/lineageAPI', () => ({
  getDataQualityLineage: jest.fn(),
}));

describe('ExtraInfoLink component', () => {
  const mockProps = {
    label: 'myLabel',
    value: 'example',
    href: 'http://example.com/',
  };

  it('should not have target and rel attributes when newTab is false (default)', () => {
    const { container } = render(<ExtraInfoLink {...mockProps} />);

    const elm = container.querySelector('a');

    expect(elm).toHaveAttribute('href', mockProps.href);
    expect(elm).not.toHaveAttribute('target');
    expect(elm).not.toHaveAttribute('rel');
  });

  it('should have target and rel attributes when newTab is true', () => {
    const { container } = render(<ExtraInfoLink {...mockProps} newTab />);

    const elm = container.querySelector('a');

    expect(elm).toHaveAttribute('href', mockProps.href);
    expect(elm).toHaveAttribute('target', '_blank');

    const rel = (elm?.getAttribute('rel') || '').split(/\s+/g);

    expect(rel.sort()).toStrictEqual(['noopener', 'noreferrer'].sort());
  });
});

describe('DataAssetsHeader component', () => {
  it('should call getContainerByName API on Page load for container assets', () => {
    const mockGetContainerByName = getContainerByName as jest.Mock;
    render(<DataAssetsHeader {...mockProps} />);

    expect(mockGetContainerByName).toHaveBeenCalledWith('fullyQualifiedName', {
      fields: 'parent',
    });
    expect(getDataQualityLineage).not.toHaveBeenCalled();
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

  it('should render the Tier data if present', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          tags: [MOCK_TIER_DATA],
        }}
      />
    );

    expect(screen.getByText('TagsV1.component')).toBeInTheDocument();
  });

  it('should not render the Tier data if not  present', () => {
    render(<DataAssetsHeader {...mockProps} dataAsset={mockProps.dataAsset} />);

    expect(screen.getByTestId('Tier')).toContainHTML('label.no-entity');
  });

  it('should render the request method if entityType is apiEndpoint', () => {
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={
          {
            name: 'testAPIEndpoint',
            id: 'testAPIEndpointId',
            endpointURL: 'testAPIEndpointURL',
            requestMethod: APIRequestMethod.Get,
          } as APIEndpoint
        }
        entityType={EntityType.API_ENDPOINT}
      />
    );

    expect(
      screen.getByTestId('api-endpoint-request-method')
    ).toBeInTheDocument();
  });

  it('should call getDataQualityLineage, if isDqAlertSupported and alert supported is true', () => {
    mockIsAlertSupported = true;
    act(() => {
      render(<DataAssetsHeader isDqAlertSupported {...mockProps} />);
    });

    expect(getDataQualityLineage).toHaveBeenCalledWith('fullyQualifiedName', {
      upstreamDepth: 1,
    });

    mockIsAlertSupported = false;
  });

  it('should render source URL button when sourceUrl is present', () => {
    const mockSourceUrl = 'http://test-source.com';

    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          sourceUrl: mockSourceUrl,
        }}
      />
    );

    const sourceUrlButton = screen.getByTestId('source-url-button');

    const sourceUrlLink = screen.getByRole('link');

    expect(sourceUrlButton).toBeInTheDocument();
    expect(sourceUrlLink).toHaveAttribute('href', mockSourceUrl);
    expect(sourceUrlLink).toHaveAttribute('target', '_blank');
    expect(screen.getByText('label.source-url')).toBeInTheDocument();
  });

  it('should not render source URL button when sourceUrl is not present', () => {
    render(<DataAssetsHeader {...mockProps} />);

    expect(screen.queryByTestId('source-url-button')).not.toBeInTheDocument();
  });

  it('should render certification when certification is present', () => {
    const mockCertification: AssetCertification = {
      tagLabel: {
        tagFQN: 'Certification.Bronze',
        name: 'Bronze',
        displayName: 'Bronze_Medal',
        description: 'Bronze certified Data Asset test',
        style: {
          color: '#C08329',
          iconURL: 'BronzeCertification.svg',
        },
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      appliedDate: 1732814645688,
      expiryDate: 1735406645688,
    };
    render(
      <DataAssetsHeader
        {...mockProps}
        dataAsset={{
          ...mockProps.dataAsset,
          certification: mockCertification,
        }}
      />
    );

    expect(screen.getByText('label.certification')).toBeInTheDocument();

    const certificatComponent = screen.getByTestId(
      `certification-${mockCertification.tagLabel.tagFQN}`
    );

    expect(certificatComponent).toBeInTheDocument();
    expect(certificatComponent).toHaveTextContent('Bronze_Medal');
  });
});

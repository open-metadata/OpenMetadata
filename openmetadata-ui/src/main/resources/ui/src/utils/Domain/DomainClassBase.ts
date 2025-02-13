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

import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import { DataProductsTabRef } from '../../components/Domain/DomainTabs/DataProductsTab/DataProductsTab.interface';
import { EntityDetailsObjectInterface } from '../../components/Explore/ExplorePage.interface';
import { AssetsTabRef } from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import {
  DESCRIPTION_WIDGET,
  GridSizes,
} from '../../constants/CustomizeWidgets.constants';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { CreateDomain } from '../../generated/api/domains/createDomain';
import { Domain } from '../../generated/entity/domains/domain';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import { getDomainDetailTabs } from '../DomainUtils';
import i18n from '../i18next/LocalUtil';

export interface DomainDetailPageTabProps {
  domain: Domain;
  isVersionsView: boolean;
  domainPermission: OperationPermission;
  subDomains: Domain[];
  dataProductsCount: number;
  assetCount: number;
  activeTab: EntityTabs;
  onUpdate: (domain: Domain) => Promise<void>;
  onAddDataProduct: () => void;
  onAddSubDomain: (subDomain: CreateDomain) => Promise<void>;
  isSubDomainsLoading: boolean;
  queryFilter?: string | Record<string, unknown>;
  assetTabRef: React.RefObject<AssetsTabRef>;
  dataProductsTabRef: React.RefObject<DataProductsTabRef>;
  showAddSubDomainModal: boolean;
  previewAsset?: EntityDetailsObjectInterface;
  setPreviewAsset: (asset?: EntityDetailsObjectInterface) => void;
  setAssetModalVisible: (visible: boolean) => void;
  handleAssetClick: (asset?: EntityDetailsObjectInterface) => void;
  handleAssetSave: () => void;
  setShowAddSubDomainModal: (visible: boolean) => void;
  labelMap?: Record<EntityTabs, string>;
}

class DomainClassBase {
  tabs = [];

  constructor() {
    this.tabs = [];
  }

  public getDomainDetailPageTabs(
    domainDetailsPageProps: DomainDetailPageTabProps
  ): TabProps[] {
    return getDomainDetailTabs(domainDetailsPageProps);
  }

  public getDomainDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.DOCUMENTATION,
      EntityTabs.SUBDOMAINS,
      EntityTabs.DATA_PRODUCTS,
      EntityTabs.ASSETS,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.DOCUMENTATION,
    }));
  }

  public getDefaultLayout(tab: EntityTabs) {
    switch (tab) {
      case EntityTabs.DOCUMENTATION:
        return [
          {
            h: 2,
            i: DetailPageWidgetKeys.DESCRIPTION,
            w: 6,
            x: 0,
            y: 0,
            static: false,
          },

          {
            h: 1,
            i: DetailPageWidgetKeys.OWNERS,
            w: 2,
            x: 6,
            y: 1,
            static: false,
          },
          {
            h: 2,
            i: DetailPageWidgetKeys.EXPERTS,
            w: 2,
            x: 6,
            y: 2,
            static: false,
          },
          {
            h: 2,
            i: DetailPageWidgetKeys.DOMAIN_TYPE,
            w: 2,
            x: 6,
            y: 3,
            static: false,
          },
        ];

      default:
        return [];
    }
  }

  public getDummyData(): Domain {
    return {
      id: '31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
      domainType: 'Consumer-aligned',
      name: 'Engineering',
      fullyQualifiedName: 'Engineering',
      displayName: 'Engineering',
      description: 'Domain related engineering development.',
      style: {},
      version: 0.8,
      updatedAt: 1698061758989,
      updatedBy: 'rupesh',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/domains/31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
      children: [],
      owners: [
        {
          id: 'ebac156e-6779-499c-8bbf-ab98a6562bc5',
          type: 'team',
          name: 'Data',
          fullyQualifiedName: 'Data',
          description: '',
          displayName: 'Data',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/ebac156e-6779-499c-8bbf-ab98a6562bc5',
        },
      ],
      experts: [
        {
          id: '34ee72dc-7dad-4710-9f1d-e934ad0554a9',
          type: 'user',
          name: 'brian_smith7',
          fullyQualifiedName: 'brian_smith7',
          displayName: 'Brian Smith',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/34ee72dc-7dad-4710-9f1d-e934ad0554a9',
        },
        {
          id: '9a6687fa-8bd5-446c-aa8f-81416c88fe67',
          type: 'user',
          name: 'brittney_thomas3',
          fullyQualifiedName: 'brittney_thomas3',
          displayName: 'Brittney Thomas',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/9a6687fa-8bd5-446c-aa8f-81416c88fe67',
        },
      ],
    } as Domain;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.OWNERS,
        name: i18n.t('label.owner-plural'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      {
        fullyQualifiedName: DetailPageWidgetKeys.EXPERTS,
        name: i18n.t('label.expert-plural'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      {
        fullyQualifiedName: DetailPageWidgetKeys.DOMAIN_TYPE,
        name: i18n.t('label.domain-type'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
    ];
  }
}

const domainClassBase = new DomainClassBase();

export default domainClassBase;
export { DomainClassBase };

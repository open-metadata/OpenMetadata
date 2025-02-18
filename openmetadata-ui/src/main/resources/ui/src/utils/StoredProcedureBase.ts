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
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { StoredProcedure } from '../generated/entity/data/storedProcedure';
import { EntityReference } from '../generated/entity/type';
import { Tab } from '../generated/system/ui/uiCustomization';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import {
  getStoredProcedureDetailsPageTabs,
  getStoredProcedureWidgetsFromKey,
} from './StoredProceduresUtils';

export interface StoredProcedureDetailPageTabProps {
  activeTab: EntityTabs;
  feedCount: {
    totalCount: number;
  };
  decodedStoredProcedureFQN: string;
  entityName: string;
  code: string;
  deleted: boolean;
  owners: EntityReference[];
  storedProcedure: StoredProcedure;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  labelMap?: Record<EntityTabs, string>;
  onExtensionUpdate: (value: StoredProcedure) => Promise<void>;
  getEntityFeedCount: () => void;
  fetchStoredProcedureDetails: () => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
}

class StoredProcedureClassBase {
  tabs = [];

  constructor() {
    this.tabs = [];
  }

  public getStoredProcedureDetailPageTabs(
    tabsProps: StoredProcedureDetailPageTabProps
  ): TabProps[] {
    return getStoredProcedureDetailsPageTabs(tabsProps);
  }

  public getStoredProcedureDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.CODE,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.LINEAGE,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: [EntityTabs.CODE].includes(tab),
    }));
  }

  public getDefaultLayout(tab?: EntityTabs) {
    if (tab && tab !== EntityTabs.CODE) {
      return [];
    }

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
        h: 7,
        i: DetailPageWidgetKeys.STORED_PROCEDURE_CODE,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: 1,
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: 2,
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: 2,
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: 4,
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      },
    ];
  }

  public getAlertEnableStatus() {
    return false;
  }

  public getDummyData(): StoredProcedure {
    return {
      id: '5f3509ca-c8e5-449a-a7e8-b1c3b96e39e8',
      name: 'calculate_average',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.calculate_average',
      description: 'Procedure to calculate average',
      storedProcedureCode: {
        // eslint-disable-next-line max-len
        code: 'CREATE OR REPLACE PROCEDURE calculate_average(numbers INT ARRAY) RETURNS FLOAT NOT NULL LANGUAGE SQL AS $$DECLARE sum_val INT = 0;count_val INT = 0;average_val FLOAT;BEGIN\n  FOR num IN ARRAY numbers DO sum_val := sum_val + num;\n  count_val := count_val + 1;\nEND FOR;\nIF count_val = 0 THEN\n  average_val := 0.0;\nELSE\n  average_val := sum_val / count_val;\nEND IF;\nRETURN average_val;\nEND;$$;',
      },
      version: 0.5,
      dataProducts: [],
      updatedAt: 1709544812674,
      updatedBy: 'admin',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/storedProcedures/5f3509ca-c8e5-449a-a7e8-b1c3b96e39e8',
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [
          {
            name: 'deleted',
            oldValue: true,
            newValue: false,
          },
        ],
        fieldsDeleted: [],
        previousVersion: 0.4,
      },
      databaseSchema: {
        id: '9f127bdc-d060-4fac-ae7b-c635933fc2e0',
        type: 'databaseSchema',
        name: 'shopify',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
        description:
          'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
        displayName: 'shopify',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/databaseSchemas/9f127bdc-d060-4fac-ae7b-c635933fc2e0',
      },
      database: {
        id: '77147d45-888b-42dd-a369-8b7ba882dffb',
        type: 'database',
        name: 'ecommerce_db',
        fullyQualifiedName: 'sample_data.ecommerce_db',
        description:
          'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
        displayName: 'ecommerce_db',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/databases/77147d45-888b-42dd-a369-8b7ba882dffb',
      },
      service: {
        id: '75199480-3d06-4b6f-89d2-e8805ebe8d01',
        type: 'databaseService',
        name: 'sample_data',
        fullyQualifiedName: 'sample_data',
        displayName: 'sample_data',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/services/databaseServices/75199480-3d06-4b6f-89d2-e8805ebe8d01',
      },
      serviceType: 'BigQuery',
      deleted: false,
      owners: [
        {
          id: '50bb97a5-cf0c-4273-930e-b3e802b52ee1',
          type: 'user',
          name: 'aaron.singh2',
          fullyQualifiedName: '"aaron.singh2"',
          displayName: 'Aaron Singh',
          deleted: false,
          inherited: true,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/50bb97a5-cf0c-4273-930e-b3e802b52ee1',
        },
        {
          id: '1eb7eb26-21da-42d7-b0ed-8812f04f4ca4',
          type: 'user',
          name: 'ayush',
          fullyQualifiedName: 'ayush',
          displayName: 'Ayush Shah',
          deleted: false,
          inherited: true,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/1eb7eb26-21da-42d7-b0ed-8812f04f4ca4',
        },
        {
          id: '32e07f38-faff-45b1-9b51-4e42caa69e3c',
          type: 'user',
          name: 'ayush02shah12',
          fullyQualifiedName: 'ayush02shah12',
          displayName: 'Ayush Shah',
          deleted: false,
          inherited: true,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/32e07f38-faff-45b1-9b51-4e42caa69e3c',
        },
        {
          id: 'f7971c49-bca7-48fb-bb1a-821a1e2c5802',
          type: 'user',
          name: 'prajwal161998',
          fullyQualifiedName: 'prajwal161998',
          displayName: 'prajwal161998',
          deleted: false,
          inherited: true,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/f7971c49-bca7-48fb-bb1a-821a1e2c5802',
        },
      ],
      followers: [],
      votes: {
        upVotes: 0,
        downVotes: 0,
        upVoters: [],
        downVoters: [],
      },
      tags: [],
      domain: {
        id: '31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
        type: 'domain',
        name: 'Engineering',
        fullyQualifiedName: 'Engineering',
        description: 'Domain related engineering development.',
        displayName: 'Engineering',
        inherited: true,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/domains/31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
      },
    } as StoredProcedure;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.STORED_PROCEDURE_CODE,
        name: i18n.t('label.stored_procedure_code'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      DATA_PRODUCTS_WIDGET,
      TAGS_WIDGET,
      GLOSSARY_TERMS_WIDGET,
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getStoredProcedureWidgetsFromKey(widgetConfig);
  }
}

const storedProcedureClassBase = new StoredProcedureClassBase();

export default storedProcedureClassBase;
export { StoredProcedureClassBase };

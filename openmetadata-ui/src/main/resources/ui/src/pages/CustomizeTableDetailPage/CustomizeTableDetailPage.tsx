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
import { noop } from 'lodash';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import gridBgImg from '../../assets/img/grid-bg-img.png';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { CustomizeTabWidget } from '../../components/Glossary/CustomiseWidgets/CustomizeTabWidget/CustomizeTabWidget';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import { CustomizeMyDataProps } from '../../components/MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import {
  Constraint,
  DatabaseServiceType,
  DataType,
  TableType,
} from '../../generated/entity/data/table';
import { Page } from '../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../hooks/useGridLayoutDirection';
import { getEntityName } from '../../utils/EntityUtils';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';

export const CustomizeTableDetailPage = ({
  personaDetails,
  onSaveLayout,
}: CustomizeMyDataProps) => {
  const { t } = useTranslation();
  const { currentPage, currentPageType } = useCustomizeStore();

  const handleReset = useCallback(async () => {
    await onSaveLayout();
  }, [onSaveLayout]);

  const handleSave = async () => {
    await onSaveLayout(currentPage ?? ({ pageType: currentPageType } as Page));
  };

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  const asyncNoop = async () => {
    noop();
  };

  return (
    <PageLayoutV1
      mainContainerClassName="p-t-0"
      pageContainerStyle={{
        backgroundImage: `url(${gridBgImg})`,
      }}
      pageTitle={t('label.customize-entity', {
        entity: t('label.landing-page'),
      })}>
      <div className="m-x-sm">
        <CustomizablePageHeader
          personaName={getEntityName(personaDetails)}
          onReset={handleReset}
          onSave={handleSave}
        />
      </div>
      <DataAssetsHeader
        dataAsset={{
          id: 'ab4f893b-c303-43d9-9375-3e620a670b02',
          name: 'raw_product_catalog',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_product_catalog',
          description:
            'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ',
          version: 0.2,
          updatedAt: 1688442727895,
          updatedBy: 'admin',
          tableType: TableType.Regular,
          columns: [
            {
              name: 'shop_id',
              displayName: 'Shop Id Customer',
              dataType: DataType.Number,
              dataTypeDisplay: 'numeric',
              description:
                'Unique identifier for the store. This column is the primary key for this table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify."dim.shop".shop_id',
              tags: [],
              constraint: Constraint.PrimaryKey,
              ordinalPosition: 1,
            },
          ],
          owners: [
            {
              id: '38be030f-f817-4712-bc3b-ff7b9b9b805e',
              type: 'user',
              name: 'aaron_johnson0',
              fullyQualifiedName: 'aaron_johnson0',
              displayName: 'Aaron Johnson',
              deleted: false,
            },
          ],
          databaseSchema: {
            id: '3f0d9c39-0926-4028-8070-65b0c03556cb',
            type: 'databaseSchema',
            name: 'shopify',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
            description:
              'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
            deleted: false,
          },
          database: {
            id: 'f085e133-e184-47c8-ada5-d7e005d3153b',
            type: 'database',
            name: 'ecommerce_db',
            fullyQualifiedName: 'sample_data.ecommerce_db',
            description:
              'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
            deleted: false,
          },
          service: {
            id: 'e61069a9-29e3-49fa-a7f4-f5227ae50b72',
            type: 'databaseService',
            name: 'sample_data',
            fullyQualifiedName: 'sample_data',
            deleted: false,
          },
          serviceType: DatabaseServiceType.BigQuery,
          tags: [],
          followers: [],
          changeDescription: {
            fieldsAdded: [
              {
                name: 'owner',
                newValue:
                  '{"id":"38be030f-f817-4712-bc3b-ff7b9b9b805e","type":"user","name":"aaron_johnson0","fullyQualifiedName":"aaron_johnson0","displayName":"Aaron Johnson","deleted":false}',
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
            previousVersion: 0.1,
          },
          deleted: false,
        }}
        entityType={EntityType.TABLE}
        permissions={{} as OperationPermission}
        onDisplayNameUpdate={asyncNoop}
        onOwnerUpdate={asyncNoop}
        onRestoreDataAsset={asyncNoop}
        onTierUpdate={asyncNoop}
      />
      <CustomizeTabWidget />
    </PageLayoutV1>
  );
};

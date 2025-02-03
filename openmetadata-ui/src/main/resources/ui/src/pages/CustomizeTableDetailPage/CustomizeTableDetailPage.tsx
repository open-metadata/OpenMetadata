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
import { camelCase, noop } from 'lodash';
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
import { Table } from '../../generated/entity/data/table';
import { Page, PageType } from '../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../hooks/useGridLayoutDirection';
import { getDummyDataByPage } from '../../utils/CustomizePage/CustomizePageUtils';
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

  const entityDummyData = getDummyDataByPage(
    currentPageType as PageType
  ) as unknown;

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  const asyncNoop = async () => {
    noop();
  };

  if (!currentPageType) {
    // eslint-disable-next-line no-console
    console.error('currentPageType is not defined');

    return null;
  }

  return (
    <PageLayoutV1
      mainContainerClassName="p-t-0"
      pageContainerStyle={{
        backgroundImage: `url(${gridBgImg})`,
      }}
      pageTitle={t('label.customize-entity', {
        entity: t('label.landing-page'),
      })}>
      <CustomizablePageHeader
        personaName={getEntityName(personaDetails)}
        onReset={handleReset}
        onSave={handleSave}
      />
      <div className="m-md">
        <DataAssetsHeader
          dataAsset={entityDummyData as Table}
          entityType={camelCase(currentPageType) as EntityType.TABLE}
          permissions={{} as OperationPermission}
          onDisplayNameUpdate={asyncNoop}
          onOwnerUpdate={asyncNoop}
          onRestoreDataAsset={asyncNoop}
          onTierUpdate={asyncNoop}
        />
      </div>
      <CustomizeTabWidget />
    </PageLayoutV1>
  );
};

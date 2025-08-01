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
import { Col, Row } from 'antd';
import { kebabCase } from 'lodash';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizeTabWidget } from '../../components/Customization/CustomizeTabWidget/CustomizeTabWidget';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import { CustomizeMyDataProps } from '../../components/MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { Table } from '../../generated/entity/data/table';
import { Page, PageType } from '../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../hooks/useGridLayoutDirection';
import {
  asyncNoop,
  getDummyDataByPage,
} from '../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';
import './customize-details-page.less';
import { PageTypeToEntityTypeMap } from './CustomizeDetailPage.interface';

export const CustomizeDetailsPage = ({
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

  if (!currentPageType) {
    return null;
  }

  return (
    <PageLayoutV1
      className="bg-grey"
      pageTitle={t('label.customize-entity', {
        entity: t('label.' + kebabCase(currentPageType)),
      })}>
      <Row className="customize-details-page" gutter={[0, 20]}>
        <Col span={24}>
          <CustomizablePageHeader
            personaName={getEntityName(personaDetails)}
            onReset={handleReset}
            onSave={handleSave}
          />
        </Col>
        <Col span={24}>
          <DataAssetsHeader
            isCustomizedView
            dataAsset={entityDummyData as Table}
            entityType={
              PageTypeToEntityTypeMap[currentPageType] as EntityType.TABLE
            }
            permissions={{} as OperationPermission}
            onDisplayNameUpdate={asyncNoop}
            onOwnerUpdate={asyncNoop}
            onRestoreDataAsset={asyncNoop}
            onTierUpdate={asyncNoop}
          />
        </Col>
        {/* It will render cols inside the row */}
        <CustomizeTabWidget />
      </Row>
    </PageLayoutV1>
  );
};

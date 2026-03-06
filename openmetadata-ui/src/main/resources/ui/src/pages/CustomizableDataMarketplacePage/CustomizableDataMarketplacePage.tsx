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

import { Col, Row } from 'antd';
import { compare } from 'fast-json-patch';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizeTabWidget } from '../../components/Customization/CustomizeTabWidget/CustomizeTabWidget';
import MarketplaceGreetingBanner from '../../components/DataMarketplace/MarketplaceGreetingBanner/MarketplaceGreetingBanner.component';
import MarketplaceSearchBar from '../../components/DataMarketplace/MarketplaceSearchBar/MarketplaceSearchBar.component';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import { CustomizeMyDataProps } from '../../components/MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { Page } from '../../generated/system/ui/page';
import { getEntityName } from '../../utils/EntityUtils';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';
import '../CustomizeDetailsPage/customize-details-page.less';

const CustomizableDataMarketplacePage = ({
  personaDetails,
  onSaveLayout,
}: CustomizeMyDataProps) => {
  const { t } = useTranslation();
  const { currentPage, currentPageType, getPage } = useCustomizeStore();

  const handleReset = useCallback(async () => {
    await onSaveLayout();
  }, [onSaveLayout]);

  const handleSave = async () => {
    await onSaveLayout(currentPage ?? ({ pageType: currentPageType } as Page));
  };

  const disableSave = useMemo(() => {
    if (!currentPageType) {
      return true;
    }

    const originalPage =
      getPage(currentPageType as string) ??
      ({
        pageType: currentPageType,
      } as Page);
    const editedPage =
      currentPage ??
      ({
        pageType: currentPageType,
      } as Page);

    const jsonPatch = compare(originalPage, editedPage);

    return jsonPatch.length === 0;
  }, [currentPage, currentPageType, getPage]);

  return (
    <PageLayoutV1
      className="bg-grey"
      pageTitle={t('label.customize-entity', {
        entity: t('label.data-marketplace'),
      })}>
      <Row className="customize-details-page" gutter={[0, 20]}>
        <Col span={24}>
          <CustomizablePageHeader
            disableSave={disableSave}
            personaName={getEntityName(personaDetails)}
            onReset={handleReset}
            onSave={handleSave}
          />
        </Col>
        <Col className="p-x-md" span={24}>
          <MarketplaceGreetingBanner />
          <MarketplaceSearchBar />
        </Col>
        <CustomizeTabWidget />
      </Row>
    </PageLayoutV1>
  );
};

export default CustomizableDataMarketplacePage;

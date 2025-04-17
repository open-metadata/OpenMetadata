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

import { Col, Row } from 'antd';
import { kebabCase } from 'lodash';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '../../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import '../../../../pages/MyDataPage/my-data.less';
import { getEntityName } from '../../../../utils/EntityUtils';
import { CustomizeTabWidget } from '../../../Customization/CustomizeTabWidget/CustomizeTabWidget';
import { GlossaryHeaderWidget } from '../../../Glossary/GlossaryHeader/GlossaryHeaderWidget';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import { CustomizablePageHeader } from '../CustomizablePageHeader/CustomizablePageHeader';
import { CustomizeMyDataProps } from '../CustomizeMyData/CustomizeMyData.interface';

function CustomizeGlossaryTermDetailPage({
  personaDetails,
  onSaveLayout,
  isGlossary,
}: Readonly<CustomizeMyDataProps>) {
  const { t } = useTranslation();
  const { currentPage, currentPageType } = useCustomizeStore();

  const handleReset = useCallback(async () => {
    await onSaveLayout();
  }, []);

  const handleSave = async () => {
    await onSaveLayout({
      ...(currentPage ?? ({ pageType: currentPageType } as Page)),
    });
  };

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  if (!currentPageType) {
    return null;
  }

  return (
    <PageLayoutV1
      mainContainerClassName="p-t-0"
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
          <GlossaryHeaderWidget isGlossary={isGlossary} />
        </Col>
        {/* It will render cols inside the row */}
        <CustomizeTabWidget />
      </Row>
    </PageLayoutV1>
  );
}

export default CustomizeGlossaryTermDetailPage;

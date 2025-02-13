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

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import gridBgImg from '../../assets/img/grid-bg-img.png';
import { ReactComponent as DomainIcon } from '../../assets/svg/ic-domain.svg';
import { EntityHeader } from '../../components/Entity/EntityHeader/EntityHeader.component';
import { CustomizeTabWidget } from '../../components/Glossary/CustomiseWidgets/CustomizeTabWidget/CustomizeTabWidget';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import { CustomizeMyDataProps } from '../../components/MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { DE_ACTIVE_COLOR } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { Domain } from '../../generated/entity/domains/domain';
import { Page } from '../../generated/system/ui/page';
import { PageType } from '../../generated/system/ui/uiCustomization';
import { getDummyDataByPage } from '../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../utils/EntityUtils';
import Fqn from '../../utils/Fqn';
import { getDomainPath } from '../../utils/RouterUtils';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';

const CustomizableDomainPage = ({
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
  ) as Domain;

  const breadcrumbs = useMemo(() => {
    if (!entityDummyData.fullyQualifiedName) {
      return [];
    }

    const arr = Fqn.split(entityDummyData.fullyQualifiedName);
    const dataFQN: Array<string> = [];

    return [
      {
        name: 'Domains',
        url: getDomainPath(arr[0]),
        activeTitle: false,
      },
      ...arr.slice(0, -1).map((d) => {
        dataFQN.push(d);

        return {
          name: d,
          url: getDomainPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
          activeTitle: false,
        };
      }),
    ];
  }, [entityDummyData.fullyQualifiedName]);

  return (
    <PageLayoutV1
      mainContainerClassName="p-t-0"
      pageContainerStyle={{
        backgroundImage: `url(${gridBgImg})`,
      }}
      pageTitle={t('label.customize-entity', {
        entity: t('label.domain'),
      })}>
      <CustomizablePageHeader
        personaName={getEntityName(personaDetails)}
        onReset={handleReset}
        onSave={handleSave}
      />
      <div className="m-md">
        <EntityHeader
          breadcrumb={breadcrumbs}
          entityData={entityDummyData as Domain}
          entityType={EntityType.DOMAIN}
          icon={
            <DomainIcon
              className="align-middle"
              color={DE_ACTIVE_COLOR}
              height={36}
              name="folder"
              width={32}
            />
          }
          serviceName=""
        />
      </div>
      <CustomizeTabWidget />
    </PageLayoutV1>
  );
};

export default CustomizableDomainPage;

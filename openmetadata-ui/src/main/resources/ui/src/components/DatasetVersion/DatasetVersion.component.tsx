/*
 *  Copyright 2022 Collate.
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

import { Card, Tabs } from 'antd';
import classNames from 'classnames';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { getVersionPathWithTab } from 'constants/constants';
import { cloneDeep, toString } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityTabs, EntityType, FqnPart } from '../../enums/entity.enum';
import {
  ChangeDescription,
  Column,
  ColumnJoins,
  Table,
} from '../../generated/entity/data/table';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import {
  getColumnsDataWithVersionChanges,
  getCommonExtraInfoForVersionDetails,
  getEntityVersionDescription,
  getEntityVersionTags,
} from '../../utils/EntityVersionUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import VersionTable from '../VersionTable/VersionTable.component';
import { DatasetVersionProp } from './DatasetVersion.interface';

const DatasetVersion: React.FC<DatasetVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedTableName,
  datasetFQN,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
}: DatasetVersionProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const extraInfo = useMemo(
    () => getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
    [changeDescription, owner, tier]
  );

  const columns = useMemo(() => {
    const colList = cloneDeep((currentVersionData as Table).columns);

    return getColumnsDataWithVersionChanges<Column>(changeDescription, colList);
  }, [currentVersionData, changeDescription]);

  const handleTabChange = (activeKey: string) => {
    history.push(
      getVersionPathWithTab(
        EntityType.TABLE,
        datasetFQN,
        String(version),
        activeKey
      )
    );
  };

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')}>
          <EntityPageInfo
            isVersionSelected
            deleted={deleted}
            displayName={currentVersionData.displayName}
            entityName={currentVersionData.name ?? ''}
            extraInfo={extraInfo}
            followersList={[]}
            serviceType={currentVersionData.serviceType ?? ''}
            tags={getEntityVersionTags(currentVersionData, changeDescription)}
            tier={tier}
            titleLinks={slashedTableName}
            version={Number(version)}
            versionHandler={backHandler}
          />
          <div className="tw-mt-1 d-flex flex-col flex-grow ">
            <Tabs
              defaultActiveKey={tab ?? EntityTabs.SCHEMA}
              onChange={handleTabChange}>
              <Tabs.TabPane
                key={EntityTabs.SCHEMA}
                tab={
                  <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />
                }>
                <Card className="m-y-md">
                  <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                    <div className="tw-col-span-full">
                      <Description
                        isReadOnly
                        description={getEntityVersionDescription(
                          currentVersionData,
                          changeDescription
                        )}
                      />
                    </div>

                    <div className="tw-col-span-full">
                      <VersionTable
                        columnName={getPartialNameFromTableFQN(
                          datasetFQN,
                          [FqnPart.Column],
                          FQN_SEPARATOR_CHAR
                        )}
                        columns={columns}
                        joins={
                          (currentVersionData as Table).joins as ColumnJoins[]
                        }
                      />
                    </div>
                  </div>
                </Card>
              </Tabs.TabPane>
              <Tabs.TabPane
                key={EntityTabs.CUSTOM_PROPERTIES}
                tab={
                  <TabsLabel
                    id={EntityTabs.CUSTOM_PROPERTIES}
                    name={t('label.custom-property-plural')}
                  />
                }>
                <CustomPropertyTable
                  isVersionView
                  entityDetails={
                    currentVersionData as CustomPropertyProps['entityDetails']
                  }
                  entityType={EntityType.TABLE}
                  hasEditAccess={false}
                />
              </Tabs.TabPane>
            </Tabs>
          </div>
        </div>
      )}

      <EntityVersionTimeLine
        show
        currentVersion={toString(version)}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </PageLayoutV1>
  );
};

export default DatasetVersion;

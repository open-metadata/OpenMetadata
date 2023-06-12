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
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { cloneDeep, toString } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityTabs, FqnPart } from '../../enums/entity.enum';
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

  const tabs = [
    {
      label: t('label.schema'),
      key: EntityTabs.SCHEMA,
    },
  ];

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
            <Tabs activeKey={EntityTabs.SCHEMA} items={tabs} />
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
                    joins={(currentVersionData as Table).joins as ColumnJoins[]}
                  />
                </div>
              </div>
            </Card>
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

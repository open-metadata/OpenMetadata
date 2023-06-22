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

import { Card, Tabs, TabsProps } from 'antd';
import classNames from 'classnames';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { getVersionPathWithTab } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import {
  ChangeDescription,
  Column,
  Container,
} from 'generated/entity/data/container';
import { cloneDeep, toString } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { bytesToSize } from 'utils/StringsUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  EntityInfo,
  EntityTabs,
  EntityType,
  FqnPart,
} from '../../enums/entity.enum';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import {
  getColumnsDataWithVersionChanges,
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../utils/EntityVersionUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import VersionTable from '../VersionTable/VersionTable.component';
import { ContainerVersionProp } from './ContainerVersion.interface';

const ContainerVersion: React.FC<ContainerVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  containerFQN,
  breadCrumbList,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
}: ContainerVersionProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const extraInfo = useMemo(() => {
    const containerData = currentVersionData as Container;

    return [
      ...getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
      {
        key: EntityInfo.NUMBER_OF_OBJECTS,
        value: toString(containerData.numberOfObjects),
        showLabel: true,
      },
      {
        key: EntityInfo.SIZE,
        value: bytesToSize(containerData.size ?? 0),
        showLabel: true,
      },
    ];
  }, [currentVersionData, changeDescription, owner, tier]);

  const columns = useMemo(() => {
    const colList = cloneDeep(
      (currentVersionData as Container).dataModel?.columns
    );

    return getColumnsDataWithVersionChanges<Column>(changeDescription, colList);
  }, [currentVersionData, changeDescription]);

  const handleTabChange = (activeKey: string) => {
    history.push(
      getVersionPathWithTab(
        EntityType.CONTAINER,
        containerFQN,
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

  const tags = useMemo(() => {
    return getEntityVersionTags(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  const description = useMemo(() => {
    return getEntityVersionByField(
      currentVersionData,
      changeDescription,
      EntityField.DESCRIPTION
    );
  }, [currentVersionData, changeDescription]);

  const displayName = useMemo(() => {
    return getEntityVersionByField(
      currentVersionData,
      changeDescription,
      EntityField.DISPLAYNAME
    );
  }, [currentVersionData, changeDescription]);

  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: EntityTabs.SCHEMA,
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        children: (
          <Card className="m-y-md">
            <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
              <div className="tw-col-span-full">
                <Description isReadOnly description={description} />
              </div>

              <div className="tw-col-span-full">
                <VersionTable
                  columnName={getPartialNameFromTableFQN(
                    containerFQN,
                    [FqnPart.Column],
                    FQN_SEPARATOR_CHAR
                  )}
                  columns={columns}
                  joins={[]}
                />
              </div>
            </div>
          </Card>
        ),
      },
      {
        key: EntityTabs.CUSTOM_PROPERTIES,
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        children: (
          <CustomPropertyTable
            isVersionView
            entityDetails={
              currentVersionData as CustomPropertyProps['entityDetails']
            }
            entityType={EntityType.CONTAINER}
            hasEditAccess={false}
          />
        ),
      },
    ],
    [description, containerFQN, columns, currentVersionData]
  );

  return (
    <>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')}>
          <EntityPageInfo
            isVersionSelected
            deleted={deleted}
            displayName={displayName}
            entityName={currentVersionData.name ?? ''}
            extraInfo={extraInfo}
            followersList={[]}
            serviceType={currentVersionData.serviceType ?? ''}
            tags={tags}
            tier={undefined}
            titleLinks={breadCrumbList}
            version={version}
            versionHandler={backHandler}
          />
          <div className="tw-mt-1 d-flex flex-col flex-grow ">
            <Tabs
              defaultActiveKey={tab ?? EntityTabs.SCHEMA}
              items={tabItems}
              onChange={handleTabChange}
            />
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
    </>
  );
};

export default ContainerVersion;

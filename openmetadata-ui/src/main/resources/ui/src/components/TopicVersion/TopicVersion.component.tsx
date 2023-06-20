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

import { Card, Tabs, TabsProps } from 'antd';
import classNames from 'classnames';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TopicSchemaFields from 'components/TopicDetails/TopicSchema/TopicSchema';
import { getVersionPathWithTab } from 'constants/constants';
import { ENTITY_CARD_CLASS } from 'constants/entity.constants';
import { EntityField } from 'constants/Feeds.constants';
import { EntityInfo, EntityTabs, EntityType } from 'enums/entity.enum';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { ChangeDescription, Topic } from '../../generated/entity/data/topic';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
  getUpdatedMessageSchema,
} from '../../utils/EntityVersionUtils';
import { bytesToSize } from '../../utils/StringsUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import { TopicVersionProp } from './TopicVersion.interface';

const TopicVersion: FC<TopicVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedTopicName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
}: TopicVersionProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const extraInfo = useMemo(() => {
    const {
      partitions,
      replicationFactor,
      retentionSize,
      cleanupPolicies,
      maximumMessageSize,
    } = currentVersionData as Topic;

    return [
      ...getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
      {
        key: EntityInfo.PARTITIONS,
        value: `${partitions} ${t('label.partition-plural')}`,
      },
      ...(replicationFactor
        ? [
            {
              key: EntityInfo.REPLICATION_FACTOR,
              value: `${replicationFactor} ${t('label.replication-factor')}`,
            },
          ]
        : []),
      ...(retentionSize
        ? [
            {
              key: EntityInfo.RETENTION_SIZE,
              value: `${bytesToSize(retentionSize)}  ${t(
                'label.retention-size'
              )}`,
            },
          ]
        : []),
      ...(cleanupPolicies
        ? [
            {
              key: EntityInfo.CLEAN_UP_POLICIES,
              value: `${cleanupPolicies.join(', ')} ${t(
                'label.clean-up-policy-plural-lowercase'
              )}`,
            },
          ]
        : []),
      ...(maximumMessageSize
        ? [
            {
              key: EntityInfo.MAX_MESSAGE_SIZE,
              value: `${bytesToSize(maximumMessageSize)} ${t(
                'label.maximum-size-lowercase'
              )} `,
            },
          ]
        : []),
    ];
  }, [currentVersionData, changeDescription, owner, tier]);

  const messageSchemaDiff = useMemo(
    () => getUpdatedMessageSchema(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
  );

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  const handleTabChange = (activeKey: string) => {
    history.push(
      getVersionPathWithTab(
        EntityType.TOPIC,
        currentVersionData.fullyQualifiedName ?? '',
        String(version),
        activeKey
      )
    );
  };

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
          <Card className={ENTITY_CARD_CLASS}>
            <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
              <div className="tw-col-span-full">
                <Description isReadOnly description={description} />
              </div>
            </div>
            <TopicSchemaFields
              defaultExpandAllRows
              isReadOnly
              hasDescriptionEditAccess={false}
              hasTagEditAccess={false}
              messageSchema={messageSchemaDiff}
              showSchemaDisplayTypeSwitch={false}
            />
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
            entityType={EntityType.TOPIC}
            hasEditAccess={false}
          />
        ),
      },
    ],
    [description, messageSchemaDiff, currentVersionData]
  );

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
            displayName={displayName}
            entityName={currentVersionData.name ?? ''}
            extraInfo={extraInfo}
            followersList={[]}
            serviceType={currentVersionData.serviceType ?? ''}
            tags={tags}
            tier={{} as TagLabel}
            titleLinks={slashedTopicName}
            version={Number(version)}
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
        currentVersion={version}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </PageLayoutV1>
  );
};

export default TopicVersion;

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
import TopicSchemaFields from 'components/TopicDetails/TopicSchema/TopicSchema';
import { ENTITY_CARD_CLASS } from 'constants/entity.constants';
import { EntityInfo, EntityTabs } from 'enums/entity.enum';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import { ChangeDescription, Topic } from '../../generated/entity/data/topic';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionDescription,
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
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const tabs = [
    {
      label: t('label.schema'),
      key: EntityTabs.SCHEMA,
    },
  ];

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
            tier={{} as TagLabel}
            titleLinks={slashedTopicName}
            version={Number(version)}
            versionHandler={backHandler}
          />
          <div className="tw-mt-1 d-flex flex-col flex-grow ">
            <Tabs activeKey={EntityTabs.SCHEMA} items={tabs} />
            <Card className={ENTITY_CARD_CLASS}>
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

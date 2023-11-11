/* eslint-disable no-case-declarations */
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

import { Divider, Typography } from 'antd';
import { t } from 'i18next';
import { isEmpty, isUndefined, toString } from 'lodash';
import React from 'react';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import {
  VersionExtraInfoLabel,
  VersionExtraInfoLink,
} from '../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import { DataAssetsVersionHeaderProps } from '../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader.interface';
import { EntityField } from '../constants/Feeds.constants';
import { EntityType } from '../enums/entity.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Pipeline } from '../generated/entity/data/pipeline';
import { Topic } from '../generated/entity/data/topic';
import { ChangeDescription } from '../generated/entity/type';
import { getEntityName } from './EntityUtils';
import {
  getChangedEntityName,
  getDiffByFieldName,
  getEntityVersionByField,
} from './EntityVersionUtils';

export const getExtraInfoSourceUrl = (
  currentVersionData: Dashboard | Pipeline,
  changeDescription: ChangeDescription
) => {
  const pipelineDetails = currentVersionData as Pipeline;
  const sourceUrl = getEntityVersionByField(
    changeDescription,
    EntityField.SOURCE_URL,
    toString(pipelineDetails.sourceUrl)
  );
  const fieldDiff = getDiffByFieldName(
    EntityField.SOURCE_URL,
    changeDescription,
    true
  );
  const changedEntityName = getChangedEntityName(fieldDiff);
  if (isEmpty(sourceUrl)) {
    return null;
  }

  return (
    <>
      {isUndefined(changedEntityName) ? (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <div className="d-flex items-center text-xs">
            <Typography.Link
              href={pipelineDetails.sourceUrl}
              style={{ fontSize: '12px' }}>
              {getEntityName(pipelineDetails)}{' '}
            </Typography.Link>
            <IconExternalLink className="m-l-xss " width={14} />{' '}
          </div>
        </>
      ) : (
        <VersionExtraInfoLink
          href={pipelineDetails.sourceUrl}
          value={sourceUrl}
        />
      )}
    </>
  );
};

export const getDataAssetsVersionHeaderInfo = (
  entityType: DataAssetsVersionHeaderProps['entityType'],
  currentVersionData: DataAssetsVersionHeaderProps['currentVersionData']
) => {
  const changeDescription = currentVersionData.changeDescription ?? {};

  switch (entityType) {
    case EntityType.TOPIC:
      const topicDetails = currentVersionData as Topic;

      const partitions = getEntityVersionByField(
        changeDescription,
        EntityField.PARTITIONS,
        toString(topicDetails.partitions)
      );

      const replicationFactor = getEntityVersionByField(
        changeDescription,
        EntityField.REPLICATION_FACTOR,
        toString(topicDetails.replicationFactor)
      );

      return (
        <>
          {!isEmpty(partitions) && (
            <VersionExtraInfoLabel
              label={t('label.partition-plural')}
              value={partitions}
            />
          )}
          {!isEmpty(replicationFactor) && (
            <VersionExtraInfoLabel
              label={t('label.replication-factor')}
              value={replicationFactor}
            />
          )}
        </>
      );

    case EntityType.PIPELINE:
      return getExtraInfoSourceUrl(
        currentVersionData as Pipeline,
        changeDescription
      );

    case EntityType.DASHBOARD:
      return getExtraInfoSourceUrl(
        currentVersionData as Dashboard,
        changeDescription
      );
    default:
      return null;
  }
};

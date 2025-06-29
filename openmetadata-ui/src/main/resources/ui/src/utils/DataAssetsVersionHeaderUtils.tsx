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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Divider, Space, Typography } from 'antd';
import { isEmpty, isUndefined, toString } from 'lodash';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import { DataAssetsVersionHeaderProps } from '../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader.interface';
import { DATA_ASSET_ICON_DIMENSION } from '../constants/constants';
import { EntityField } from '../constants/Feeds.constants';
import { EntityType } from '../enums/entity.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Metric } from '../generated/entity/data/metric';
import { Pipeline } from '../generated/entity/data/pipeline';
import { Topic } from '../generated/entity/data/topic';
import { ChangeDescription } from '../generated/entity/type';
import { getEntityName } from './EntityUtils';
import {
  getChangedEntityName,
  getDiffByFieldName,
  getEntityVersionByField,
} from './EntityVersionUtils';
import { t } from './i18next/LocalUtil';
import { stringToHTML } from './StringsUtils';

export const VersionExtraInfoLink = ({
  value,
  href,
}: {
  value: string;
  href?: string;
}) => (
  <>
    <Divider className="self-center m-x-sm" type="vertical" />
    <div className="d-flex items-center text-xs">
      <Typography.Link href={href} style={{ fontSize: '12px' }}>
        {stringToHTML(value)}
      </Typography.Link>
    </div>
  </>
);

export const VersionExtraInfoLabel = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <>
    <Divider className="self-center m-x-sm" type="vertical" />
    <Space align="center">
      <Typography.Text className="self-center text-xs whitespace-nowrap">
        {!isEmpty(label) && (
          <span className="text-grey-muted">{`${label}: `}</span>
        )}
      </Typography.Text>

      <Typography.Text className="self-center text-xs whitespace-nowrap font-medium">
        {stringToHTML(value)}
      </Typography.Text>
    </Space>
  </>
);

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
            <Icon
              className="m-l-xss"
              component={IconExternalLink}
              style={DATA_ASSET_ICON_DIMENSION}
            />
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

    case EntityType.METRIC: {
      const metricDetails = currentVersionData as Metric;

      const metricType = getEntityVersionByField(
        changeDescription,
        'metricType',
        toString(metricDetails.metricType)
      );

      const unitOfMeasurement = getEntityVersionByField(
        changeDescription,
        'unitOfMeasurement',
        toString(metricDetails.unitOfMeasurement)
      );

      const granularity = getEntityVersionByField(
        changeDescription,
        'granularity',
        toString(metricDetails.granularity)
      );

      return (
        <>
          {!isEmpty(metricType) && (
            <VersionExtraInfoLabel
              label={t('label.metric-type')}
              value={metricType}
            />
          )}
          {!isEmpty(unitOfMeasurement) && (
            <VersionExtraInfoLabel
              label={t('label.unit-of-measurement')}
              value={unitOfMeasurement}
            />
          )}
          {!isEmpty(granularity) && (
            <VersionExtraInfoLabel
              label={t('label.granularity')}
              value={granularity}
            />
          )}
        </>
      );
    }
    default:
      return null;
  }
};

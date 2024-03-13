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

import { Col, Divider, Row, Typography } from 'antd';
import { get, isArray, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTeamAndUserDetailsPath } from '../../../../constants/constants';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { TagLabel, Topic } from '../../../../generated/entity/data/topic';
import { getTopicByFqn } from '../../../../rest/topicsAPI';
import {
  getFormattedEntityData,
  getSortedTagsWithHighlight,
} from '../../../../utils/EntitySummaryPanelUtils';
import { DRAWER_NAVIGATION_OPTIONS } from '../../../../utils/EntityUtils';
import { bytesToSize } from '../../../../utils/StringsUtils';
import { getConfigObject } from '../../../../utils/TopicDetailsUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import { TopicConfigObjectInterface } from '../../../Topic/TopicDetails/TopicDetails.interface';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface TopicSummaryProps {
  entityDetails: Topic;
  componentType?: string;
  tags?: TagLabel[];
  isLoading?: boolean;
  highlights?: SearchedDataProps['data'][number]['highlight'];
}

function TopicSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
  highlights,
}: TopicSummaryProps) {
  const { t } = useTranslation();

  const [topicDetails, setTopicDetails] = useState<Topic>(entityDetails);

  const isExplore = useMemo(
    () => componentType === DRAWER_NAVIGATION_OPTIONS.explore,
    [componentType]
  );
  const topicConfig = useMemo(() => {
    const combined = { ...topicDetails, ...entityDetails };
    const configs = getConfigObject(combined);

    return {
      ...configs,
      'Retention Size': bytesToSize(configs['Retention Size'] ?? 0),
      'Max Message Size': bytesToSize(configs['Max Message Size'] ?? 0),
    };
  }, [entityDetails, topicDetails]);

  const ownerDetails = useMemo(() => {
    const owner = entityDetails.owner;

    return {
      value: <OwnerLabel hasPermission={false} owner={owner} />,
      url: getTeamAndUserDetailsPath(owner?.name ?? ''),
      isLink: !isEmpty(owner?.name),
    };
  }, [entityDetails, topicDetails]);

  const fetchExtraTopicInfo = useCallback(async () => {
    try {
      const res = await getTopicByFqn(entityDetails.fullyQualifiedName ?? '', {
        fields: 'tags,owner',
      });

      const { partitions, messageSchema } = res;

      setTopicDetails({ ...entityDetails, partitions, messageSchema });
    } catch (error) {
      // Error
    }
  }, [entityDetails]);

  const formattedSchemaFieldsData: BasicEntityInfo[] = useMemo(
    () =>
      getFormattedEntityData(
        SummaryEntityType.SCHEMAFIELD,
        topicDetails.messageSchema?.schemaFields,
        highlights
      ),
    [topicDetails]
  );

  useEffect(() => {
    if (entityDetails.service?.type === 'messagingService') {
      fetchExtraTopicInfo();
    }
  }, [entityDetails, componentType]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md m-t-0" gutter={[0, 4]}>
          {!isExplore ? (
            <Col className="p-b-md" span={24}>
              {ownerDetails.isLink ? (
                <Link
                  component={Typography.Link}
                  to={{ pathname: ownerDetails.url }}>
                  {ownerDetails.value}
                </Link>
              ) : (
                <Typography.Text className="text-grey-muted">
                  {ownerDetails.value}
                </Typography.Text>
              )}
            </Col>
          ) : null}
          <Col span={24}>
            <Row gutter={[0, 4]}>
              {Object.keys(topicConfig).map((fieldName) => {
                const value =
                  topicConfig[fieldName as keyof TopicConfigObjectInterface];

                const fieldValue = isArray(value) ? value.join(', ') : value;

                return (
                  <Col key={fieldName} span={24}>
                    <Row gutter={[16, 32]}>
                      <Col data-testid={`${fieldName}-label`} span={10}>
                        <Typography.Text className="text-grey-muted">
                          {fieldName}
                        </Typography.Text>
                      </Col>
                      <Col data-testid={`${fieldName}-value`} span={14}>
                        {fieldValue ? fieldValue : '-'}
                      </Col>
                    </Row>
                  </Col>
                );
              })}
            </Row>
          </Col>
        </Row>
        <Divider className="m-y-xs" />

        <SummaryTagsDescription
          entityDetail={entityDetails}
          tags={
            tags ??
            getSortedTagsWithHighlight(
              entityDetails.tags,
              get(highlights, 'tag.name')
            )
          }
        />
        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="schema-header">
              {t('label.schema')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            {isEmpty(topicDetails?.messageSchema?.schemaFields) ? (
              <Typography.Text data-testid="no-data-message">
                <Typography.Text className="text-grey-body">
                  {t('message.no-data-available')}
                </Typography.Text>
              </Typography.Text>
            ) : (
              <SummaryList formattedEntityData={formattedSchemaFieldsData} />
            )}
          </Col>
        </Row>
      </>
    </SummaryPanelSkeleton>
  );
}

export default TopicSummary;

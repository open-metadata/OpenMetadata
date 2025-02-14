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
import { get, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { TagLabel, Topic } from '../../../../generated/entity/data/topic';
import { getTopicByFqn } from '../../../../rest/topicsAPI';
import {
  getFormattedEntityData,
  getSortedTagsWithHighlight,
} from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import CommonEntitySummaryInfo from '../CommonEntitySummaryInfo/CommonEntitySummaryInfo';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface TopicSummaryProps {
  entityDetails: Topic;
  componentType?: DRAWER_NAVIGATION_OPTIONS;
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

  const entityInfo = useMemo(
    () =>
      getEntityOverview(ExplorePageTabs.TOPICS, {
        ...topicDetails,
        ...entityDetails,
      }),
    [topicDetails, entityDetails]
  );

  const ownerDetails = useMemo(() => {
    const owners = entityDetails.owners;

    return {
      value: <OwnerLabel hasPermission={false} owners={owners} />,
    };
  }, [entityDetails, topicDetails]);

  const fetchExtraTopicInfo = useCallback(async () => {
    try {
      const res = await getTopicByFqn(entityDetails.fullyQualifiedName ?? '', {
        fields: [TabSpecificField.OWNERS, TabSpecificField.TAGS],
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
              {ownerDetails.value}
            </Col>
          ) : null}
          <Col span={24}>
            <CommonEntitySummaryInfo
              componentType={componentType}
              entityInfo={entityInfo}
            />
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

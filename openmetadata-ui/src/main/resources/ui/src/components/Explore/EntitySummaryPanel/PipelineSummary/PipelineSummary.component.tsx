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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { Pipeline, TagLabel } from '../../../../generated/entity/data/pipeline';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import SummaryPanelSkeleton from '../../../Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import CommonEntitySummaryInfo from '../CommonEntitySummaryInfo/CommonEntitySummaryInfo';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface PipelineSummaryProps {
  entityDetails: Pipeline;
  componentType?: DRAWER_NAVIGATION_OPTIONS;
  tags?: TagLabel[];
  isLoading?: boolean;
}

function PipelineSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
}: PipelineSummaryProps) {
  const { t } = useTranslation();

  const formattedTasksData: BasicEntityInfo[] = useMemo(
    () => getFormattedEntityData(SummaryEntityType.TASK, entityDetails.tasks),
    [entityDetails]
  );

  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.PIPELINES, entityDetails),
    [entityDetails]
  );

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md m-t-0" gutter={[0, 4]}>
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
          tags={tags ?? entityDetails.tags ?? []}
        />
        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="tasks-header">
              {t('label.task-plural')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <SummaryList formattedEntityData={formattedTasksData} />
          </Col>
        </Row>
      </>
    </SummaryPanelSkeleton>
  );
}

export default PipelineSummary;

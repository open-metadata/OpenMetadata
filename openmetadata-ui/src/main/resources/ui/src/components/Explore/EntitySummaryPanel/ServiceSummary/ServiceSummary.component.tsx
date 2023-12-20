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
import { Col, Divider, Row } from 'antd';
import { get } from 'lodash';
import React, { useMemo } from 'react';
import SummaryTagsDescription from '../../../../components/common/SummaryTagsDescription/SummaryTagsDescription.component';
import SummaryPanelSkeleton from '../../../../components/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import { getSortedTagsWithHighlight } from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import CommonEntitySummaryInfo from '../CommonEntitySummaryInfo/CommonEntitySummaryInfo';
import { ServiceSummaryProps } from './ServiceSummary.interface';

const ServiceSummary = ({
  type,
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
  highlights,
}: ServiceSummaryProps) => {
  const entityInfo = useMemo(
    () => getEntityOverview(type, entityDetails),
    [entityDetails]
  );

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md" gutter={[0, 4]}>
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
            getSortedTagsWithHighlight({
              tags: entityDetails.tags,
              sortTagsBasedOnGivenTagFQNs: get(
                highlights,
                'tag.name',
                [] as string[]
              ),
            }) ??
            []
          }
        />
      </>
    </SummaryPanelSkeleton>
  );
};

export default ServiceSummary;

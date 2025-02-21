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

import { Col, Divider, Row } from 'antd';
import { get, isEmpty, noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../../enums/entity.enum';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { Metric } from '../../../../generated/entity/data/metric';
import { getMetricByFqn } from '../../../../rest/metricsAPI';
import { getSortedTagsWithHighlight } from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import { GenericProvider } from '../../../Customization/GenericProvider/GenericProvider';
import MetricExpression from '../../../Metric/MetricExpression/MetricExpression';
import RelatedMetrics from '../../../Metric/RelatedMetrics/RelatedMetrics';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import CommonEntitySummaryInfo from '../CommonEntitySummaryInfo/CommonEntitySummaryInfo';

interface MetricSummaryProps {
  entityDetails: Metric;
  componentType?: DRAWER_NAVIGATION_OPTIONS;
  isLoading?: boolean;
  highlights?: SearchedDataProps['data'][number]['highlight'];
}

const MetricSummary = ({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  isLoading,
  highlights,
}: MetricSummaryProps) => {
  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.METRIC, entityDetails),
    [entityDetails]
  );

  const [metricDetails, setMetricDetails] = useState<Metric>(entityDetails);

  const ownerDetails = useMemo(() => {
    const owners = entityDetails.owners;

    return {
      value: <OwnerLabel hasPermission={false} owners={owners} />,
    };
  }, [entityDetails, metricDetails]);

  const fetchMetricDetails = useCallback(async () => {
    if (isEmpty(entityDetails.fullyQualifiedName)) {
      return;
    }

    try {
      const res = await getMetricByFqn(entityDetails.fullyQualifiedName ?? '', {
        fields: [TabSpecificField.TAGS, TabSpecificField.OWNERS],
      });

      setMetricDetails({ ...res });
    } catch (error) {
      // Error
    }
  }, [entityDetails, componentType]);

  useEffect(() => {
    fetchMetricDetails();
  }, [entityDetails, componentType]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md m-t-0" gutter={[0, 4]}>
          <Col className="p-b-md" span={24}>
            {ownerDetails.value}
          </Col>
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
          tags={getSortedTagsWithHighlight(
            entityDetails.tags,
            get(highlights, 'tag.name')
          )}
        />
        <Divider className="m-y-xs" />

        <GenericProvider<Metric>
          data={entityDetails}
          permissions={{} as OperationPermission}
          type={EntityType.METRIC}
          onUpdate={async () => {
            noop();
          }}>
          <Row className="m-md" gutter={[0, 8]}>
            <Col span={24}>
              <MetricExpression />
            </Col>
            <Divider className="m-y-xs" />
            <Col span={24}>
              <RelatedMetrics
                isInSummaryPanel
                hasEditPermission={false}
                metricDetails={entityDetails}
              />
            </Col>
          </Row>
        </GenericProvider>
      </>
    </SummaryPanelSkeleton>
  );
};

export default MetricSummary;

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

import { Col, Divider, Row, Space, Typography } from 'antd';
import classNames from 'classnames';
import SummaryTagsDescription from 'components/common/SummaryTagsDescription/SummaryTagsDescription.component';
import { ExplorePageTabs } from 'enums/Explore.enum';
import { TagLabel } from 'generated/type/tagLabel';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from 'utils/EntityUtils';
import SVGIcons from 'utils/SvgUtils';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Pipeline } from '../../../../generated/entity/data/pipeline';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import TableDataCardTitle from '../../../common/table-data-card-v2/TableDataCardTitle.component';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface PipelineSummaryProps {
  entityDetails: Pipeline;
  componentType?: string;
  tags?: (TagLabel | undefined)[];
}

function PipelineSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
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

  const isExplore = useMemo(
    () => componentType === DRAWER_NAVIGATION_OPTIONS.explore,
    [componentType]
  );

  return (
    <>
      <Row
        className={classNames({
          'm-md': isExplore,
        })}
        gutter={[0, 4]}>
        {isExplore ? (
          <Col span={24}>
            <TableDataCardTitle
              dataTestId="summary-panel-title"
              searchIndex={SearchIndex.DASHBOARD}
              source={entityDetails}
            />
          </Col>
        ) : null}

        <Col span={24}>
          <Row>
            {entityInfo.map((info) =>
              info.visible?.includes(componentType) ? (
                <Col key={info.name} span={24}>
                  <Row gutter={16}>
                    <Col
                      data-testid={
                        info.dataTestId ? info.dataTestId : `${info.name}-label`
                      }
                      span={10}>
                      <Typography.Text className="text-grey-muted">
                        {info.name}
                      </Typography.Text>
                    </Col>
                    <Col data-testid={`${info.name}-value`} span={12}>
                      {info.isLink ? (
                        <Space align="start">
                          <Typography.Link
                            data-testid="pipeline-link-name"
                            href={info.url}
                            target="_blank">
                            {info.value}
                            <SVGIcons
                              alt="external-link"
                              className="m-l-xs"
                              icon="external-link"
                              width="12px"
                            />
                          </Typography.Link>
                        </Space>
                      ) : (
                        info.value
                      )}
                    </Col>
                  </Row>
                </Col>
              ) : null
            )}
          </Row>
        </Col>
      </Row>
      <Divider className="m-y-xs" />

      {!isExplore ? (
        <>
          <SummaryTagsDescription
            entityDetail={entityDetails}
            tags={tags ? tags : []}
          />
          <Divider className="m-y-xs" />
        </>
      ) : null}

      <Row
        className={classNames({
          'm-md': isExplore,
        })}
        gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="text-base text-grey-muted"
            data-testid="tasks-header">
            {t('label.task-plural')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <SummaryList formattedEntityData={formattedTasksData} />
        </Col>
      </Row>
    </>
  );
}

export default PipelineSummary;

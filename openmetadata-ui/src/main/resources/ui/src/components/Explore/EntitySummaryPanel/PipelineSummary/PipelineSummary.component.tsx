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
import { ExplorePageTabs } from 'enums/Explore.enum';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DRAWER, getEntityOverview } from 'utils/EntityUtils';
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
}

function PipelineSummary({
  entityDetails,
  componentType = DRAWER.explore,
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
    <>
      <Row
        className={classNames({
          'm-md': componentType === DRAWER.explore,
        })}
        gutter={[0, 4]}>
        {componentType === DRAWER.explore ? (
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
                      className="text-gray"
                      data-testid={
                        info.dataTestId ? info.dataTestId : `${info.name}-label`
                      }
                      span={10}>
                      {info.name}
                    </Col>
                    <Col data-testid={`${info.name}-value`} span={12}>
                      {info.isLink ? (
                        <Link target="_blank" to={{ pathname: info.url }}>
                          <Space align="start">
                            <Typography.Text
                              className="link"
                              data-testid="pipeline-link-name">
                              {info.value}
                            </Typography.Text>
                            <SVGIcons
                              alt="external-link"
                              icon="external-link"
                              width="12px"
                            />
                          </Space>
                        </Link>
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

      <Row
        className={classNames({
          'm-md': componentType === DRAWER.explore,
        })}
        gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="section-header"
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

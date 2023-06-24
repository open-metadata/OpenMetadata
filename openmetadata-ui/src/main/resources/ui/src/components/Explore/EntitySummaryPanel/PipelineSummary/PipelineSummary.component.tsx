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
import { ReactComponent as IconExternalLink } from 'assets/svg/external-links.svg';
import classNames from 'classnames';
import SummaryTagsDescription from 'components/common/SummaryTagsDescription/SummaryTagsDescription.component';
import SummaryPanelSkeleton from 'components/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { ExplorePageTabs } from 'enums/Explore.enum';
import { TagLabel } from 'generated/type/tagLabel';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getTagValue } from 'utils/CommonUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from 'utils/EntityUtils';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { Pipeline } from '../../../../generated/entity/data/pipeline';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface PipelineSummaryProps {
  entityDetails: Pipeline;
  componentType?: string;
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

  const isExplore = useMemo(
    () => componentType === DRAWER_NAVIGATION_OPTIONS.explore,
    [componentType]
  );

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md m-t-0" gutter={[0, 4]}>
          <Col span={24}>
            <Row gutter={[0, 4]}>
              {entityInfo.map((info) => {
                const isOwner = info.name === t('label.owner');

                return info.visible?.includes(componentType) ? (
                  <Col key={info.name} span={24}>
                    <Row
                      className={classNames('', {
                        'p-b-md': isOwner,
                      })}
                      gutter={[16, 32]}>
                      {!isOwner ? (
                        <Col
                          data-testid={
                            info.dataTestId
                              ? info.dataTestId
                              : `${info.name}-label`
                          }
                          span={8}>
                          <Typography.Text className="text-grey-muted">
                            {info.name}
                          </Typography.Text>
                        </Col>
                      ) : null}
                      <Col data-testid={`${info.name}-value`} span={16}>
                        {info.isLink ? (
                          <Space align="start">
                            <Typography.Link
                              className="d-flex"
                              data-testid="pipeline-link-name"
                              href={info.url}
                              target={info.isExternal ? '_blank' : '_self'}>
                              {info.value}
                              {info.isExternal ? (
                                <IconExternalLink
                                  className="m-l-xss"
                                  width={12}
                                />
                              ) : null}
                            </Typography.Link>
                          </Space>
                        ) : (
                          <Typography.Text
                            className={classNames('text-grey-muted', {
                              'text-grey-body': !isOwner,
                            })}>
                            {info.value}
                          </Typography.Text>
                        )}
                      </Col>
                    </Row>
                  </Col>
                ) : null;
              })}
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
        ) : (
          <>
            <Row className="m-md" gutter={[0, 8]}>
              <Col span={24}>
                <Typography.Text
                  className="summary-panel-section-title"
                  data-testid="profiler-header">
                  {t('label.tag-plural')}
                </Typography.Text>
              </Col>

              <Col className="flex-grow" span={24}>
                {entityDetails.tags && entityDetails.tags.length > 0 ? (
                  <TagsViewer
                    sizeCap={2}
                    tags={(entityDetails.tags || []).map((tag) =>
                      getTagValue(tag)
                    )}
                    type="border"
                  />
                ) : (
                  <Typography.Text className="text-grey-body">
                    {t('label.no-tags-added')}
                  </Typography.Text>
                )}
              </Col>
            </Row>
            <Divider className="m-y-xs" />
          </>
        )}

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

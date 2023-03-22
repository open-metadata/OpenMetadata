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
import classNames from 'classnames';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import SummaryPanelSkeleton from 'components/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import { SummaryEntityType } from 'enums/EntitySummary.enum';
import { ExplorePageTabs } from 'enums/Explore.enum';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFormattedEntityData } from 'utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from 'utils/EntityUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { EntitySummaryComponentProps } from '../EntitySummaryPanel.interface';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

function GlossaryTermSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  isLoading,
}: EntitySummaryComponentProps) {
  const { t } = useTranslation();
  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.GLOSSARY, entityDetails),
    [entityDetails]
  );

  const formattedColumnsData: BasicEntityInfo[] = useMemo(
    () =>
      getFormattedEntityData(
        SummaryEntityType.COLUMN,
        (entityDetails as GlossaryTerm).children
      ),
    [entityDetails]
  );

  const reviewers = useMemo(
    () => (entityDetails as GlossaryTerm).reviewers || [],
    [entityDetails]
  );

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md" gutter={[0, 4]}>
          <Col span={24}>
            <Row>
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
                        <Col data-testid={`${info.name}-label`} span={10}>
                          <Typography.Text className="text-grey-muted">
                            {info.name}
                          </Typography.Text>
                        </Col>
                      ) : null}
                      <Col data-testid={`${info.name}-value`} span={14}>
                        {info.isIcon ? (
                          <SVGIcons
                            alt="glossary-term-icon"
                            className="h-4 w-4"
                            icon={
                              info.value ? Icons.CHECK_CIRCLE : Icons.FAIL_BADGE
                            }
                            width="12px"
                          />
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
        <Row className="m-md" gutter={[0, 16]}>
          <Col span={24}>
            <Typography.Text
              className="text-base text-grey-muted"
              data-testid="reviewer-header">
              {t('label.reviewer-plural')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            {reviewers.length > 0 ? (
              <div className="d-flex flex-wrap">
                {reviewers.map((assignee) => (
                  <>
                    <span className="d-flex tw-m-1.5 tw-mt-0 tw-cursor-pointer">
                      <ProfilePicture
                        id=""
                        name={assignee.name || ''}
                        width="20"
                      />
                      <span className="tw-self-center tw-ml-2">
                        {assignee?.displayName || assignee?.name}
                      </span>
                    </span>
                  </>
                ))}
              </div>
            ) : (
              <Typography.Text
                className="text-grey-body"
                data-testid="no-reviewer-header">
                {t('label.no-reviewer')}
              </Typography.Text>
            )}
          </Col>
        </Row>

        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 16]}>
          <Col span={24}>
            <Typography.Text
              className="text-base text-grey-muted"
              data-testid="children-header">
              {t('label.children')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <SummaryList
              entityType={SummaryEntityType.COLUMN}
              formattedEntityData={formattedColumnsData}
            />
          </Col>
        </Row>
      </>
    </SummaryPanelSkeleton>
  );
}

export default GlossaryTermSummary;

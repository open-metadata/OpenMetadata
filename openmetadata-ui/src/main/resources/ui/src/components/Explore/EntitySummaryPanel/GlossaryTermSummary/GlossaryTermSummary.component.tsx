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

import { Col, Divider, Row, Tag, Typography } from 'antd';
import { AxiosError } from 'axios';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import SummaryPanelSkeleton from 'components/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import { SummaryEntityType } from 'enums/EntitySummary.enum';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getGlossaryTermByFQN } from 'rest/glossaryAPI';
import { getFormattedEntityData } from 'utils/EntitySummaryPanelUtils';
import { showErrorToast } from 'utils/ToastUtils';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';
import { GlossaryTermSummaryProps } from './GlossaryTermSummary.interface';

function GlossaryTermSummary({
  entityDetails,
  isLoading,
}: GlossaryTermSummaryProps) {
  const { t } = useTranslation();
  const [selectedData, setSelectedData] = useState<GlossaryTerm>();

  const formattedColumnsData: BasicEntityInfo[] = useMemo(() => {
    if (selectedData?.children) {
      return getFormattedEntityData(
        SummaryEntityType.COLUMN,
        (selectedData as GlossaryTerm).children
      );
    } else {
      return [];
    }
  }, [selectedData]);

  const reviewers = useMemo(
    () => (entityDetails as GlossaryTerm).reviewers || [],
    [selectedData]
  );

  const synonyms = useMemo(
    () => (entityDetails as GlossaryTerm).synonyms || [],
    [selectedData]
  );

  const fetchGlossaryTermDetails = useCallback(async () => {
    try {
      const response = await getGlossaryTermByFQN(
        entityDetails.fullyQualifiedName,
        'relatedTerms,reviewers,tags,owner,children'
      );
      setSelectedData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [entityDetails.fullyQualifiedName, setSelectedData]);

  useEffect(() => {
    fetchGlossaryTermDetails();
  }, [entityDetails]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
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
                    <span
                      className="d-flex tw-m-1.5 tw-mt-0 tw-cursor-pointer"
                      key={assignee.fullyQualifiedName}>
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
              data-testid="synonyms-header">
              {t('label.synonym-plural')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            {synonyms.length > 0 ? (
              <div className="d-flex flex-wrap">
                {synonyms.map((synonym) => (
                  <>
                    <Tag className="text-grey-body">{synonym}</Tag>
                  </>
                ))}
              </div>
            ) : (
              <Typography.Text
                className="text-grey-body"
                data-testid="no-synonyms-available-header">
                {t('message.no-synonyms-available')}
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

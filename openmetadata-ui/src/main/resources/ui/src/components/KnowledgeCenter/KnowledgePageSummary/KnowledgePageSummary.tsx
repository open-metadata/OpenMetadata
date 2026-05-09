/*
 *  Copyright 2026 Collate.
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
import { isEmpty } from 'lodash';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import SummaryTagsDescription from '../../../components/common/SummaryTagsDescription/SummaryTagsDescription.component';
import CommonEntitySummaryInfo from '../../../components/Explore/EntitySummaryPanel/CommonEntitySummaryInfo/CommonEntitySummaryInfo';
import { EntityUnion } from '../../../components/Explore/ExplorePage.interface';
import {
  KnowledgePage,
  PageType,
  QuickLink,
} from '../../../interface/knowledge-center.interface';

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import SummaryPanelSkeleton from '../../../components/common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import { DRAWER_NAVIGATION_OPTIONS } from '../../../utils/EntityUtils';
import i18n, { t } from '../../../utils/i18next/LocalUtil';
import RelatedDataAssets from '../RelatedDataAssets/RelatedDataAssets';

const KnowledgePageSummary = ({
  entityDetails,
}: {
  entityDetails: KnowledgePage;
}) => {
  const entityInfo = useMemo(() => {
    const owners = entityDetails?.owners ?? [];

    return [
      {
        name: i18n.t('label.owner-plural'),
        value: <OwnerLabel hasPermission={false} owners={owners} />,
      },
    ];
  }, [entityDetails]);

  const isQuickLink = entityDetails?.pageType === PageType.QUICK_LINK;

  const quickLinkData = isQuickLink
    ? (entityDetails.page as QuickLink)
    : undefined;

  return (
    <SummaryPanelSkeleton loading={isEmpty(entityDetails)}>
      <>
        <Row className="m-x-md m-t-0" gutter={[0, 4]}>
          <Col span={24}>
            <CommonEntitySummaryInfo
              componentType={DRAWER_NAVIGATION_OPTIONS.explore}
              entityInfo={entityInfo}
            />
          </Col>
        </Row>
        {quickLinkData?.url && (
          <>
            <Row
              className="m-x-md m-t-xs"
              data-testid="quick-link-data"
              gutter={[0, 8]}>
              <Col span={24}>
                <Typography.Text
                  className="summary-panel-section-title"
                  data-testid="tags-header">
                  {t('label.link')}
                </Typography.Text>
              </Col>
              <Col span={24}>
                <Link
                  className="text-primary"
                  target="_blank"
                  to={quickLinkData.url}>
                  {quickLinkData.url}
                </Link>
              </Col>
            </Row>
            <Divider className="m-y-xs" />
          </>
        )}

        <SummaryTagsDescription
          entityDetail={entityDetails as EntityUnion}
          tags={entityDetails?.tags ?? []}
        />
        <Divider className="m-y-xs" />
        {/* read only data assets */}
        <Row className="m-x-md" gutter={[0, 8]}>
          <Col>
            <RelatedDataAssets
              hasPermission={false}
              relatedDataAssets={entityDetails.relatedEntities ?? []}
            />
          </Col>
        </Row>
      </>
    </SummaryPanelSkeleton>
  );
};

export default KnowledgePageSummary;

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
import SummaryTagsDescription from 'components/common/SummaryTagsDescription/SummaryTagsDescription.component';
import { ExplorePageTabs } from 'enums/Explore.enum';
import { TagLabel } from 'generated/type/tagLabel';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from 'utils/EntityUtils';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { Mlmodel } from '../../../../generated/entity/data/mlmodel';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface MlModelSummaryProps {
  entityDetails: Mlmodel;
  componentType?: string;
  tags?: (TagLabel | undefined)[];
}

function MlModelSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
}: MlModelSummaryProps) {
  const { t } = useTranslation();

  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.MLMODELS, entityDetails),
    [entityDetails]
  );

  const formattedFeaturesData: BasicEntityInfo[] = useMemo(
    () =>
      getFormattedEntityData(
        SummaryEntityType.MLFEATURE,
        entityDetails.mlFeatures
      ),
    [entityDetails]
  );

  const isExplore = useMemo(
    () => componentType === DRAWER_NAVIGATION_OPTIONS.explore,
    [componentType]
  );

  return (
    <>
      <Row className="m-md" gutter={[0, 4]}>
        <Col span={24}>
          <Row>
            {entityInfo.map((info) =>
              info.visible?.includes(componentType) ? (
                <Col key={info.name} span={24}>
                  <Row gutter={16}>
                    <Col data-testid={`${info.name}-label`} span={10}>
                      <Typography.Text className="text-grey-muted">
                        {info.name}
                      </Typography.Text>
                    </Col>
                    <Col data-testid={`${info.name}-value`} span={12}>
                      {info.isLink ? (
                        <Link
                          target={info.isExternal ? '_blank' : '_self'}
                          to={{ pathname: info.url }}>
                          {info.value}
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

      {!isExplore ? (
        <>
          <SummaryTagsDescription
            entityDetail={entityDetails}
            tags={tags ? tags : []}
          />
          <Divider className="m-y-xs" />
        </>
      ) : null}

      <Row className="m-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="text-base text-grey-muted"
            data-testid="features-header">
            {t('label.feature-plural')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <SummaryList formattedEntityData={formattedFeaturesData} />
        </Col>
      </Row>
    </>
  );
}

export default MlModelSummary;

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

import { Col, Divider, Row, Typography } from 'antd';
import { get, isObject } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../../enums/codemirror.enum';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { StoredProcedureCodeObject } from '../../../../generated/entity/data/storedProcedure';
import { getSortedTagsWithHighlight } from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import SchemaEditor from '../../../SchemaEditor/SchemaEditor';
import SummaryPanelSkeleton from '../../../Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import CommonEntitySummaryInfo from '../CommonEntitySummaryInfo/CommonEntitySummaryInfo';
import { StoredProcedureSummaryProps } from './StoredProcedureSummary.interface';

const StoredProcedureSummary = ({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
  highlights,
}: StoredProcedureSummaryProps) => {
  const { t } = useTranslation();

  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.STORED_PROCEDURE, entityDetails),
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
              sortTagsBasedOnGivenTagFQNs: get(highlights, 'tag.name', []),
            }) ??
            []
          }
        />
        <Divider className="m-y-xs" />

        {isObject(entityDetails.storedProcedureCode) && (
          <Row className="m-md" gutter={[0, 8]}>
            <Col span={24}>
              <Typography.Text
                className="text-base text-grey-muted"
                data-testid="column-header">
                {t('label.code')}
              </Typography.Text>
            </Col>
            <Col span={24}>
              <SchemaEditor
                editorClass="custom-code-mirror-theme custom-query-editor"
                mode={{ name: CSMode.SQL }}
                options={{
                  styleActiveLine: false,
                  readOnly: 'nocursor',
                }}
                value={
                  (
                    entityDetails.storedProcedureCode as StoredProcedureCodeObject
                  ).code ?? ''
                }
              />
            </Col>
          </Row>
        )}
      </>
    </SummaryPanelSkeleton>
  );
};

export default StoredProcedureSummary;

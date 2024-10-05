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

import { Col, Row, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../../enums/search.enum';
import { searchData } from '../../../../rest/miscAPI';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import TableDataCardV2 from '../../../common/TableDataCardV2/TableDataCardV2';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import { EntityUnion } from '../../ExplorePage.interface';
import { TagsSummaryProps } from './TagsSummary.interface';

function TagsSummary({ entityDetails, isLoading }: TagsSummaryProps) {
  const { t } = useTranslation();
  const [selectedData, setSelectedData] = useState<EntityUnion[]>([]);

  const fetchTagAssetsDetails = useCallback(async () => {
    try {
      const query = `tags.tagFQN:"${entityDetails.fullyQualifiedName}"`;
      const res = await searchData('', 1, 100, query, '', '', [
        SearchIndex.TABLE,
        SearchIndex.TOPIC,
        SearchIndex.DASHBOARD,
        SearchIndex.CONTAINER,
        SearchIndex.GLOSSARY_TERM,
        SearchIndex.MLMODEL,
        SearchIndex.PIPELINE,
        SearchIndex.STORED_PROCEDURE,
        SearchIndex.DASHBOARD_DATA_MODEL,
      ]);
      const sources = res.data.hits.hits.map((hit) => hit._source);
      setSelectedData(sources);
    } catch (error) {
      // Error
    }
  }, [entityDetails.fullyQualifiedName, setSelectedData]);

  const usageItems = useMemo(() => {
    return selectedData.map((entity, index) => {
      return (
        <>
          <div className="mb-2">
            <TableDataCardV2
              id={`tabledatacardtest${index}`}
              source={entity as SourceType}
            />
          </div>
        </>
      );
    });
  }, [selectedData]);

  useEffect(() => {
    fetchTagAssetsDetails();
  }, [entityDetails]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <Row className="m-md m-t-0" gutter={[0, 8]}>
        <Col span={24}>
          <Typography.Text
            className="summary-panel-section-title"
            data-testid="usage-header">
            {t('label.usage')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          {selectedData.length > 0 ? (
            <div className="">{usageItems}</div>
          ) : (
            <Typography.Text
              className="text-grey-body"
              data-testid="no-reference-available">
              {t('label.no-entity', {
                entity: t('label.usage'),
              })}
            </Typography.Text>
          )}
        </Col>
      </Row>
    </SummaryPanelSkeleton>
  );
}

export default TagsSummary;

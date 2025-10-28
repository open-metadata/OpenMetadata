/*
 *  Copyright 2025 Collate.
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

import { Button, Typography } from 'antd';
import { capitalize } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DownstreamIcon } from '../../../../assets/svg/downstream.svg';
import { ReactComponent as NoDataIcon } from '../../../../assets/svg/ic-task-empty.svg';
import { ReactComponent as UpstreamIcon } from '../../../../assets/svg/upstream.svg';
import {
  LineageData,
  LineageEntityReference,
} from '../../../../components/Lineage/Lineage.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { getServiceLogo } from '../../../../utils/CommonUtils';
import { getUpstreamDownstreamNodesEdges } from '../../../../utils/EntityLineageUtils';
import ErrorPlaceHolderNew from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';

interface LineageTabContentProps {
  entityFqn: string;
  filter: 'upstream' | 'downstream';
  lineageData: LineageData;
  onFilterChange: (filter: 'upstream' | 'downstream') => void;
}

const LineageTabContent: React.FC<LineageTabContentProps> = ({
  lineageData,
  entityFqn,
  filter,
  onFilterChange,
}) => {
  const { t } = useTranslation();

  // Get upstream and downstream nodes using the utility function
  const { upstreamNodes, downstreamNodes } = getUpstreamDownstreamNodesEdges(
    [
      ...Object.values(lineageData.downstreamEdges || {}),
      ...Object.values(lineageData.upstreamEdges || {}),
    ],
    Object.values(lineageData.nodes || {}).map((nodeData) => nodeData.entity),
    entityFqn
  );

  // Calculate counts for each filter
  const upstreamCount = upstreamNodes.length;
  const downstreamCount = downstreamNodes.length;

  // Get filtered lineage items
  const getFilteredLineageItems = () => {
    const items: Array<{
      entity: LineageEntityReference;
      direction: 'upstream' | 'downstream';
      path: string;
    }> = [];

    // Add upstream items
    if (filter === 'upstream') {
      upstreamNodes.forEach((entity) => {
        if (entity.fullyQualifiedName !== entityFqn) {
          const pathParts = entity.fullyQualifiedName?.split('.') || [];
          const path = pathParts.slice(0, -1).join(' / ');
          items.push({
            entity,
            direction: 'upstream',
            path,
          });
        }
      });
    }

    // Add downstream items
    if (filter === 'downstream') {
      downstreamNodes.forEach((entity) => {
        if (entity.fullyQualifiedName !== entityFqn) {
          const pathParts = entity.fullyQualifiedName?.split('.') || [];
          const path = pathParts.slice(0, -1).join(' / ');
          items.push({
            entity,
            direction: 'downstream',
            path,
          });
        }
      });
    }

    return items;
  };

  const lineageItems = getFilteredLineageItems();

  return (
    <div className="lineage-tab-content">
      <div className="lineage-filter-buttons">
        <Button
          className={`lineage-filter-button ${
            filter === 'upstream' ? 'active' : ''
          }`}
          size="small"
          onClick={() => onFilterChange('upstream')}>
          {t('label.upstream')}
          <span
            className={`lineage-filter-button-count ${
              filter === 'upstream' ? 'active' : ''
            }`}>
            {upstreamCount}
          </span>
        </Button>
        <Button
          className={`lineage-filter-button ${
            filter === 'downstream' ? 'active' : ''
          }`}
          size="small"
          onClick={() => onFilterChange('downstream')}>
          {t('label.downstream')}
          <span
            className={`lineage-filter-button-count ${
              filter === 'downstream' ? 'active' : ''
            }`}>
            {downstreamCount}
          </span>
        </Button>
      </div>

      {/* Lineage Items */}
      <div className="lineage-items-list">
        {lineageItems.length > 0 ? (
          lineageItems.map((item, index) => (
            <div
              className="lineage-item-card"
              key={`${item.entity.id}-${index}`}>
              <div className="lineage-item-header">
                <div className="service-icon">
                  {getServiceLogo(
                    capitalize(item.entity.serviceType) ?? '',
                    'service-icon-lineage'
                  )}
                </div>
                <div className="lineage-item-direction">
                  {item.direction === 'upstream' ? (
                    <UpstreamIcon />
                  ) : (
                    <DownstreamIcon />
                  )}
                  <Typography.Text className="item-direction-text">
                    {item.direction === 'upstream'
                      ? `${t('label.upstream')}`
                      : `${t('label.downstream')}`}
                  </Typography.Text>
                </div>
              </div>
              <div className="lineage-card-content p-x-sm p-y-md">
                <div className="item-path-container">
                  {item.path && (
                    <Typography.Text className="item-path-text">
                      {item.path}
                    </Typography.Text>
                  )}
                </div>
                <Typography.Text className="item-name-text">
                  {item.entity.displayName || item.entity.name}
                </Typography.Text>
              </div>
            </div>
          ))
        ) : (
          <ErrorPlaceHolderNew
            icon={<NoDataIcon height={140} width={140} />}
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            <Typography.Paragraph className="text-center text-grey-muted m-t-sm">
              {t('label.no-data-found')}
            </Typography.Paragraph>
          </ErrorPlaceHolderNew>
        )}
      </div>
    </div>
  );
};

export default LineageTabContent;

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
import { ReactComponent as NoDataIcon } from '../../../../assets/svg/ic-task-empty.svg';
import { ReactComponent as DownstreamIcon } from '../../../../assets/svg/lineage-downstream-icon.svg';
import { ReactComponent as UpstreamIcon } from '../../../../assets/svg/lineage-upstream-icon.svg';
import { LineageData } from '../../../../components/Lineage/Lineage.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../generated/api/tests/createTestDefinition';
import { EntityReference } from '../../../../generated/entity/type';
import { getServiceLogo } from '../../../../utils/CommonUtils';
import { getUpstreamDownstreamNodesEdges } from '../../../../utils/EntityLineageUtils';
import { FormattedDatabaseServiceType } from '../../../../utils/EntityUtils.interface';
import searchClassBase from '../../../../utils/SearchClassBase';
import ErrorPlaceHolderNew from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import { NoOwnerFound } from '../../../common/NoOwner/NoOwnerFound';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import './LineageTabContent.less';
interface LineageTabContentProps {
  entityFqn: string;
  filter: 'upstream' | 'downstream';
  lineageData: LineageData;
  onFilterChange: (filter: 'upstream' | 'downstream') => void;
}

// Function to truncate path with ellipsis in the middle
const getTruncatedPath = (path: string) => {
  if (!path) {
    return path;
  }

  const parts = path.split(' > ');

  // If there are more than 2 parts, show first ... last
  if (parts.length > 2) {
    const firstPart = parts[0];
    const lastPart = parts[parts.length - 1];

    return `${firstPart} > ... > ${lastPart}`;
  }

  return path;
};
const BULLET_SEPARATOR = '•';
const LineageTabContent: React.FC<LineageTabContentProps> = ({
  lineageData,
  entityFqn,
  filter,
  onFilterChange,
}) => {
  const { t } = useTranslation();

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
      entity: EntityReference & {
        serviceType?: FormattedDatabaseServiceType;
        entityType?: EntityType;
        owners?: EntityReference[];
      };
      direction: 'upstream' | 'downstream';
      path: string;
      owners?: EntityReference[];
    }> = [];

    // Add upstream items
    if (filter === 'upstream') {
      for (const entity of upstreamNodes) {
        if (entity.fullyQualifiedName !== entityFqn) {
          const pathParts = entity.fullyQualifiedName?.split('.') || [];
          const path = pathParts.slice(0, -1).join(' > ');
          // Get owners from the node data if available
          const nodeData = lineageData.nodes?.[entity.id];
          const owners = (
            nodeData?.entity as EntityReference & {
              owners?: EntityReference[];
            }
          )?.owners;
          items.push({
            entity,
            direction: 'upstream',
            path,
            owners,
          });
        }
      }
    }

    // Add downstream items
    if (filter === 'downstream') {
      for (const entity of downstreamNodes) {
        if (entity.fullyQualifiedName !== entityFqn) {
          const pathParts = entity.fullyQualifiedName?.split('.') || [];
          const path = pathParts.slice(0, -1).join(' > ');
          // Get owners from the node data if available
          const nodeData = lineageData.nodes?.[entity.id];
          const owners = (
            nodeData?.entity as EntityReference & {
              owners?: EntityReference[];
            }
          )?.owners;
          items.push({
            entity,
            direction: 'downstream',
            path,
            owners,
          });
        }
      }
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
          lineageItems.map((item) => (
            <div
              className="lineage-item-card"
              key={
                item.entity.id ||
                item.entity.fullyQualifiedName ||
                `${item.direction}-${item.path}`
              }>
              <div className="lineage-item-header">
                <div className="d-flex align-items-center gap-1">
                  <div className="service-icon">
                    {getServiceLogo(
                      capitalize(item.entity.serviceType) ?? '',
                      'service-icon-lineage'
                    )}
                  </div>
                  <div className="item-path-container">
                    {item.path && (
                      <Typography.Text
                        className="item-path-text"
                        title={item.path}>
                        {getTruncatedPath(item.path)}
                      </Typography.Text>
                    )}
                  </div>
                </div>
                <div className="lineage-item-direction">
                  {item.direction === 'upstream' ? (
                    <UpstreamIcon />
                  ) : (
                    <DownstreamIcon />
                  )}
                </div>
              </div>
              <div className="lineage-card-content">
                <Typography.Text className="item-name-text">
                  {item.entity.displayName || item.entity.name}
                </Typography.Text>
                <div className="d-flex align-items-center gap-1 lineage-info-container">
                  {item.entity.entityType && (
                    <>
                      {searchClassBase.getEntityIcon(
                        item.entity.entityType ?? ''
                      ) && (
                        <span className="w-4 d-inline-flex align-middle entity-type-icon">
                          {searchClassBase.getEntityIcon(
                            item.entity.entityType ?? ''
                          )}
                        </span>
                      )}
                      <Typography.Text className="item-entity-type-text">
                        {capitalize(item.entity.entityType)}
                      </Typography.Text>
                    </>
                  )}
                  <span className="item-bullet-separator">
                    {BULLET_SEPARATOR}
                  </span>
                  {item.entity.owners && item.entity.owners.length > 0 ? (
                    <OwnerLabel
                      isCompactView
                      avatarSize={16}
                      className="item-owner-label-text"
                      owners={item.entity.owners}
                      showLabel={false}
                    />
                  ) : (
                    <NoOwnerFound
                      isCompactView
                      showLabel
                      className="item-owner-label-text"
                      multiple={{ user: false, team: false }}
                      owners={[]}
                      showDashPlaceholder={false}
                    />
                  )}
                </div>
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

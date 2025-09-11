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

import { Button, Card, Typography } from 'antd';
import { get } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLinkOutlined } from '../../../assets/svg/redirect-icon.svg';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityLinkFromType,
} from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { stringToHTML } from '../../../utils/StringsUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import EntityDetailsSection from '../../common/EntityDetailsSection/EntityDetailsSection';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { DataAssetSummaryPanel } from '../../DataAssetSummaryPanel/DataAssetSummaryPanel';
import { DataAssetSummaryPanelV1 } from '../../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1';
import EntityRightPanelVerticalNav, {
  EntityRightPanelTab,
} from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import './entity-summary-panel.less';
import { EntitySummaryPanelProps } from './EntitySummaryPanel.interface';

export default function EntitySummaryPanel({
  entityDetails,
  highlights,
}: EntitySummaryPanelProps) {
  const { tab } = useRequiredParams<{ tab: string }>();
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();
  const [isPermissionLoading, setIsPermissionLoading] =
    useState<boolean>(false);
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [activeTab, setActiveTab] = useState<EntityRightPanelTab>(
    EntityRightPanelTab.OVERVIEW
  );

  const id = useMemo(() => {
    setIsPermissionLoading(true);

    return entityDetails?.details?.id ?? '';
  }, [entityDetails?.details?.id]);

  const fetchResourcePermission = async (entityFqn: string) => {
    try {
      setIsPermissionLoading(true);
      const type = (get(entityDetails, 'details.entityType') ??
        ResourceEntity.TABLE) as ResourceEntity;
      const permissions = await getEntityPermission(type, entityFqn);
      setEntityPermissions(permissions);
    } catch {
      // Error
    } finally {
      setIsPermissionLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchResourcePermission(id);
    }
  }, [id]);

  const viewPermission = useMemo(
    () => entityPermissions.ViewBasic || entityPermissions.ViewAll,
    [entityPermissions]
  );

  const summaryComponent = useMemo(() => {
    if (isPermissionLoading) {
      return <Loader />;
    }
    if (!viewPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none h-min-80"
          permissionValue={t('label.view-entity', {
            entity: t('label.data-asset'),
          })}
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }
    const type = (get(entityDetails, 'details.entityType') ??
      EntityType.TABLE) as EntityType;
    const entity = entityDetails.details;

    return (
      <DataAssetSummaryPanel
        componentType={
          tab === DRAWER_NAVIGATION_OPTIONS.lineage
            ? tab
            : DRAWER_NAVIGATION_OPTIONS.explore
        }
        dataAsset={
          entity as SearchedDataProps['data'][number]['_source'] & {
            dataProducts: DataProduct[];
          }
        }
        entityType={type}
        highlights={highlights}
      />
    );
  }, [tab, entityDetails, viewPermission, isPermissionLoading]);

  const summaryComponentV1 = useMemo(() => {
    if (isPermissionLoading) {
      return <Loader />;
    }
    if (!viewPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none h-min-80"
          permissionValue={t('label.view-entity', {
            entity: t('label.data-asset'),
          })}
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }
    const type = (get(entityDetails, 'details.entityType') ??
      EntityType.TABLE) as EntityType;
    const entity = entityDetails.details;

    return (
      <DataAssetSummaryPanelV1
        componentType={
          tab === DRAWER_NAVIGATION_OPTIONS.lineage
            ? tab
            : DRAWER_NAVIGATION_OPTIONS.explore
        }
        dataAsset={
          entity as SearchedDataProps['data'][number]['_source'] & {
            dataProducts: DataProduct[];
          }
        }
        entityType={type}
        highlights={highlights}
      />
    );
  }, [tab, entityDetails, viewPermission, isPermissionLoading]);
  const entityLink = useMemo(
    () => searchClassBase.getEntityLink(entityDetails.details),
    [entityDetails, getEntityLinkFromType]
  );
  const entityIcon = useMemo(() => {
    return (
      <span className="w-6 h-4 m-r-xs d-inline-flex text-xl align-middle entity-icon">
        {searchClassBase.getEntityIcon(
          get(entityDetails, 'details.entityType') ?? ''
        )}
      </span>
    );
  }, [entityDetails]);

  const handleTabChange = (tab: EntityRightPanelTab) => {
    setActiveTab(tab);
  };

  const entityType = (get(entityDetails, 'details.entityType') ??
    EntityType.TABLE) as EntityType;

  const renderTabContent = () => {
    switch (activeTab) {
      case EntityRightPanelTab.OVERVIEW:
        return (
          <div style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            {summaryComponentV1}
          </div>
        );
      case EntityRightPanelTab.SCHEMA:
        return (
          <div className="entity-summary-panel-tab-content">
            <EntityDetailsSection
              dataAsset={entityDetails.details}
              entityType={entityType}
              highlights={highlights}
              isLoading={isPermissionLoading}
            />
          </div>
        );
      case EntityRightPanelTab.LINEAGE:
        return (
          <div className="entity-summary-panel-tab-content">
            <div className="text-center text-grey-muted p-lg">
              {t('message.lineage-content-placeholder')}
            </div>
          </div>
        );
      case EntityRightPanelTab.DATA_QUALITY:
        return (
          <div className="entity-summary-panel-tab-content">
            <div className="text-center text-grey-muted p-lg">
              {t('message.data-quality-content-placeholder')}
            </div>
          </div>
        );
      case EntityRightPanelTab.CUSTOM_PROPERTIES:
        return (
          <div className="entity-summary-panel-tab-content">
            <div className="text-center text-grey-muted p-lg">
              {t('message.custom-properties-content-placeholder')}
            </div>
          </div>
        );
      default:
        return summaryComponent;
    }
  };

  return (
    <div className="entity-summary-panel-container">
      {viewPermission && (
        <div className="title-container">
          <Link
            className="entity-title-link"
            data-testid="entity-link"
            target={searchClassBase.getSearchEntityLinkTarget(
              entityDetails.details
            )}
            to={entityLink}
          >
            <Typography.Text style={{ fontSize: '13px', fontWeight: 700 }}>
              {entityIcon}
              {stringToHTML(
                searchClassBase.getEntityName(entityDetails.details)
              )}
            </Typography.Text>
          </Link>
          <div style={{ paddingRight: '16px' }}>
            <Button
              className="entity-redirect-button"
              icon={<IconExternalLinkOutlined />}
              size="small"
              type="text"
              onClick={() => {
                const target = searchClassBase.getSearchEntityLinkTarget(
                  entityDetails.details
                );
                if (target === '_blank') {
                  window.open(entityLink as string, '_blank');
                } else {
                  window.open(entityLink as string, '_blank');
                }
              }}
            />
          </div>
        </div>
      )}
      <div>
        <Card
          className="summary-panel-container"
          style={{
            borderRadius: '0px',
            display: 'flex',
          }}
        >
          <div style={{ paddingTop: '16px', width: '100%' }}>
            {renderTabContent()}
          </div>
          <EntityRightPanelVerticalNav
            activeTab={activeTab}
            entityType={entityType}
            onTabChange={handleTabChange}
          />
        </Card>
      </div>
    </div>
  );
}

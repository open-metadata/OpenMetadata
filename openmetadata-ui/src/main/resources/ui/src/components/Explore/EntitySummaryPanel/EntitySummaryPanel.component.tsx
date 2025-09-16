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
import { AxiosError } from 'axios';
import { get } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getDashboardByFqn } from '../../../rest/dashboardAPI';
import { getDatabaseDetailsByFQN } from '../../../rest/databaseAPI';
import { getDataModelByFqn } from '../../../rest/dataModelsAPI';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { getMlModelByFQN } from '../../../rest/mlModelAPI';
import { getPipelineByFqn } from '../../../rest/pipelineAPI';
import { getSearchIndexDetailsByFQN } from '../../../rest/SearchIndexAPI';
import { getStoredProceduresByFqn } from '../../../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import { getTopicByFqn } from '../../../rest/topicsAPI';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityLinkFromType,
} from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { stringToHTML } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
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
import DataQualityTab from './DataQualityTab/DataQualityTab';
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
  const [entityData, setEntityData] = useState<any>(null);
  const [entityTypeDetail, setEntityTypeDetail] = useState<any>(null);
  const [isEntityDataLoading, setIsEntityDataLoading] = useState(false);

  const id = useMemo(() => {
    setIsPermissionLoading(true);

    return entityDetails?.details?.id ?? '';
  }, [entityDetails?.details?.id]);

  const entityType = useMemo(() => {
    return get(entityDetails, 'details.entityType') as EntityType;
  }, [entityDetails]);

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

  const fetchEntityData = useCallback(async () => {
    if (!entityDetails?.details?.fullyQualifiedName || !entityType) {
      return;
    }

    setIsEntityDataLoading(true);
    try {
      const fqn = entityDetails.details.fullyQualifiedName;
      let entityPromise: Promise<any> | null = null;

      switch (entityType) {
        case EntityType.TABLE:
          entityPromise = getTableDetailsByFQN(fqn, {
            fields: 'extension',
          });

          break;

        case EntityType.TOPIC:
          entityPromise = getTopicByFqn(fqn, { fields: 'extension' });

          break;

        case EntityType.DASHBOARD:
          entityPromise = getDashboardByFqn(fqn, { fields: 'extension' });

          break;

        case EntityType.PIPELINE:
          entityPromise = getPipelineByFqn(fqn, { fields: 'extension' });

          break;

        case EntityType.MLMODEL:
          entityPromise = getMlModelByFQN(fqn, { fields: 'extension' });

          break;

        case EntityType.DATABASE:
          entityPromise = getDatabaseDetailsByFQN(fqn, { fields: 'extension' });

          break;

        case EntityType.DASHBOARD_DATA_MODEL:
          entityPromise = getDataModelByFqn(fqn, { fields: 'extension' });

          break;

        case EntityType.SEARCH_INDEX:
          entityPromise = getSearchIndexDetailsByFQN(fqn);

          break;

        case EntityType.STORED_PROCEDURE:
          entityPromise = getStoredProceduresByFqn(fqn, {
            fields: 'extension',
          });

          break;

        default:
          break;
      }

      if (entityPromise) {
        const data = await entityPromise;
        setEntityData(data);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEntityDataLoading(false);
    }
  }, [entityDetails?.details?.fullyQualifiedName, entityType]);

  const fetchEntityTypeDetail = useCallback(async () => {
    if (!entityType) {
      return;
    }

    try {
      const typeDetail = await getTypeByFQN(entityType);
      setEntityTypeDetail(typeDetail);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [entityType]);

  useEffect(() => {
    if (id) {
      fetchResourcePermission(id);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === EntityRightPanelTab.CUSTOM_PROPERTIES) {
      fetchEntityData();
      fetchEntityTypeDetail();
    }
  }, [activeTab, fetchEntityData, fetchEntityTypeDetail]);

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

  const renderTabContent = () => {
    switch (activeTab) {
      case EntityRightPanelTab.OVERVIEW:
        return (
          <div
            style={{
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '16px',
            }}
          >
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
          <div>
            <DataQualityTab
              entityFQN={entityDetails.details.fullyQualifiedName || ''}
              entityType={entityType}
            />
          </div>
        );
      case EntityRightPanelTab.CUSTOM_PROPERTIES: {
        if (isEntityDataLoading) {
          return (
            <div className="entity-summary-panel-tab-content">
              <div className="p-lg">
                <Loader size="default" />
              </div>
            </div>
          );
        }

        const customProperties = entityTypeDetail?.customProperties || [];
        const extensionData = entityData?.extension || {};

        if (customProperties.length === 0) {
          return (
            <div className="entity-summary-panel-tab-content">
              <div className="p-lg">
                <Typography.Text className="text-grey-muted">
                  {t('message.no-custom-properties-defined')}
                </Typography.Text>
              </div>
            </div>
          );
        }

        return (
          <div className="entity-summary-panel-tab-content">
            <div className="p-x-md">
              <div className="custom-properties-list">
                {customProperties.slice(0, 5).map((property: any) => {
                  const value = extensionData[property.name];

                  const formatValue = (val: any) => {
                    if (!val) {
                      return (
                        <div className="text-center text-grey-muted p-sm">
                          {t('label.no-data-found')}
                        </div>
                      );
                    }

                    if (typeof val === 'object') {
                      if (Array.isArray(val)) {
                        return val.join(', ');
                      }
                      if (val.name || val.displayName) {
                        return val.name || val.displayName;
                      }
                      if (val.value) {
                        return val.value;
                      }
                      // Handle table-type custom properties
                      if (val.rows && val.columns) {
                        return (
                          <div className="custom-property-table">
                            <table className="ant-table ant-table-small">
                              <colgroup>
                                {val.columns.map((_: string, index: number) => (
                                  <col
                                    key={index}
                                    style={{ minWidth: '80px' }}
                                  />
                                ))}
                              </colgroup>
                              <thead>
                                <tr>
                                  {val.columns.map(
                                    (column: string, index: number) => (
                                      <th
                                        className="ant-table-cell"
                                        key={index}
                                      >
                                        {column}
                                      </th>
                                    )
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {val.rows.map((row: any, rowIndex: number) => (
                                  <tr key={rowIndex}>
                                    {val.columns.map(
                                      (column: string, colIndex: number) => (
                                        <td
                                          className="ant-table-cell"
                                          key={colIndex}
                                        >
                                          {row[column] || '-'}
                                        </td>
                                      )
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      return JSON.stringify(val);
                    }

                    return String(val);
                  };

                  return (
                    <div className="custom-property-item" key={property.name}>
                      <Typography.Text strong className="property-name">
                        {property.displayName || property.name}
                      </Typography.Text>
                      <Typography.Text className="property-value">
                        {formatValue(value)}
                      </Typography.Text>
                    </div>
                  );
                })}
                {customProperties.length > 5 && (
                  <div className="m-t-md">
                    <Link
                      rel="noopener noreferrer"
                      target="_blank"
                      to={getEntityLinkFromType(
                        entityDetails.details.fullyQualifiedName || '',
                        entityType as EntityType
                      )}
                    >
                      <Button size="small" type="primary">
                        {t('label.view-all')}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
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
            borderBottom: 'none',
            height: '100%',
          }}
        >
          <div style={{ width: '80%' }}>{renderTabContent()}</div>
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

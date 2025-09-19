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

import { Button, Card, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { get, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLinkOutlined } from '../../../assets/svg/redirect-icon.svg';
import { LineageData } from '../../../components/Lineage/Lineage.interface';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { getDashboardByFqn } from '../../../rest/dashboardAPI';
import { getDatabaseDetailsByFQN } from '../../../rest/databaseAPI';
import { getDataModelByFqn } from '../../../rest/dataModelsAPI';
import { getLineageDataByFQN } from '../../../rest/lineageAPI';
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
import { LineageTabContent } from './LineageTab';

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
  const [lineageData, setLineageData] = useState<LineageData | null>(null);
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);
  const [lineageFilter, setLineageFilter] = useState<'upstream' | 'downstream'>(
    'upstream'
  );

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
        // Merge API data with essential fields from entityDetails.details
        const mergedData = {
          ...data,
          // Essential fields that are used in DataAssetSummaryPanelV1
          entityType: entityDetails.details.entityType,
          fullyQualifiedName: entityDetails.details.fullyQualifiedName,
          id: entityDetails.details.id,
          description: entityDetails.details.description,
          displayName: entityDetails.details.displayName,
          name: entityDetails.details.name,
          deleted: entityDetails.details.deleted,
          serviceType: (entityDetails.details as any).serviceType,
          service: entityDetails.details.service,
          // Fields that might not be in API response but are needed for UI
          owners: data.owners || entityDetails.details.owners, // ✅ Preserve owners from API or fallback to search result
          domains: entityDetails.details.domains,
          tags: entityDetails.details.tags,
          tier: entityDetails.details.tier,
          columnNames: (entityDetails.details as any).columnNames,
          database: (entityDetails.details as any).database,
          databaseSchema: (entityDetails.details as any).databaseSchema,
          tableType: (entityDetails.details as any).tableType,
        };
        setEntityData(mergedData);
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

  const fetchLineageData = useCallback(async () => {
    const fqn = entityDetails?.details?.fullyQualifiedName;
    if (!fqn || !entityType) {
      return;
    }

    try {
      setIsLineageLoading(true);
      const response = await getLineageDataByFQN({
        fqn,
        entityType,
        config: {
          upstreamDepth: 2, // Backend subtracts 1, so this becomes 1
          downstreamDepth: 1, // Backend subtracts 1, so this becomes 1
          nodesPerLayer: 50,
        },
      });
      setLineageData(response);
    } catch (error) {
      setLineageData(null);
    } finally {
      setIsLineageLoading(false);
    }
  }, [entityDetails?.details?.fullyQualifiedName, entityType]);

  const handleOwnerUpdate = useCallback(
    (updatedOwners: EntityReference[]) => {
      // Update the entityData state with the new owners
      setEntityData((prevData: any) => {
        if (!prevData) {
          return prevData;
        }

        const updatedData = {
          ...prevData,
          owners: updatedOwners,
          // Preserve all essential fields from entityDetails.details
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          description:
            prevData.description || entityDetails.details.description,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted !== undefined
              ? prevData.deleted
              : entityDetails.details.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          domains: prevData.domains || entityDetails.details.domains,
          tags: prevData.tags || entityDetails.details.tags,
          tier: prevData.tier || entityDetails.details.tier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityData]
  );

  const handleDomainUpdate = useCallback(
    (updatedDomains: EntityReference[]) => {
      // Update the entityData state with the new domains
      setEntityData((prevData: any) => {
        if (!prevData) {
          return prevData;
        }

        const updatedData = {
          ...prevData,
          domains: updatedDomains,
          // Preserve all essential fields from entityDetails.details
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          description:
            prevData.description || entityDetails.details.description,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted !== undefined
              ? prevData.deleted
              : entityDetails.details.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          owners: prevData.owners || entityDetails.details.owners,
          tags: prevData.tags || entityDetails.details.tags,
          tier: prevData.tier || entityDetails.details.tier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityData]
  );

  const handleTagsUpdate = useCallback(
    (updatedTags: any[]) => {
      // Update the entityData state with the new tags
      setEntityData((prevData: any) => {
        if (!prevData) {
          return prevData;
        }

        const updatedData = {
          ...prevData,
          tags: updatedTags,
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          description:
            prevData.description || entityDetails.details.description,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted !== undefined
              ? prevData.deleted
              : entityDetails.details.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          owners: prevData.owners || entityDetails.details.owners,
          domains: prevData.domains || entityDetails.details.domains,
          tier: prevData.tier || entityDetails.details.tier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityData]
  );

  useEffect(() => {
    if (id) {
      fetchResourcePermission(id);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === EntityRightPanelTab.CUSTOM_PROPERTIES) {
      fetchEntityData();
      fetchEntityTypeDetail();
    } else if (activeTab === EntityRightPanelTab.LINEAGE) {
      fetchLineageData();
    } else if (activeTab === EntityRightPanelTab.OVERVIEW) {
      fetchEntityData();
    }
  }, [activeTab, fetchEntityData, fetchEntityTypeDetail, fetchLineageData]);

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
    const entity = entityData || entityDetails.details;

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
        onDomainUpdate={handleDomainUpdate}
        onOwnerUpdate={handleOwnerUpdate}
        onTagsUpdate={handleTagsUpdate}
      />
    );
  }, [
    tab,
    entityDetails,
    entityData,
    viewPermission,
    isPermissionLoading,
    handleOwnerUpdate,
    handleDomainUpdate,
    handleTagsUpdate,
  ]);
  const entityLink = useMemo(
    () => searchClassBase.getEntityLink(entityDetails.details),
    [entityDetails, getEntityLinkFromType]
  );

  const handleTabChange = (tab: EntityRightPanelTab) => {
    setActiveTab(tab);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case EntityRightPanelTab.OVERVIEW:
        return <div className="p-x-md p-t-md">{summaryComponentV1}</div>;
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
            <div className="p-x-md p-t-md">
              {isLineageLoading ? (
                <div className="flex-center p-lg">
                  <Loader size="default" />
                </div>
              ) : lineageData ? (
                <LineageTabContent
                  entityFqn={entityDetails?.details?.fullyQualifiedName || ''}
                  filter={lineageFilter}
                  lineageData={lineageData}
                  onFilterChange={setLineageFilter}
                />
              ) : (
                <div className="text-center text-grey-muted p-lg">
                  {t('message.no-data-found')}
                </div>
              )}
            </div>
          </div>
        );
      case EntityRightPanelTab.DATA_QUALITY:
        return (
          <div className="p-t-sm">
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
                                        key={index}>
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
                                          key={colIndex}>
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
                      )}>
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
          <div className="d-flex items-center gap-2">
            <Tooltip
              mouseEnterDelay={0.5}
              placement="topLeft"
              title={entityDetails.details.name}
              trigger="hover">
              <Typography.Text
                className="entity-title-link"
                data-testid="entity-link">
                {entityDetails.details.name}
              </Typography.Text>
            </Tooltip>
            <div className="entity-type-badge">
              <Typography.Text className="entity-type-badge-text">
                {startCase(entityDetails.details.entityType)}
              </Typography.Text>
            </div>
          </div>
          <div className="p-r-md">
            <Button
              className="entity-redirect-button"
              icon={<IconExternalLinkOutlined />}
              size="middle"
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
        <Card className="summary-panel-container">
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

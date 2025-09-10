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
import { isEmpty, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { getCurrentMillis } from '../../utils/date-time/DateTimeUtils';
import { getEntityChildDetails } from '../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../utils/EntityUtils';

import { useTranslation } from 'react-i18next';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
import { EntityType } from '../../enums/entity.enum';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { EntityReference } from '../../generated/entity/type';
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import { fetchCharts } from '../../utils/DashboardDetailsUtils';
import { getEpochMillisForPastDays } from '../../utils/date-time/DateTimeUtils';
import DataQualitySection from '../common/DataQualitySection/DataQualitySection';
import DescriptionSection from '../common/DescriptionSection/DescriptionSection';
import DomainsSection from '../common/DomainsSection/DomainsSection';
import OverviewSection from '../common/OverviewSection/OverviewSection';
import OwnersSection from '../common/OwnersSection/OwnersSection';
import SummaryPanelSkeleton from '../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import TagsSection from '../common/TagsSection/TagsSection';
import { DataAssetSummaryPanelProps } from '../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1.interface';

export const DataAssetSummaryPanelV1 = ({
  dataAsset,
  entityType,
  isLoading = false,
  tags,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  highlights,
  isLineageView = false,
}: DataAssetSummaryPanelProps) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();
  const [additionalInfo, setAdditionalInfo] = useState<
    Record<string, number | string>
  >({});
  const [charts, setCharts] = useState<Chart[]>([]);
  const [chartsDetailsLoading, setChartsDetailsLoading] =
    useState<boolean>(false);
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission | null>(null);
  const { isTourPage } = useTourProvider();

  const entityInfo = useMemo(
    () => getEntityOverview(entityType, dataAsset, additionalInfo),
    [dataAsset, additionalInfo, entityType]
  );

  const entityDetails = useMemo(() => {
    return getEntityChildDetails(
      entityType,
      entityType === EntityType.DASHBOARD
        ? ({ ...dataAsset, charts } as unknown as Dashboard)
        : dataAsset,
      highlights,
      entityType === EntityType.DASHBOARD ? chartsDetailsLoading : false
    );
  }, [dataAsset, entityType, highlights, charts, chartsDetailsLoading]);
  const isEntityDeleted = useMemo(() => dataAsset.deleted, [dataAsset]);

  const fetchIncidentCount = useCallback(async () => {
    if (
      dataAsset?.fullyQualifiedName &&
      (entityPermissions?.ViewAll || entityPermissions?.ViewDataProfile)
    ) {
      try {
        const { paging } = await getListTestCaseIncidentStatus({
          limit: 0,
          latest: true,
          originEntityFQN: dataAsset?.fullyQualifiedName,
          startTs: getEpochMillisForPastDays(
            PROFILER_FILTER_RANGE.last30days.days
          ),
          endTs: getCurrentMillis(),
        });

        setAdditionalInfo({
          incidentCount: paging.total,
        });
      } catch {
        setAdditionalInfo({
          incidentCount: 0,
        });
      }
    }
  }, [dataAsset?.fullyQualifiedName, entityPermissions]);

  const fetchChartsDetails = useCallback(async () => {
    setChartsDetailsLoading(true);
    try {
      const chartDetails = await fetchCharts((dataAsset as Dashboard).charts);
      setCharts(chartDetails);
    } catch {
      // Error
    } finally {
      setChartsDetailsLoading(false);
    }
  }, [dataAsset]);

  const fetchEntityBasedDetails = () => {
    switch (entityType) {
      case EntityType.TABLE:
        fetchIncidentCount();

        break;
      case EntityType.DASHBOARD:
        fetchChartsDetails();

        break;
      default:
        break;
    }
  };

  const init = useCallback(async () => {
    if (dataAsset.id && !isTourPage) {
      const permissions = await getEntityPermission(
        ResourceEntity.TABLE,
        dataAsset.id
      );
      setEntityPermissions(permissions);
    } else {
      setEntityPermissions(null);
    }
  }, [dataAsset, isTourPage, isEntityDeleted, getEntityPermission]);

  useEffect(() => {
    if (entityPermissions) {
      fetchEntityBasedDetails();
    }
  }, [entityPermissions]);

  const commonEntitySummaryInfo = useMemo(() => {
    switch (entityType) {
      case EntityType.API_COLLECTION:
      case EntityType.API_ENDPOINT:
      case EntityType.API_SERVICE:
      case EntityType.CHART:
      case EntityType.CONTAINER:
      case EntityType.DASHBOARD:
      case EntityType.DASHBOARD_DATA_MODEL:
      case EntityType.DASHBOARD_SERVICE:
      case EntityType.DATABASE:
      case EntityType.DATABASE_SCHEMA:
      case EntityType.DATABASE_SERVICE:
      case EntityType.MESSAGING_SERVICE:
      case EntityType.METRIC:
      case EntityType.MLMODEL:
      case EntityType.MLMODEL_SERVICE:
      case EntityType.PIPELINE:
      case EntityType.PIPELINE_SERVICE:
      case EntityType.SEARCH_INDEX:
      case EntityType.SEARCH_SERVICE:
      case EntityType.STORAGE_SERVICE:
      case EntityType.STORED_PROCEDURE:
      case EntityType.TABLE:
      case EntityType.TOPIC:
        return (
          <>
            <DescriptionSection
              description={dataAsset.description}
              onDescriptionUpdate={async (newDescription: string) => {
                // Handle description update
                // TODO: Implement actual API call to update description
                // Example: await updateEntityDescription(dataAsset.id, newDescription);
              }}
            />
            <OverviewSection
              items={[
                { label: 'Type', value: startCase(dataAsset?.entityType) },
                { label: 'Rows', value: '344' },
                {
                  label: 'Columns',
                  // @ts-expect-error TODO: fix
                  value: dataAsset?.columnNames?.length || 0,
                },
              ]}
            />
            <DataQualitySection
              tests={[
                { type: 'success', count: 8 },
                { type: 'aborted', count: 4 },
                { type: 'failed', count: 2 },
              ]}
              totalTests={14}
              onEdit={() => {
                // Handle edit functionality
              }}
            />

            <OwnersSection
              hasPermission={
                entityPermissions?.EditAll || entityPermissions?.EditTags
              }
              owners={dataAsset.owners as EntityReference[]}
            />

            <DomainsSection
              domains={dataAsset.domains}
              entityFqn={dataAsset.fullyQualifiedName}
              entityId={dataAsset.id}
              entityType={entityType}
              hasPermission={
                entityPermissions?.EditAll || entityPermissions?.EditTags
              }
              onEdit={() => {
                // Handle edit functionality
              }}
            />
            <TagsSection
              tags={dataAsset.tags}
              onEdit={() => {
                // Handle edit functionality
              }}
            />
            {/* <SummaryTagsDescription
              entityDetail={dataAsset}
              tags={
                tags ??
                getSortedTagsWithHighlight(
                  dataAsset.tags,
                  get(highlights, 'tag.name')
                )
              }
            /> */}
            {/* {entityInfo.some((info) =>
              info.visible?.includes(componentType)
            ) && (
              <Row
                className="p-md border-radius-card summary-panel-card"
                gutter={[0, 4]}>
                <Col span={24}>
                  <CommonEntitySummaryInfo
                    componentType={componentType}
                    entityInfo={entityInfo}
                    isDomainVisible={isDomainVisible}
                  />
                </Col>
              </Row>
            )} */}
            {/* {isLineageView && (
              <Row
                className="p-md border-radius-card summary-panel-card"
                gutter={[0, 8]}>
                <Col span={24}>
                  <Typography.Text
                    className="summary-panel-section-title"
                    data-testid="owner-header">
                    {t('label.owner-plural')}
                  </Typography.Text>
                </Col>
                <Col className="d-flex flex-wrap gap-2" span={24}>
                  <OwnerLabel
                    isCompactView={false}
                    owners={(dataAsset.owners as EntityReference[]) ?? []}
                    showLabel={false}
                  />
                </Col>
              </Row>
            )}
            <Row
              className="p-md border-radius-card summary-panel-card"
              gutter={[0, 8]}>
              <Col span={24}>
                <Typography.Text
                  className="summary-panel-section-title"
                  data-testid="domain-header">
                  {t('label.domain-plural')}
                </Typography.Text>
              </Col>
              <Col className="d-flex flex-wrap gap-2" span={24}>
                <DomainLabel
                  multiple
                  domains={dataAsset.domains}
                  entityFqn={dataAsset.fullyQualifiedName ?? ''}
                  entityId={dataAsset.id ?? ''}
                  entityType={entityType}
                  hasPermission={false}
                  textClassName="render-domain-lebel-style"
                />
              </Col>
            </Row>
            {entityType === EntityType.TABLE && (
              <TableSummary
                entityDetails={dataAsset as Table}
                permissions={entityPermissions}
              />
            )}
            <SummaryTagsDescription
              entityDetail={dataAsset}
              tags={
                tags ??
                getSortedTagsWithHighlight(
                  dataAsset.tags,
                  get(highlights, 'tag.name')
                )
              }
            />
            <SummaryDataProducts dataAsset={dataAsset} /> */}
          </>
        );
      case EntityType.GLOSSARY_TERM:
      case EntityType.TAG:
      case EntityType.DATA_PRODUCT:
      default:
        return null;
    }
  }, [entityType, dataAsset, entityInfo, componentType]);

  useEffect(() => {
    init();
  }, [dataAsset.id]);

  return (
    <SummaryPanelSkeleton loading={isLoading || isEmpty(dataAsset)}>
      <div className="d-flex flex-col gap-4">{commonEntitySummaryInfo}</div>
    </SummaryPanelSkeleton>
  );
};

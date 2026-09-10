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
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_PATH } from '../../constants/constants';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/entity/type';
import { TagLabel, TestCaseStatus } from '../../generated/tests/testCase';
import { TagSource } from '../../generated/type/tagLabel';
import { useChangeSummary } from '../../hooks/useChangeSummary';
import { ChangeSummaryEntry } from '../../rest/changeSummaryAPI';
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import { updateTableColumn } from '../../rest/tableAPI';
import { listTestCases } from '../../rest/testAPI';
import { getEntityOverview } from '../../utils/DataAssetSummaryPanelUtils';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../utils/date-time/DateTimeUtils';
import EntityLink from '../../utils/EntityLink';
import { hasLineageTab } from '../../utils/EntityPermissionUtils';
import { DRAWER_NAVIGATION_OPTIONS } from '../../utils/EntityPureUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { generateEntityLink, getTierTags } from '../../utils/TablePureUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import DataProductsSection from '../common/DataProductsSection/DataProductsSection';
import DataQualitySection from '../common/DataQualitySection/DataQualitySection';
import DescriptionSection from '../common/DescriptionSection/DescriptionSection';
import DomainsSection from '../common/DomainsSection/DomainsSection';
import GlossaryTermsSection from '../common/GlossaryTermsSection/GlossaryTermsSection';
import LineageSection from '../common/LineageSection/LineageSection';
import Loader from '../common/Loader/Loader';
import OverviewSection from '../common/OverviewSection/OverviewSection';
import OwnersSection from '../common/OwnersSection/OwnersSection';
import SummaryPanelSkeleton from '../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import TagsSection from '../common/TagsSection/TagsSection';
import TierSection from '../common/TierSection/TierSection';
import {
  DataAssetSummaryPanelProps,
  TestCaseStatusCounts,
} from '../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1.interface';

// Entity types that share the "common" summary layout (description, overview,
// data quality, lineage, owners, domains, tier, glossary terms, tags, data products).
const COMMON_LAYOUT_ENTITY_TYPES = new Set<EntityType>([
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.API_SERVICE,
  EntityType.CHART,
  EntityType.CONTAINER,
  EntityType.DASHBOARD,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.DASHBOARD_SERVICE,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.DATABASE_SERVICE,
  EntityType.MESSAGING_SERVICE,
  EntityType.METRIC,
  EntityType.MLMODEL,
  EntityType.MLMODEL_SERVICE,
  EntityType.PIPELINE,
  EntityType.PIPELINE_SERVICE,
  EntityType.SEARCH_INDEX,
  EntityType.SEARCH_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.STORED_PROCEDURE,
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.DIRECTORY,
  EntityType.FILE,
  EntityType.SPREADSHEET,
  EntityType.WORKSHEET,
  EntityType.TABLE_COLUMN,
  EntityType.GOVERN,
  EntityType.GLOSSARY,
  EntityType.GLOSSARY_TERM,
  EntityType.TAG,
  EntityType.TEST_SUITE,
  EntityType.TEST_CASE,
  EntityType.DOMAIN,
  EntityType.CLASSIFICATION,
  EntityType.METADATA_SERVICE,
  EntityType.SECURITY_SERVICE,
  EntityType.DRIVE_SERVICE,
  EntityType.INGESTION_PIPELINE,
  EntityType.WORKFLOW_DEFINITION,
  EntityType.DATA_CONTRACT,
  EntityType.QUERY,
  EntityType.AI_APPLICATION,
  EntityType.LLM_MODEL,
  EntityType.MCP_SERVER,
  EntityType.APPLICATION,
  EntityType.ALERT,
  EntityType.EVENT_SUBSCRIPTION,
]);

// Entity types that share the minimal summary layout (description, overview,
// optional owners, optional tags).
const MISC_LAYOUT_ENTITY_TYPES = new Set<EntityType>([
  EntityType.USER,
  EntityType.TEAM,
  EntityType.ROLE,
  EntityType.POLICY,
  EntityType.BOT,
  EntityType.WEBHOOK,
  EntityType.PERSONA,
  EntityType.KPI,
  EntityType.DATA_INSIGHT_CHART,
  EntityType.DOC_STORE,
  EntityType.TYPE,
  EntityType.SAMPLE_DATA,
  EntityType.CUSTOM_METRIC,
  EntityType.NOTIFICATION_TEMPLATE,
  EntityType.INGESTION_RUNNER,
  EntityType.APP_MARKET_PLACE_DEFINITION,
  EntityType.SERVICE,
  EntityType.SUBSCRIPTION,
  EntityType.LINEAGE_EDGE,
  EntityType.ENTITY_REPORT_DATA,
  EntityType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA,
  EntityType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
  EntityType.TEST_CASE_RESOLUTION_STATUS,
  EntityType.TEST_CASE_RESULT,
  EntityType.ALL,
  EntityType.PAGE,
  EntityType.knowledgePanels,
]);

// Maps an entity type to the (invisible) debug test-id span rendered for it in
// the "common" summary layout. At most one entry can match a given entityType.
const ENTITY_DEBUG_TEST_ID_MAP: Partial<Record<EntityType, string>> = {
  [EntityType.TABLE]: 'TableSummary',
  [EntityType.TOPIC]: 'TopicSummary',
  [EntityType.DASHBOARD]: 'DashboardSummary',
  [EntityType.PIPELINE]: 'PipelineSummary',
  [EntityType.MLMODEL]: 'MlModelSummary',
  [EntityType.CHART]: 'ChartSummary',
  [EntityType.DATABASE]: 'DatabaseSummary',
  [EntityType.DATABASE_SCHEMA]: 'DatabaseSchemaSummary',
  [EntityType.CONTAINER]: 'ContainerSummary',
  [EntityType.SEARCH_INDEX]: 'SearchIndexSummary',
  [EntityType.API_COLLECTION]: 'APIServiceSummary',
  [EntityType.DIRECTORY]: 'DirectorySummary',
  [EntityType.TABLE_COLUMN]: 'ColumnSummary',
  [EntityType.DASHBOARD_DATA_MODEL]: 'DashboardDataModelSummary',
};

const renderEntityDebugTestId = (entityType: EntityType) => {
  const testId = ENTITY_DEBUG_TEST_ID_MAP[entityType];

  return testId ? <span className="d-none" data-testid={testId} /> : null;
};

type EditPermissionInputs = {
  canEditSummary: boolean;
  canEditColumnField: boolean;
  entityPermissions: OperationPermission | null;
  isDeleted?: boolean;
  panelPath?: string;
};

// Columns inherit domain from table - not editable
const getEditDomainPermission = ({
  canEditColumnField,
  entityPermissions,
  isDeleted,
  panelPath,
}: EditPermissionInputs) =>
  canEditColumnField &&
  entityPermissions?.EditAll &&
  !isDeleted &&
  panelPath !== ENTITY_PATH.dataProductsTab;

const getEditDescriptionPermission = ({
  canEditSummary,
  entityPermissions,
  isDeleted,
}: EditPermissionInputs) =>
  canEditSummary &&
  (entityPermissions?.EditAll || entityPermissions?.EditDescription) &&
  !isDeleted;

const getEditGlossaryTermsPermission = ({
  canEditSummary,
  entityPermissions,
  isDeleted,
}: EditPermissionInputs) =>
  canEditSummary &&
  (entityPermissions?.EditGlossaryTerms || entityPermissions?.EditAll) &&
  !isDeleted;

// Columns inherit owners from table - not editable
const getEditOwnerPermission = ({
  canEditColumnField,
  entityPermissions,
  isDeleted,
}: EditPermissionInputs) =>
  canEditColumnField &&
  (entityPermissions?.EditAll || entityPermissions?.EditOwners) &&
  !isDeleted;

// Columns inherit tier from table - not editable
const getEditTierPermission = ({
  canEditColumnField,
  entityPermissions,
  isDeleted,
}: EditPermissionInputs) =>
  canEditColumnField &&
  (entityPermissions?.EditAll || entityPermissions?.EditTier) &&
  !isDeleted;

const getEditTagsPermission = ({
  canEditSummary,
  entityPermissions,
  isDeleted,
}: EditPermissionInputs) =>
  canEditSummary &&
  (entityPermissions?.EditAll || entityPermissions?.EditTags) &&
  !isDeleted;

// Columns inherit data products from table - not editable
const getEditDataProductPermission = ({
  canEditColumnField,
  entityPermissions,
  isDeleted,
}: EditPermissionInputs) =>
  canEditColumnField && entityPermissions?.EditAll && !isDeleted;

export const DataAssetSummaryPanelV1 = ({
  dataAsset,
  entityType,
  summaryEntityType = entityType,
  isLoading = false,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  onOwnerUpdate,
  panelPath,
  onDomainUpdate,
  onTierUpdate,
  isDomainVisible,
  onTagsUpdate,
  onDataProductsUpdate,
  onGlossaryTermsUpdate,
  onDescriptionUpdate,
  onLinkClick,
  onLineageClick,
}: DataAssetSummaryPanelProps) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();

  // Extract tier from tags
  const tier = useMemo(
    () => getTierTags(dataAsset.tags ?? []),
    [dataAsset.tags]
  );

  // Handler for description updates
  const handleDescriptionUpdate = useCallback(
    async (newDescription: string) => {
      try {
        if (!dataAsset.id) {
          return;
        }
        if (entityType === EntityType.TABLE_COLUMN) {
          const res = await updateTableColumn(
            dataAsset.fullyQualifiedName ?? '',
            {
              description: newDescription,
            }
          );
          onDescriptionUpdate?.(res.description || newDescription);

          return;
        }

        // Create the JSON patch for description update
        const jsonPatch = [
          {
            op: dataAsset.description ? 'replace' : 'add',
            path: '/description',
            value: newDescription,
          },
        ];

        // Make the API call using the correct patch API for the entity type
        const patchAPI = entityUtilClassBase.getEntityPatchAPI(entityType);
        const response = (await patchAPI(
          dataAsset.id,
          jsonPatch as Operation[]
        )) as { description?: string };

        // Show success message
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.description'),
          })
        );

        // Update the parent component with the new description from response
        if (onDescriptionUpdate) {
          onDescriptionUpdate(response.description || newDescription);
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.description'),
          })
        );
      }
    },
    [
      dataAsset.id,
      dataAsset.fullyQualifiedName,
      dataAsset.description,
      entityType,
      t,
      onDescriptionUpdate,
    ]
  );

  const [additionalInfo, setAdditionalInfo] = useState<
    Record<string, number | string>
  >({});
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission | null>(null);
  const { isTourPage } = useTourProvider();
  const [isTestCaseLoading, setIsTestCaseLoading] = useState<boolean>(false);
  const [statusCounts, setStatusCounts] = useState<TestCaseStatusCounts>({
    success: 0,
    failed: 0,
    aborted: 0,
    ack: 0,
    total: 0,
  });
  const entityInfo = useMemo(
    () => getEntityOverview(entityType, dataAsset, additionalInfo),
    [dataAsset, additionalInfo, entityType]
  );

  const shouldShowLineageSection = useMemo(
    () => hasLineageTab(entityType),
    [entityType]
  );

  const isColumnEntity = entityType === EntityType.TABLE_COLUMN;

  const {
    changeSummaryEntityType,
    changeSummaryEntityId,
    changeSummaryParams,
  } = useMemo(() => {
    if (!isColumnEntity) {
      return {
        changeSummaryEntityType: entityType,
        changeSummaryEntityId: dataAsset.id ?? '',
        changeSummaryParams: { fieldPrefix: 'description', limit: 1 },
      };
    }
    const columnData = dataAsset as typeof dataAsset & {
      table?: { id?: string };
    };
    const columnName = EntityLink.getTableColumnNameFromColumnFqn(
      dataAsset.fullyQualifiedName ?? '',
      false
    );

    return {
      changeSummaryEntityType: EntityType.TABLE,
      changeSummaryEntityId: columnData.table?.id ?? '',
      changeSummaryParams: {
        fieldPrefix: `columns.${columnName}.description`,
        limit: 1,
      },
    };
  }, [isColumnEntity, entityType, dataAsset.id, dataAsset.fullyQualifiedName]);

  const { changeSummary } = useChangeSummary(
    changeSummaryEntityType,
    changeSummaryEntityId,
    changeSummaryParams
  );

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

  const fetchTestCases = useCallback(async () => {
    if (!dataAsset?.fullyQualifiedName || entityType !== EntityType.TABLE) {
      setIsTestCaseLoading(false);

      return;
    }

    try {
      setIsTestCaseLoading(true);
      const entityLink = generateEntityLink(dataAsset?.fullyQualifiedName);

      const response = await listTestCases({
        entityLink,
        includeAllTests: true,
        limit: 100, // Get more test cases to ensure accurate counts
        fields: ['testCaseResult', 'incidentId'],
      });

      // Calculate status counts
      const counts = (response.data || []).reduce(
        (acc, testCase) => {
          const status = testCase.testCaseResult?.testCaseStatus;
          if (status) {
            switch (status) {
              case TestCaseStatus.Success:
                acc.success++;

                break;
              case TestCaseStatus.Failed:
                acc.failed++;

                break;
              case TestCaseStatus.Aborted:
                acc.aborted++;

                break;
            }
            acc.total++;
          }

          return acc;
        },
        { success: 0, failed: 0, aborted: 0, ack: 0, total: 0 }
      );

      setStatusCounts(counts);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setStatusCounts({ success: 0, failed: 0, aborted: 0, ack: 0, total: 0 });
    } finally {
      setIsTestCaseLoading(false);
    }
  }, [dataAsset?.fullyQualifiedName, entityPermissions]);

  const fetchEntityBasedDetails = () => {
    if (entityType === EntityType.TABLE) {
      fetchIncidentCount();
    }
  };
  // Columns inherit owners, domains, tier, and data products from their parent table
  // These fields should not be editable on columns
  // Extension entities can reuse a built-in summary layout, but their update APIs
  // are not part of the base entity patch map. Keep mapped layouts read-only.
  const canEditSummary = summaryEntityType === entityType;

  const {
    editDomainPermission,
    editOwnerPermission,
    editTierPermission,
    editTagsPermission,
    editDataProductPermission,
    editDescriptionPermission,
    editGlossaryTermsPermission,
  } = useMemo(() => {
    // Columns inherit owners, domains, tier, and data products from their parent
    // table, so those fields are never editable on a column summary.
    const canEditColumnField = canEditSummary && !isColumnEntity;
    const permissionInputs: EditPermissionInputs = {
      canEditSummary,
      canEditColumnField,
      entityPermissions,
      isDeleted: 'deleted' in dataAsset ? dataAsset.deleted : undefined,
      panelPath,
    };

    return {
      editDomainPermission: getEditDomainPermission(permissionInputs),
      editDescriptionPermission: getEditDescriptionPermission(permissionInputs),
      editGlossaryTermsPermission:
        getEditGlossaryTermsPermission(permissionInputs),
      editOwnerPermission: getEditOwnerPermission(permissionInputs),
      editTierPermission: getEditTierPermission(permissionInputs),
      editTagsPermission: getEditTagsPermission(permissionInputs),
      editDataProductPermission: getEditDataProductPermission(permissionInputs),
    };
  }, [canEditSummary, entityPermissions, dataAsset, isColumnEntity, panelPath]);

  const init = useCallback(async () => {
    // Do not reset permissions to null when id is temporarily missing during re-renders
    if (!dataAsset.id || isTourPage) {
      return;
    }

    // For columns, use the parent table's permissions since columns don't have their own
    if (entityType === EntityType.TABLE_COLUMN) {
      const columnData = dataAsset as typeof dataAsset & {
        table?: { id?: string };
      };
      if (columnData.table?.id) {
        try {
          const permissions = await getEntityPermission(
            ResourceEntity.TABLE,
            columnData.table.id
          );
          setEntityPermissions(permissions);

          return;
        } catch {
          // If permission fetch fails, allow basic view access for columns
          setEntityPermissions({
            ...DEFAULT_ENTITY_PERMISSION,
            ViewBasic: true,
            ViewAll: true,
          });

          return;
        }
      }
      // If no table.id available, allow basic view access for columns
      // Columns inherit permissions from their parent table
      setEntityPermissions({
        ...DEFAULT_ENTITY_PERMISSION,
        ViewBasic: true,
        ViewAll: true,
      });

      return;
    }

    const permissions = await getEntityPermission(
      dataAsset.entityType as ResourceEntity,
      dataAsset.id
    );
    setEntityPermissions(permissions);
  }, [
    dataAsset.id,
    dataAsset.entityType,
    entityType,
    isTourPage,
    getEntityPermission,
  ]);

  useEffect(() => {
    if (entityPermissions) {
      fetchTestCases();
      fetchEntityBasedDetails();
    }
  }, [entityPermissions, dataAsset?.fullyQualifiedName]);

  // Renders the shared layout for entity types with the full set of summary
  // sections (description, overview, data quality, lineage, owners, domains,
  // tier, glossary terms, tags, data products).
  const renderCommonLayoutSummary = (
    descriptionChangeSummaryEntry: ChangeSummaryEntry | undefined
  ) => (
    <>
      {renderEntityDebugTestId(entityType)}
      <DescriptionSection
        changeSummaryEntry={descriptionChangeSummaryEntry}
        description={dataAsset.description}
        entityFqn={dataAsset.fullyQualifiedName}
        entityType={entityType}
        hasPermission={editDescriptionPermission}
        onDescriptionUpdate={handleDescriptionUpdate}
      />
      <OverviewSection
        componentType={componentType}
        entityInfoV1={entityInfo}
        isDomainVisible={isDomainVisible}
        onLinkClick={onLinkClick}
      />
      {isTestCaseLoading ? (
        <Loader size="small" />
      ) : (
        entityType === EntityType.TABLE && (
          <DataQualitySection
            tests={[
              { type: 'success', count: statusCounts.success },
              { type: 'aborted', count: statusCounts.aborted },
              { type: 'failed', count: statusCounts.failed },
            ]}
            totalTests={statusCounts.total}
            onEdit={() => {
              // Handle edit functionality
            }}
          />
        )
      )}
      {shouldShowLineageSection && (
        <LineageSection
          entityFqn={dataAsset.fullyQualifiedName}
          entityType={entityType}
          key={`lineage-${dataAsset.id}`}
          onLineageClick={onLineageClick}
        />
      )}
      <div>
        <OwnersSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editOwnerPermission}
          key={`owners-${dataAsset.id}-${
            (dataAsset.owners as EntityReference[])?.length || 0
          }`}
          owners={dataAsset.owners as EntityReference[]}
          onOwnerUpdate={onOwnerUpdate}
        />
      </div>
      <div>
        <DomainsSection
          domains={dataAsset.domains}
          entityFqn={dataAsset.fullyQualifiedName}
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editDomainPermission}
          key={`domains-${dataAsset.id}-${
            (dataAsset.domains as EntityReference[])?.length || 0
          }`}
          onDomainUpdate={onDomainUpdate}
        />
      </div>
      <div>
        <TierSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editTierPermission}
          key={`tier-${dataAsset.id}-${tier?.tagFQN || 'no-tier'}`}
          tags={dataAsset.tags}
          tier={tier}
          onTierUpdate={onTierUpdate}
        />
      </div>
      <div>
        <GlossaryTermsSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editGlossaryTermsPermission}
          key={`glossary-terms-${dataAsset.id}-${dataAsset.tags?.length ?? 0}`}
          maxVisibleGlossaryTerms={3}
          tags={dataAsset.tags}
          onGlossaryTermsUpdate={onGlossaryTermsUpdate}
        />
      </div>
      <div>
        <TagsSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editTagsPermission}
          key={`tags-${dataAsset.id}-${dataAsset.tags?.length ?? 0}`}
          tags={dataAsset.tags}
          onTagsUpdate={onTagsUpdate}
        />
      </div>
      <div>
        <DataProductsSection
          activeDomains={dataAsset.domains as EntityReference[]}
          dataProducts={dataAsset.dataProducts as EntityReference[]}
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editDataProductPermission}
          key={`data-products-${dataAsset.id}-${
            dataAsset.dataProducts?.length ?? 0
          }`}
          onDataProductsUpdate={onDataProductsUpdate}
        />
      </div>
    </>
  );

  const renderKnowledgePageSummary = (
    descriptionChangeSummaryEntry: ChangeSummaryEntry | undefined
  ) => (
    <>
      <span className="d-none" data-testid="KnowledgePageSummary" />
      <DescriptionSection
        changeSummaryEntry={descriptionChangeSummaryEntry}
        description={dataAsset.description}
        entityFqn={dataAsset.fullyQualifiedName}
        entityType={entityType}
        hasPermission={editDescriptionPermission}
        onDescriptionUpdate={handleDescriptionUpdate}
      />
      <div>
        <OwnersSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editOwnerPermission}
          key={`owners-${dataAsset.id}-${
            (dataAsset.owners as EntityReference[])?.length || 0
          }`}
          owners={dataAsset.owners as EntityReference[]}
          onOwnerUpdate={onOwnerUpdate}
        />
      </div>
      <div>
        <TagsSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editTagsPermission}
          key={`tags-${dataAsset.id}-${dataAsset.tags?.length ?? 0}`}
          tags={dataAsset.tags}
          onTagsUpdate={onTagsUpdate}
        />
      </div>
      <div>
        <GlossaryTermsSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editGlossaryTermsPermission}
          key={`glossary-terms-${dataAsset.id}-${dataAsset.tags?.length ?? 0}`}
          maxVisibleGlossaryTerms={3}
          tags={dataAsset.tags}
          onGlossaryTermsUpdate={onGlossaryTermsUpdate}
        />
      </div>
    </>
  );

  const renderDataProductSummary = (
    descriptionChangeSummaryEntry: ChangeSummaryEntry | undefined
  ) => (
    <>
      <DescriptionSection
        changeSummaryEntry={descriptionChangeSummaryEntry}
        description={dataAsset.description}
        entityFqn={dataAsset.fullyQualifiedName}
        entityType={entityType}
        hasPermission={editDescriptionPermission}
        onDescriptionUpdate={handleDescriptionUpdate}
      />
      <div>
        <OwnersSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editOwnerPermission}
          key={`owners-${dataAsset.id}-${
            (dataAsset.owners as EntityReference[])?.length || 0
          }`}
          owners={dataAsset.owners as EntityReference[]}
          onOwnerUpdate={onOwnerUpdate}
        />
      </div>
      <div>
        <DomainsSection
          domains={dataAsset.domains}
          entityFqn={dataAsset.fullyQualifiedName}
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editDomainPermission}
          key={`domains-${dataAsset.id}-${
            (dataAsset.domains as EntityReference[])?.length || 0
          }`}
          onDomainUpdate={onDomainUpdate}
        />
      </div>
      <div>
        <TierSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editTierPermission}
          key={`tier-${dataAsset.id}-${tier?.tagFQN || 'no-tier'}`}
          tags={dataAsset.tags}
          tier={tier}
          onTierUpdate={onTierUpdate}
        />
      </div>
      <div>
        <TagsSection
          entityId={dataAsset.id}
          entityType={entityType}
          hasPermission={editTagsPermission}
          key={`tags-${dataAsset.id}-${dataAsset.tags?.length ?? 0}`}
          tags={dataAsset.tags?.filter(
            (tag: TagLabel) => tag.source !== TagSource.Glossary
          )}
          onTagsUpdate={onTagsUpdate}
        />
      </div>
    </>
  );

  const renderMiscLayoutSummary = (
    descriptionChangeSummaryEntry: ChangeSummaryEntry | undefined
  ) => (
    <>
      <DescriptionSection
        changeSummaryEntry={descriptionChangeSummaryEntry}
        description={dataAsset.description}
        entityFqn={dataAsset.fullyQualifiedName}
        entityType={entityType}
        hasPermission={editDescriptionPermission}
        onDescriptionUpdate={handleDescriptionUpdate}
      />
      <OverviewSection
        componentType={componentType}
        entityInfoV1={entityInfo}
        isDomainVisible={isDomainVisible}
        onLinkClick={onLinkClick}
      />
      {dataAsset.owners && (
        <div>
          <OwnersSection
            entityId={dataAsset.id}
            entityType={entityType}
            hasPermission={editOwnerPermission}
            key={`owners-${dataAsset.id}-${
              (dataAsset.owners as EntityReference[])?.length || 0
            }`}
            owners={dataAsset.owners as EntityReference[]}
            onOwnerUpdate={onOwnerUpdate}
          />
        </div>
      )}
      {dataAsset.tags && (
        <div>
          <TagsSection
            entityId={dataAsset.id}
            entityType={entityType}
            hasPermission={editTagsPermission}
            key={`tags-${dataAsset.id}-${dataAsset.tags?.length ?? 0}`}
            tags={dataAsset.tags?.filter(
              (tag: TagLabel) => tag.source !== TagSource.Glossary
            )}
            onTagsUpdate={onTagsUpdate}
          />
        </div>
      )}
    </>
  );

  const commonEntitySummaryInfo = useMemo(() => {
    const descriptionChangeSummaryEntry = isColumnEntity
      ? changeSummary?.[changeSummaryParams.fieldPrefix]
      : changeSummary?.description;

    if (COMMON_LAYOUT_ENTITY_TYPES.has(summaryEntityType)) {
      return renderCommonLayoutSummary(descriptionChangeSummaryEntry);
    }
    if (summaryEntityType === EntityType.KNOWLEDGE_PAGE) {
      return renderKnowledgePageSummary(descriptionChangeSummaryEntry);
    }
    if (summaryEntityType === EntityType.DATA_PRODUCT) {
      return renderDataProductSummary(descriptionChangeSummaryEntry);
    }
    if (MISC_LAYOUT_ENTITY_TYPES.has(summaryEntityType)) {
      return renderMiscLayoutSummary(descriptionChangeSummaryEntry);
    }

    return null;
  }, [
    entityType,
    summaryEntityType,
    dataAsset,
    entityInfo,
    componentType,
    statusCounts,
    entityPermissions,
    changeSummary,
  ]);

  useEffect(() => {
    init();
  }, [dataAsset.id]);

  return (
    <SummaryPanelSkeleton loading={isLoading || isEmpty(dataAsset)}>
      <div className="d-flex flex-col gap-4">{commonEntitySummaryInfo}</div>
    </SummaryPanelSkeleton>
  );
};

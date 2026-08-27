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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Col, Row, Tabs, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as RedAlertIcon } from '../../assets/svg/ic-alert-red.svg';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import { withSuggestions } from '../../components/AppRouter/withSuggestions';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../components/common/IconButtons/EditIconButton';
import { PageLoader } from '../../components/common/Loader/Loader';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import {
  DataAssetsHeaderProps,
  DataAssetWithDomains,
} from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { Table, TableType } from '../../generated/entity/data/table';
import { PageType } from '../../generated/system/ui/page';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { TagLabel } from '../../generated/type/tagLabel';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../hooks/useFqn';
import { useSub } from '../../hooks/usePubSub';
import { FeedCounts } from '../../interface/feed.interface';
import { fetchTestCaseResultByTestSuiteId } from '../../rest/dataQualityDashboardAPI';
import { getDataQualityLineage } from '../../rest/lineageAPI';
import {
  tableQueryCountFn,
  tableQueryCountKey,
  tableQueryFn,
  tableQueryKey,
} from '../../rest/queries/tableQuery';
import {
  addFollower,
  patchTableDetails,
  removeFollower,
  restoreTable,
  updateTablesVotes,
} from '../../rest/tableAPI';
import { Suggestion, SuggestionType } from '../../types/taskSuggestion';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { defaultFieldsWithColumns } from '../../utils/DatasetDetailsUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { mergeEntityStateUpdate } from '../../utils/EntityUpdateUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import {
  fetchEntityActivityCountInto,
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../utils/FeedUtilsPure';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import tableClassBase from '../../utils/TableClassBase';
import {
  findColumnByEntityLink,
  getJoinsFromTableJoins,
  getTagsWithoutTier,
  getTierTags,
  updateColumnInNestedStructure,
} from '../../utils/TablePureUtils';
import {
  updateCertificationTag,
  updateTierTag,
} from '../../utils/TagsPureUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { useTestCaseStore } from '../IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import TableDetailsPageSkeleton from './TableDetailsPageSkeleton.component';
const TableDetailsPageV1: React.FC = () => {
  const {
    isTourOpen,
    activeTabForTourDatasetPage,
    isTourPage,
    tourMockDatasetData,
  } = useTourProvider();
  const { currentUser } = useApplicationStore();
  const { setDqLineageData } = useTestCaseStore();
  const queryClient = useQueryClient();
  const { tab: activeTab } = useRequiredParams<{ tab: EntityTabs }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbData = (
    location.state as {
      breadcrumbData?: DataAssetsHeaderProps['breadcrumbData'];
    } | null
  )?.breadcrumbData;
  const USERId = currentUser?.id ?? '';
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [dqFailureCount, setDqFailureCount] = useState(0);
  const { customizedPage } = useCustomPages(PageType.Table);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const {
    fqn: datasetFQN,
    entityFqn: tableFqn,
    columnFqn: columnPart,
  } = useFqn({ type: EntityType.TABLE });

  const columnFqn = useMemo(
    () => (columnPart ? datasetFQN : undefined),
    [columnPart, datasetFQN]
  );

  const alertBadge = useMemo(() => {
    return tableClassBase.getAlertEnableStatus() && dqFailureCount > 0 ? (
      <Tooltip
        placement="right"
        title={t('label.check-active-data-quality-incident-plural')}>
        <Link
          to={getEntityDetailsPath(
            EntityType.TABLE,
            tableFqn,
            EntityTabs.PROFILER
          )}>
          <RedAlertIcon className="text-red-3" height={24} width={24} />
        </Link>
      </Tooltip>
    ) : undefined;
  }, [dqFailureCount, tableFqn]);

  // Two useEntityPermissions calls in this component, partitioned by deleted-sensitivity,
  // not by position convenience: getDerivedPermissionFlags never gates view flags on
  // `deleted` (only canEdit* is), so this view-tier call is correct to run this early —
  // before {@code tableDetails} exists — because it has to be: {@code tableFields}/
  // {@code tableCacheKey}/the entity {@code useQuery}'s {@code enabled} below need these view
  // flags to even RUN that query, and {@code tableDetails} is that query's result. That's a
  // real ordering cycle (view flags gate the fetch that would supply `deleted`), not a
  // shortcut. The edit-tier call (canEditCustomFields, canEditLineage — the only flags that
  // need `deleted`) lives further down, at the earliest point `deleted` exists; see the
  // comment there. Both calls share one React Query cache entry (same queryKey), so having
  // two costs an extra derivation, not an extra fetch — never diverges into two fetches as
  // long as both pass the identical (resource, identifier) pair.
  const {
    permissions: tablePermissions, // children consume the raw OperationPermission prop
    isLoading: isPermissionsLoading,
    error: permissionsError,
    canViewBasic: viewBasicPermission,
    canViewAll: viewAllPermission,
    canViewCustomFields: viewCustomPropertiesPermission,
    canViewSampleData: viewSampleDataPermission,
    canViewQueries: viewQueriesPermission,
    canViewDataProfile: viewProfilerPermission,
    canViewUsage: viewUsagePermission,
    canViewTests: viewTestCasePermission,
  } = useEntityPermissions(ResourceEntity.TABLE, tableFqn);
  // Same value as viewBasicPermission above, named for what it means at its one call site
  // (the entity useQuery's `enabled` a few lines down) rather than re-destructured.
  const canViewTableInQuery = viewBasicPermission;

  useEffect(() => {
    if (permissionsError) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    }
  }, [permissionsError]);

  // Field set the page reads from the server. The permission-gated extras (USAGE_SUMMARY,
  // TESTSUITE) become part of the React Query cache key so a permission flip doesn't serve
  // a "lite" cached body to a "heavy" caller. {@link tableQueryKey} also covers the
  // fqn axis so navigating between tables hits a fresh slot.
  const tableFields = useMemo(() => {
    let fields = defaultFieldsWithColumns;
    if (viewUsagePermission) {
      fields += `,${TabSpecificField.USAGE_SUMMARY}`;
    }
    if (viewTestCasePermission) {
      fields += `,${TabSpecificField.TESTSUITE}`;
    }

    return fields;
  }, [viewUsagePermission, viewTestCasePermission]);

  const tableCacheKey = useMemo(
    () => tableQueryKey(tableFqn, tableFields),
    [tableFqn, tableFields]
  );

  // P2: replace the manual useState + fetchTableDetails + useEffect pattern with
  // {@link useQuery}. Wins:
  //   - Background revalidation: a stale entry serves immediately, then refetches; the page
  //     is interactive on first paint when the entry is fresh.
  //   - Single source of truth: hover-prefetch from search/recently-viewed (P3) populates the
  //     same cache slot, so the page mount is free in that case.
  //   - Mutations apply optimistic updates via {@code queryClient.setQueryData}; every
  //     consumer reading the same key sees the change instantly (no prop drilling).
  //
  // {@code enabled} gates the fire so we don't fetch in tour mode (we seed the mock directly
  // below) or before view permissions have resolved. The tour case writes to the cache via
  // {@code setQueryData} so {@code tableDetails} below stays one variable.
  const {
    data: tableDetails,
    isLoading: tableLoading,
    error: tableError,
  } = useQuery({
    queryKey: tableCacheKey,
    queryFn: tableQueryFn(tableFqn, tableFields),
    enabled: Boolean(
      tableFqn && canViewTableInQuery && !isTourOpen && !isTourPage
    ),
  });

  // useQuery rather than a fetch effect plus a loading flag: isFetching is already true on
  // the render that starts the request, so the badge never flashes a placeholder 0.
  const { data: queryCount = 0, isFetching: isQueryCountLoading } = useQuery({
    queryKey: tableQueryCountKey(tableDetails?.id ?? ''),
    queryFn: tableQueryCountFn(tableDetails?.id ?? ''),
    enabled: Boolean(tableDetails?.id),
  });

  // Forbidden → redirect, preserving the prior behavior. Run as an effect rather than during
  // render so the navigate call doesn't fire during the same commit that returns the query
  // result. Only redirects on a fresh 403; if the user has stale cached data and the server
  // later 403s on background refetch, we don't yank them off the page.
  useEffect(() => {
    const status = (tableError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    }
  }, [tableError, navigate]);

  // Side effect that used to live in the fetch callback — populate "recently viewed" on a
  // successful fetch. Decoupled from the fetch so it fires when the cache resolves the data,
  // whether that's via a network fetch or a hover-prefetch hit.
  useEffect(() => {
    if (!tableDetails) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(tableDetails),
      entityType: EntityType.TABLE,
      fqn: tableDetails.fullyQualifiedName ?? '',
      serviceType: tableDetails.serviceType,
      timestamp: 0,
      id: tableDetails.id,
    });
  }, [tableDetails]);

  // Imperative cache writer for mutation handlers. Functionally identical to the old
  // {@code setTableDetails(updater)} — accepts a (Table | undefined) → (Table | undefined)
  // and writes the result into the cache so every reader (this page, hover-prefetched
  // siblings, future widgets that consume the key) sees the update.
  const setTableDetails = useCallback(
    (
      updater:
        | Table
        | undefined
        | ((prev: Table | undefined) => Table | undefined)
    ) => {
      if (typeof updater === 'function') {
        queryClient.setQueryData<Table | undefined>(tableCacheKey, updater);
      } else {
        queryClient.setQueryData<Table | undefined>(tableCacheKey, updater);
      }
    },
    [queryClient, tableCacheKey]
  );

  // Replacement for the old {@code fetchTableDetails()} call sites that want a fresh body
  // (e.g. after a server-side mutation we can't represent purely on the client). Triggers a
  // background refetch — stale data continues to render until the new body arrives.
  const refetchTableDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: tableCacheKey }),
    [queryClient, tableCacheKey]
  );

  const isViewTableType = useMemo(
    () => tableDetails?.tableType === TableType.View,
    [tableDetails?.tableType]
  );

  // Lifted from above the useQuery block: depends on {@code tableDetails} so must come
  // after the query is declared. Same shape as before.
  const extraDropdownContent = useMemo(
    () =>
      tableDetails
        ? entityUtilClassBase.getManageExtraOptions(
            EntityType.TABLE,
            tableFqn,
            tablePermissions,
            tableDetails,
            navigate
          )
        : [],
    [tablePermissions, tableFqn, tableDetails, navigate]
  );

  const fetchDQUpstreamFailureCount = async () => {
    if (!tableClassBase.getAlertEnableStatus()) {
      setDqFailureCount(0);
    }

    // Todo: Remove this once we have support for count in API
    try {
      const data = await getDataQualityLineage(tableFqn, {
        upstreamDepth: 1,
      });
      setDqLineageData(data);
      const updatedNodes =
        data.nodes?.filter((node) => node?.fullyQualifiedName !== tableFqn) ??
        [];
      setDqFailureCount(updatedNodes.length);
    } catch {
      setDqFailureCount(0);
    }
  };

  const getTestCaseFailureCount = async () => {
    try {
      if (!tableClassBase.getAlertEnableStatus()) {
        setDqFailureCount(0);

        return;
      }

      const testSuiteId = tableDetails?.testSuite?.id;

      if (!testSuiteId) {
        await fetchDQUpstreamFailureCount();

        return;
      }

      const { data } = await fetchTestCaseResultByTestSuiteId(
        testSuiteId,
        TestCaseStatus.Failed
      );
      const failureCount = data.reduce(
        (acc, curr) => acc + Number.parseInt(curr.document_count ?? '0'),
        0
      );

      if (failureCount === 0) {
        await fetchDQUpstreamFailureCount();
      } else {
        setDqFailureCount(failureCount);
      }
    } catch {
      setDqFailureCount(0);
    }
  };

  const {
    tableTags,
    deleted,
    version,
    followers = [],
    entityName,
    id: tableId = '',
  } = useMemo(() => {
    if (tableDetails) {
      const { tags } = tableDetails;

      const { joins } = tableDetails ?? {};

      return {
        ...tableDetails,
        tier: getTierTags(tags ?? []),
        tableTags: getTagsWithoutTier(tags ?? []),
        entityName: getEntityName(tableDetails),
        joinedTables: getJoinsFromTableJoins(joins),
      };
    }

    return {} as Table & {
      tier: TagLabel;
      tableTags: EntityTags[];
      entityName: string;
      joinedTables: Array<{
        fullyQualifiedName: string;
        joinCount: number;
        name: string;
      }>;
    };
  }, [tableDetails, tableDetails?.tags]);

  // Edit-tier useEntityPermissions call — the counterpart to the view-tier call near the top
  // of this component (see its comment for why this component calls the hook twice). This is
  // the earliest point `deleted` exists (destructured just above, from {@code tableDetails}
  // resolved by the entity useQuery): every canEdit* flag is gated on it, so a soft-deleted
  // entity must read as edit-locked from the first render that knows about it — don't
  // destructure a canEdit* flag or `can` from the view-tier call above, it was captured
  // before `deleted` existed and would silently return an ungated edit permission.
  const {
    canEditCustomFields: editCustomAttributePermission,
    canEditLineage: editLineagePermission,
  } = useEntityPermissions(ResourceEntity.TABLE, tableFqn, {
    deleted: Boolean(deleted),
  });

  // Permission fetching itself now lives in useEntityPermissions (called above, twice). This
  // effect keeps the one unrelated side effect the old fetch effect's cleanup carried —
  // resetting the DQ lineage store when the table FQN changes — decoupled from permissions.
  useEffect(() => {
    return () => {
      setDqLineageData(undefined);
    };
  }, [tableFqn]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(EntityType.TABLE, tableFqn, handleFeedCount);
  };

  // P2-A: task counts drive the always-visible "Open Tasks" button in the page header chrome,
  // so they must stay eager on mount. The heavier activity-events fetch (up to 100 events just
  // to compute a count) only feeds the Activity Feed tab badge and is deferred below.
  const fetchTaskCounts = useCallback(() => {
    if (tableFqn) {
      fetchEntityTaskCountsInto(tableFqn, setFeedCount);
    }
  }, [tableFqn]);

  const fetchActivityCount = useCallback(() => {
    if (tableFqn) {
      fetchEntityActivityCountInto(EntityType.TABLE, tableFqn, setFeedCount);
    }
  }, [tableFqn]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab && !isTourOpen) {
      navigate(getEntityDetailsPath(EntityType.TABLE, tableFqn, activeKey), {
        replace: true,
        state: location.state,
      });
    }
  };

  const saveUpdatedTableData = useCallback(
    (updatedData: Table) => {
      if (!tableDetails) {
        return updatedData;
      }
      const jsonPatch = compare(tableDetails, updatedData);

      return patchTableDetails(tableId, jsonPatch);
    },
    [tableDetails, tableId]
  );

  const onTableUpdate = async (updatedTable: Table, key?: keyof Table) => {
    try {
      const res = await saveUpdatedTableData(updatedTable);

      setTableDetails((previous) => {
        if (!previous) {
          return;
        }

        return mergeEntityStateUpdate<Table>(previous, res, updatedTable, key);
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (newOwners?: Table['owners']) => {
      if (!tableDetails) {
        return;
      }
      const updatedTableDetails = {
        ...tableDetails,
        owners: newOwners,
      };
      await onTableUpdate(updatedTableDetails, 'owners');
    },
    [tableDetails]
  );

  const handleUpdateRetentionPeriod = useCallback(
    async (newRetentionPeriod: Table['retentionPeriod']) => {
      if (!tableDetails) {
        return;
      }
      const updatedTableDetails = {
        ...tableDetails,
        retentionPeriod: newRetentionPeriod,
      };
      await onTableUpdate(updatedTableDetails, 'retentionPeriod');
    },
    [tableDetails]
  );

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!tableDetails) {
      return;
    }
    const updatedTable = {
      ...tableDetails,
      displayName: isEmpty(data.displayName) ? undefined : data.displayName,
    };
    await onTableUpdate(updatedTable, 'displayName');
  };

  const onExtensionUpdate = async (updatedData: Table) => {
    tableDetails &&
      (await onTableUpdate(
        {
          ...tableDetails,
          extension: updatedData.extension,
        },
        'extension'
      ));
  };

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = tableClassBase.getTableDetailPageTabs({
      queryCount,
      isQueryCountLoading,
      isTourOpen,
      tablePermissions,
      activeTab,
      deleted,
      tableDetails,
      feedCount,
      getEntityFeedCount,
      handleFeedCount,
      viewAllPermission,
      viewCustomPropertiesPermission,
      editCustomAttributePermission,
      viewSampleDataPermission,
      viewQueriesPermission,
      viewProfilerPermission,
      editLineagePermission,
      fetchTableDetails: refetchTableDetails,
      isViewTableType,
      labelMap: tabLabelMap,
      columnFqn,
      columnPart,
    });

    const updatedTabs = getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.SCHEMA
    );

    return updatedTabs;
  }, [
    queryCount,
    isQueryCountLoading,
    isTourOpen,
    tablePermissions,
    activeTab,
    deleted,
    tableDetails,
    feedCount.totalCount,
    onExtensionUpdate,
    getEntityFeedCount,
    handleFeedCount,
    viewAllPermission,
    viewCustomPropertiesPermission,
    editCustomAttributePermission,
    viewSampleDataPermission,
    viewQueriesPermission,
    viewProfilerPermission,
    editLineagePermission,
    refetchTableDetails,
    isViewTableType,
    columnFqn,
    columnPart,
  ]);

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Table),
    [tabs[0], activeTab]
  );

  // {@code setTableDetails} is a closure over {@code tableCacheKey}, which itself depends on
  // {@code tableFields} (and therefore on the permission-derived USAGE_SUMMARY/TESTSUITE
  // extras). If permissions resolve after first render the cache key shifts; a stale closure
  // here would keep writing to the OLD slot while {@code useQuery} reads the NEW slot, so
  // entity-sync updates would silently no-op on screen. Including {@code setTableDetails} in
  // the deps re-binds the handler to the current slot.
  const handleTableSync = useCallback(
    (updatedTable: Table) => {
      setTableDetails(updatedTable);
    },
    [setTableDetails]
  );

  const onTierUpdate = useCallback(
    async (newTier?: Tag) => {
      if (tableDetails) {
        const tierTag: Table['tags'] = updateTierTag(tableTags, newTier);
        const updatedTableDetails = {
          ...tableDetails,
          tags: tierTag,
        };

        await onTableUpdate(updatedTableDetails, 'tags');
      }
    },
    [tableDetails, onTableUpdate, tableTags]
  );

  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (tableDetails) {
        const certificationTag: Table['certification'] =
          updateCertificationTag(newCertification);
        const updatedTableDetails = {
          ...tableDetails,
          certification: certificationTag,
        };

        await onTableUpdate(updatedTableDetails, 'certification');
      }
    },
    [tableDetails, onTableUpdate]
  );
  const handleToggleDelete = (version?: number) => {
    setTableDetails((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });
  };

  const handleRestoreTable = async () => {
    try {
      const { version: newVersion } = await restoreTable(
        tableDetails?.id ?? ''
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.table'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.table'),
        })
      );
    }
  };

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === USERId),
    };
  }, [followers, USERId]);

  // Optimistic follow/unfollow. Why this matters: the prior code awaited the PUT round-trip
  // before flipping the button text, so users saw 200–800 ms of "did my click register?"
  // every time. {@code onMutate} patches the cache synchronously so the button updates on
  // the SAME render that fires the network call; {@code onError} rolls back if the request
  // fails; {@code onSettled} invalidates the key so a background refetch picks up any
  // additional server-side state (e.g. timestamps).
  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: Table | undefined }
  >({
    mutationFn: async () => {
      if (isFollowing) {
        await removeFollower(tableId, USERId);
      } else {
        await addFollower(tableId, USERId);
      }
    },
    onMutate: async () => {
      // Cancel any in-flight refetch so it doesn't overwrite our optimistic patch.
      await queryClient.cancelQueries({ queryKey: tableCacheKey });
      const previous = queryClient.getQueryData<Table | undefined>(
        tableCacheKey
      );
      queryClient.setQueryData<Table | undefined>(tableCacheKey, (prev) => {
        if (!prev) {
          return prev;
        }
        const currentFollowers = prev.followers ?? [];
        if (isFollowing) {
          return {
            ...prev,
            followers: currentFollowers.filter(({ id }) => id !== USERId),
          };
        }

        return {
          ...prev,
          followers: [
            ...currentFollowers,
            // Minimal EntityReference patch; the real shape arrives on settle. The header
            // only reads {@code .id} to decide isFollowing, so the partial is sufficient.
            { id: USERId, type: 'user' },
          ] as Table['followers'],
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      // Roll back to the pre-mutation snapshot and surface the right error message.
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Table | undefined>(
          tableCacheKey,
          context.previous
        );
      }
      showErrorToast(
        error as AxiosError,
        isFollowing
          ? t('server.entity-unfollow-error', { entity: entityName })
          : t('server.entity-follow-error', { entity: entityName })
      );
    },
    onSettled: () => {
      // Background refetch picks up server-side changes we didn't represent (e.g. the new
      // entry's authoritative type/displayName). Stale data continues to render during the
      // refetch, so this is invisible to the user.
      queryClient.invalidateQueries({ queryKey: tableCacheKey });
    },
  });

  // {@code onFollowClick} on {@code DataAssetsHeader} is typed as a {@code () => Promise<void>}
  // so we wrap {@code mutate} in {@code mutateAsync} (which returns the promise) to satisfy
  // the type. The optimistic cache patch in {@code onMutate} fires synchronously regardless;
  // awaiting just keeps the prop contract intact for callers that chain off the click.
  const handleFollowTable = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const versionHandler = useCallback(() => {
    version &&
      navigate(getVersionPath(EntityType.TABLE, tableFqn, version + ''));
  }, [version, tableFqn]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    []
  );

  const updateTableDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Table;

      setTableDetails((data) => ({
        ...(updatedData ?? data),
        version: updatedData.version,
      }));
    },
    [setTableDetails]
  );

  const updateDescriptionTagFromSuggestions = useCallback(
    (suggestion: Suggestion) => {
      setTableDetails((prev) => {
        if (!prev) {
          return;
        }

        const activeCol = findColumnByEntityLink(
          prev.fullyQualifiedName ?? '',
          prev.columns,
          suggestion.entityLink
        );

        if (!activeCol) {
          return {
            ...prev,
            ...(suggestion.type === SuggestionType.SuggestDescription
              ? { description: suggestion.description }
              : { tags: suggestion.tagLabels }),
          };
        } else {
          const update =
            suggestion.type === SuggestionType.SuggestDescription
              ? { description: suggestion.description }
              : { tags: suggestion.tagLabels };

          // Update the column in the nested structure
          const updatedColumns = updateColumnInNestedStructure(
            prev.columns,
            activeCol.fullyQualifiedName ?? '',
            update
          );

          return {
            ...prev,
            columns: updatedColumns,
          };
        }
      });
    },
    [setTableDetails]
  );

  useEffect(() => {
    if (isTourOpen || isTourPage) {
      const mock = tourMockDatasetData as { tableDetails: unknown } | undefined;
      if (mock?.tableDetails) {
        setTableDetails(mock.tableDetails as Table);
      }
    } else if (viewBasicPermission) {
      // Don't manually clear the cache to {@code undefined} here — that would flash a Loader
      // on every navigation between tables even when the destination is already cached.
      // {@link useQuery}'s own refetch-on-key-change handles this: a stale entry serves
      // immediately while a background refresh runs.
      fetchTaskCounts();
      fetchActivityCount();
    }
  }, [
    tableFqn,
    isTourOpen,
    isTourPage,
    viewBasicPermission,
    tourMockDatasetData,
  ]);

  // P1.2: getTestCaseFailureCount drives the global red-alert badge in the page chrome,
  // so it must run as soon as tableDetails resolves — deferring would mean the user could
  // miss a critical "this dataset has failing tests" indicator on first paint.
  useEffect(() => {
    if (tableDetails) {
      getTestCaseFailureCount();
    }
  }, [tableDetails?.fullyQualifiedName]);

  useSub(
    'updateDetails',
    (suggestion: Suggestion) => {
      updateDescriptionTagFromSuggestions(suggestion);
    },
    [tableDetails]
  );

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateTablesVotes(id, data);
      // Server-side {@code updateVote} mutates a relationship only — the rest of the entity
      // is unchanged. Invalidate the cache slot so the next read picks up the new vote totals
      // (a focused refetch instead of the prior full-defaultFields refetch that overwrote
      // every other field too). Background revalidation keeps current data on screen until
      // the new body arrives.
      await queryClient.invalidateQueries({ queryKey: tableCacheKey });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const toggleTabExpanded = () => {
    setIsTabExpanded((prev) => !prev);
  };

  // Wait for permissions to resolve before deciding what to render — without this we'd flash
  // a "no permission" placeholder during the brief window before the permissions endpoint
  // returns. Once permissions are in, this gate falls through naturally. Skipped in tour mode,
  // matching the old `useState(!isTourOpen)` seed — the tour never waits on a real fetch.
  if (!isTourOpen && isPermissionsLoading) {
    return <TableDetailsPageSkeleton />;
  }

  if (!(isTourOpen || isTourPage) && !viewBasicPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.table-details'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  // Still loading the entity itself — useQuery is mid-flight or hasn't started (e.g. the
  // FQN just changed and the new cache slot is empty). Distinct from the permission gate
  // above so we keep the loader spinning instead of flashing the missing-entity placeholder.
  if (tableLoading) {
    return <PageLoader />;
  }

  // Fetch completed but no entity body — typically a 404 (invalid FQN) or a network error
  // that {@code tableError} surfaced. Show the missing-entity placeholder instead of
  // looping on the loader (the original page used a separate gate for this).
  if (!tableDetails) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <PageLayoutV1 pageTitle={entityName}>
      <GenericProvider<Table>
        columnFqn={columnFqn}
        customizedPage={customizedPage}
        data={tableDetails}
        isTabExpanded={isTabExpanded}
        isVersionView={false}
        key={tableFqn}
        permissions={tablePermissions}
        type={EntityType.TABLE}
        onEntitySync={handleTableSync}
        onUpdate={onTableUpdate}>
        <Row gutter={[0, 12]}>
          {/* Entity Heading */}
          <Col data-testid="entity-page-header" span={24}>
            <DataAssetsHeader
              isRecursiveDelete
              afterDeleteAction={afterDeleteAction}
              afterDomainUpdateAction={updateTableDetailsState}
              badge={alertBadge}
              breadcrumbData={breadcrumbData}
              dataAsset={tableDetails}
              entityType={EntityType.TABLE}
              extraDropdownContent={extraDropdownContent}
              openTaskCount={feedCount.openTaskCount}
              permissions={tablePermissions}
              onCertificationUpdate={onCertificationUpdate}
              onDisplayNameUpdate={handleDisplayNameUpdate}
              onFollowClick={handleFollowTable}
              onOwnerUpdate={handleUpdateOwner}
              onRestoreDataAsset={handleRestoreTable}
              onTierUpdate={onTierUpdate}
              onUpdateRetentionPeriod={handleUpdateRetentionPeriod}
              onUpdateVote={updateVote}
              onVersionClick={versionHandler}
            />
          </Col>
          {/* Entity Tabs */}
          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={isTourOpen ? activeTabForTourDatasetPage : activeTab}
              className="tabs-new"
              data-testid="tabs"
              items={tabs}
              tabBarExtraContent={
                isExpandViewSupported && (
                  <AlignRightIconButton
                    className={isTabExpanded ? 'rotate-180' : ''}
                    title={
                      isTabExpanded ? t('label.collapse') : t('label.expand')
                    }
                    onClick={toggleTabExpanded}
                  />
                )
              }
              onChange={handleTabChange}
            />
          </Col>
          <LimitWrapper resource="table">
            <></>
          </LimitWrapper>
        </Row>
      </GenericProvider>
    </PageLayoutV1>
  );
};

export default withSuggestions(withActivityFeed(TableDetailsPageV1));

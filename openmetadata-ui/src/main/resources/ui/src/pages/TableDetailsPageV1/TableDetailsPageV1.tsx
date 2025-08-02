/* eslint-disable i18next/no-literal-string */
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

import { Col, Row, Tabs, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { EntityTags } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as RedAlertIcon } from '../../assets/svg/ic-alert-red.svg';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import { withSuggestions } from '../../components/AppRouter/withSuggestions';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../components/common/IconButtons/EditIconButton';
import Loader from '../../components/common/Loader/Loader';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { ROUTES } from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  FqnPart,
  TabSpecificField,
} from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { DataContract } from '../../generated/entity/data/dataContract';
import { Table, TableType } from '../../generated/entity/data/table';
import {
  Suggestion,
  SuggestionType,
} from '../../generated/entity/feed/suggestion';
import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../generated/system/ui/page';
import { TestSummary } from '../../generated/tests/testCase';
import { TagLabel } from '../../generated/type/tagLabel';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { useSub } from '../../hooks/usePubSub';
import { FeedCounts } from '../../interface/feed.interface';
import { getContractByEntityId } from '../../rest/contractAPI';
import { getDataQualityLineage } from '../../rest/lineageAPI';
import { getQueriesList } from '../../rest/queryAPI';
import {
  addFollower,
  getTableDetailsByFQN,
  patchTableDetails,
  removeFollower,
  restoreTable,
  updateTablesVotes,
} from '../../rest/tableAPI';
import { getTestCaseExecutionSummary } from '../../rest/testAPI';
import {
  addToRecentViewed,
  getFeedCounts,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import { defaultFields } from '../../utils/DatasetDetailsUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import tableClassBase from '../../utils/TableClassBase';
import {
  findColumnByEntityLink,
  getJoinsFromTableJoins,
  getTagsWithoutTier,
  getTierTags,
  updateColumnInNestedStructure,
} from '../../utils/TableUtils';
import { updateCertificationTag, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { useTestCaseStore } from '../IncidentManager/IncidentManagerDetailPage/useTestCase.store';

const TableDetailsPageV1: React.FC = () => {
  const { isTourOpen, activeTabForTourDatasetPage, isTourPage } =
    useTourProvider();
  const { currentUser } = useApplicationStore();
  const { setDqLineageData } = useTestCaseStore();
  const [tableDetails, setTableDetails] = useState<Table>();
  const { tab: activeTab } = useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: datasetFQN } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const USERId = currentUser?.id ?? '';
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [queryCount, setQueryCount] = useState(0);

  const [loading, setLoading] = useState(!isTourOpen);
  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [testCaseSummary, setTestCaseSummary] = useState<TestSummary>();
  const [dqFailureCount, setDqFailureCount] = useState(0);
  const { customizedPage, isLoading } = useCustomPages(PageType.Table);
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const [dataContract, setDataContract] = useState<DataContract>();

  const tableFqn = useMemo(
    () =>
      getPartialNameFromTableFQN(
        datasetFQN,
        [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
        FQN_SEPARATOR_CHAR
      ),
    [datasetFQN]
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
    [tablePermissions, tableFqn, tableDetails]
  );

  const { viewUsagePermission, viewTestCasePermission } = useMemo(
    () => ({
      viewUsagePermission: getPrioritizedViewPermission(
        tablePermissions,
        Operation.ViewUsage
      ),
      viewTestCasePermission: getPrioritizedViewPermission(
        tablePermissions,
        Operation.ViewTests
      ),
    }),
    [
      tablePermissions,
      getPrioritizedViewPermission,
      getPrioritizedEditPermission,
    ]
  );

  const isViewTableType = useMemo(
    () => tableDetails?.tableType === TableType.View,
    [tableDetails?.tableType]
  );

  const fetchTableDetails = useCallback(async () => {
    setLoading(true);
    try {
      let fields = defaultFields;
      if (viewUsagePermission) {
        fields += `,${TabSpecificField.USAGE_SUMMARY}`;
      }
      if (viewTestCasePermission) {
        fields += `,${TabSpecificField.TESTSUITE}`;
      }

      const details = await getTableDetailsByFQN(tableFqn, { fields });
      setTableDetails(details);
      addToRecentViewed({
        displayName: getEntityName(details),
        entityType: EntityType.TABLE,
        fqn: details.fullyQualifiedName ?? '',
        serviceType: details.serviceType,
        timestamp: 0,
        id: details.id,
      });
    } catch (error) {
      if ((error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [tableFqn, viewUsagePermission]);

  const fetchDQFailureCount = async () => {
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

  const fetchTestCaseSummary = async () => {
    try {
      if (isUndefined(tableDetails?.testSuite?.id)) {
        setTestCaseSummary(undefined);
        await fetchDQFailureCount();

        return;
      }

      const response = await getTestCaseExecutionSummary(
        tableDetails?.testSuite?.id
      );
      setTestCaseSummary(response);

      const failureCount =
        response.columnTestSummary?.reduce((acc, curr) => {
          return acc + (curr.failed ?? 0);
        }, response.failed ?? 0) ??
        response.failed ??
        0;

      if (failureCount === 0) {
        await fetchDQFailureCount();
      } else {
        setDqFailureCount(failureCount);
      }
    } catch {
      setTestCaseSummary(undefined);
    }
  };

  const fetchQueryCount = async () => {
    if (!tableDetails?.id) {
      return;
    }
    try {
      const response = await getQueriesList({
        limit: 0,
        entityId: tableDetails.id,
      });
      setQueryCount(response.paging.total);
    } catch {
      setQueryCount(0);
    }
  };

  const fetchDataContract = async (tableId: string) => {
    try {
      const contract = await getContractByEntityId(tableId, EntityType.TABLE);
      setDataContract(contract);
    } catch {
      // Do nothing
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

  const fetchResourcePermission = useCallback(
    async (tableFqn: string) => {
      try {
        const tablePermission = await getEntityPermissionByFqn(
          ResourceEntity.TABLE,
          tableFqn
        );

        setTablePermissions(tablePermission);
      } catch {
        showErrorToast(
          t('server.fetch-entity-permissions-error', {
            entity: t('label.resource-permission-lowercase'),
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [getEntityPermissionByFqn, setTablePermissions]
  );

  useEffect(() => {
    if (tableFqn) {
      fetchResourcePermission(tableFqn);
    }

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

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      if (!isTourOpen) {
        navigate(getEntityDetailsPath(EntityType.TABLE, tableFqn, activeKey), {
          replace: true,
        });
      }
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

        const updatedObj = {
          ...previous,
          ...res,
          ...(key && { [key]: res[key] }),
        };

        // If operation was to remove let's remove the key itself
        if (key && res[key] === undefined) {
          delete updatedObj[key];
        }

        return updatedObj;
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
    const updatedTable = { ...tableDetails, displayName: data.displayName };
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

  const {
    editCustomAttributePermission,
    editLineagePermission,
    viewSampleDataPermission,
    viewQueriesPermission,
    viewProfilerPermission,
    viewAllPermission,
    viewBasicPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(tablePermissions, Operation.EditTags) &&
        !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          tablePermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          tablePermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          tablePermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editAllPermission: tablePermissions.EditAll && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(tablePermissions, Operation.EditLineage) &&
        !deleted,
      viewSampleDataPermission: getPrioritizedViewPermission(
        tablePermissions,
        Operation.ViewSampleData
      ),
      viewQueriesPermission: getPrioritizedViewPermission(
        tablePermissions,
        Operation.ViewQueries
      ),
      viewProfilerPermission: getPrioritizedViewPermission(
        tablePermissions,
        Operation.ViewDataProfile
      ),
      viewAllPermission: tablePermissions.ViewAll,
      viewBasicPermission: getPrioritizedViewPermission(
        tablePermissions,
        Operation.ViewBasic
      ),
    }),
    [tablePermissions, deleted]
  );

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = tableClassBase.getTableDetailPageTabs({
      queryCount,
      isTourOpen,
      tablePermissions,
      activeTab,
      deleted,
      tableDetails,
      feedCount,
      getEntityFeedCount,
      handleFeedCount,
      viewAllPermission,
      editCustomAttributePermission,
      viewSampleDataPermission,
      viewQueriesPermission,
      viewProfilerPermission,
      editLineagePermission,
      fetchTableDetails,
      testCaseSummary,
      isViewTableType,
      labelMap: tabLabelMap,
    });

    const updatedTabs = getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.SCHEMA
    );

    return updatedTabs;
  }, [
    queryCount,
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
    editCustomAttributePermission,
    viewSampleDataPermission,
    viewQueriesPermission,
    viewProfilerPermission,
    editLineagePermission,
    fetchTableDetails,
    testCaseSummary,
    isViewTableType,
  ]);

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Table),
    [tabs[0], activeTab]
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

  const followTable = useCallback(async () => {
    try {
      const res = await addFollower(tableId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setTableDetails((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, followers: newFollowers };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: entityName,
        })
      );
    }
  }, [USERId, tableId, entityName, setTableDetails]);

  const unFollowTable = useCallback(async () => {
    try {
      const res = await removeFollower(tableId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setTableDetails((pre) => {
        if (!pre) {
          return pre;
        }

        return {
          ...pre,
          followers: pre.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: entityName,
        })
      );
    }
  }, [USERId, tableId, entityName, setTableDetails]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === USERId),
    };
  }, [followers, USERId]);

  const handleFollowTable = useCallback(async () => {
    isFollowing ? await unFollowTable() : await followTable();
  }, [isFollowing, unFollowTable, followTable]);

  const versionHandler = useCallback(() => {
    version &&
      navigate(getVersionPath(EntityType.TABLE, tableFqn, version + ''));
  }, [version, tableFqn]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    []
  );

  const updateTableDetailsState = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as Table;

    setTableDetails((data) => ({
      ...(updatedData ?? data),
      version: updatedData.version,
    }));
  }, []);

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
    []
  );

  useEffect(() => {
    if (isTourOpen || isTourPage) {
      setTableDetails(mockDatasetData.tableDetails as unknown as Table);
    } else if (viewBasicPermission) {
      fetchTableDetails();
      getEntityFeedCount();
    }
  }, [tableFqn, isTourOpen, isTourPage, tablePermissions]);

  useEffect(() => {
    if (tableDetails) {
      fetchQueryCount();
      fetchTestCaseSummary();
    }
  }, [tableDetails?.fullyQualifiedName]);

  useEffect(() => {
    if (tableDetails) {
      fetchDataContract(tableDetails.id);
    }
  }, [tableDetails?.id]);

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
      const details = await getTableDetailsByFQN(tableFqn, {
        fields: defaultFields,
      });
      setTableDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const toggleTabExpanded = () => {
    setIsTabExpanded((prev) => !prev);
  };

  if (loading || isLoading) {
    return <Loader />;
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

  if (!tableDetails) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.table'),
      })}
      title="Table details">
      <GenericProvider<Table>
        customizedPage={customizedPage}
        data={tableDetails}
        isTabExpanded={isTabExpanded}
        isVersionView={false}
        permissions={tablePermissions}
        type={EntityType.TABLE}
        onUpdate={onTableUpdate}>
        <Row gutter={[0, 12]}>
          {/* Entity Heading */}
          <Col data-testid="entity-page-header" span={24}>
            <DataAssetsHeader
              isRecursiveDelete
              afterDeleteAction={afterDeleteAction}
              afterDomainUpdateAction={updateTableDetailsState}
              badge={alertBadge}
              dataAsset={tableDetails}
              dataContract={dataContract}
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

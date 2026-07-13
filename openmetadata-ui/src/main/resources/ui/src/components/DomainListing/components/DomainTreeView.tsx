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

import type { Key, Selection } from '@openmetadata/ui-core-components';
import {
  Avatar,
  Badge,
  Box,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare, Operation as JsonPathOperation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as FolderEmptyIcon } from '../../../assets/svg/folder-empty.svg';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, TabSpecificField } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import {
  addFollower,
  getDomainByName,
  getDomainChildrenPaginated,
  patchDomains,
  removeFollower,
  searchDomains,
} from '../../../rest/domainAPI';
import { filterDomainsToAllowed } from '../../../utils/DomainRestrictionUtils';
import { convertDomainsToTreeOptions } from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityAvatarProps } from '../../../utils/IconUtils';
import {
  escapeESReservedCharacters,
  getDecodedFqn,
  getEncodedFqn,
} from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import ResizableLeftPanels from '../../common/ResizablePanels/ResizableLeftPanels';
import DomainDetails from '../../Domain/DomainDetails/DomainDetails.component';
import '../../ExploreV1/exploreV1.less';

interface DomainTreeViewProps {
  searchQuery?: string;
  filters?: Record<string, string[]>;
  refreshToken?: number;
  openAddDomainDrawer?: () => void;
}

const INITIAL_PAGE_SIZE = 15;
const SCROLL_TRIGGER_THRESHOLD = 200;
const LOAD_MORE_ITEM_SUFFIX = '__load_more';

const DomainTreeView = ({
  searchQuery,
  filters,
  refreshToken = 0,
  openAddDomainDrawer,
}: DomainTreeViewProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { userDomains, isDomainRestricted } = useDomainStore();
  const { permissions } = usePermissionProvider();

  const [hierarchy, setHierarchy] = useState<Domain[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [selectedFqn, setSelectedFqn] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EntityTabs>(
    EntityTabs.DOCUMENTATION
  );
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [isHierarchyLoading, setIsHierarchyLoading] = useState<boolean>(false);
  const [isDomainLoading, setIsDomainLoading] = useState<boolean>(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [domainMapper, setDomainMapper] = useState<Record<string, Domain>>({});
  const [loadingChildren, setLoadingChildren] = useState<
    Record<string, boolean>
  >({});
  const [childPaging, setChildPaging] = useState<
    Record<
      string,
      {
        offset: number;
        limit: number;
        total: number;
      }
    >
  >({});

  const [rootPaging, setRootPaging] = useState({
    offset: 0,
    limit: INITIAL_PAGE_SIZE,
    total: 0,
  });
  const [hasMore, setHasMore] = useState<boolean>(true);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedFqnRef = useRef<string | null>(null);

  const currentUserId = currentUser?.id ?? '';

  const hasActiveFilters = useMemo(() => {
    if (!filters) {
      return false;
    }

    return Object.values(filters).some((values) => values && values.length > 0);
  }, [filters]);

  // TODO: Revert these changes once the backend API for domain search is implemented.
  // const queryFilter = useMemo(() => {
  //   if (!hasActiveFilters || !filters) {
  //     return undefined;
  //   }

  //   return domainBuildESQuery(filters);
  // }, [filters, hasActiveFilters]);

  useEffect(() => {
    const map: Record<string, Domain> = {};

    const buildIndex = (domains: Domain[]) => {
      for (const d of domains) {
        map[d.fullyQualifiedName as string] = d;

        if (d.children?.length) {
          buildIndex(d.children as unknown as Domain[]);
        }
      }
    };

    buildIndex(hierarchy);
    setDomainMapper(map);
  }, [hierarchy]);

  useEffect(() => {
    selectedFqnRef.current = selectedFqn;
  }, [selectedFqn]);

  const updateExpansionForFqn = useCallback((fqn: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      const current = fqn;
      next.add(current);

      return Array.from(next);
    });
  }, []);

  const selectDomain = (
    domains: Domain[],
    resetExpandedItems = false,
    domainFqn?: string
  ) => {
    const firstDomain = domains?.[0] ?? {};
    const initialFqn =
      domainFqn ??
      (firstDomain?.fullyQualifiedName || firstDomain?.name || firstDomain?.id);

    setSelectedFqn(initialFqn);

    if (resetExpandedItems) {
      setExpandedItems([initialFqn]);
    } else {
      updateExpansionForFqn(initialFqn);
    }

    return firstDomain;
  };

  const applySelection = useCallback(
    (
      domains: Domain[],
      resetExpandedItems = false,
      domainFqn?: string | undefined,
      shouldLoadChildren = true
    ) => {
      const firstDomain = selectDomain(domains, resetExpandedItems, domainFqn);

      if ((firstDomain?.childrenCount || 0) > 0 && shouldLoadChildren) {
        loadDomains(firstDomain.fullyQualifiedName as string);
      }
    },
    [updateExpansionForFqn, searchQuery]
  );

  const searchDomain = useCallback(
    async (value?: string) => {
      try {
        setIsHierarchyLoading(true);
        const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
        const results: Domain[] = await searchDomains(
          encodedValue,
          1
          // queryFilter
        );

        const filteredResults =
          isDomainRestricted && userDomains.length
            ? filterDomainsToAllowed(results, userDomains)
            : results;

        const updatedTreeData = convertDomainsToTreeOptions(filteredResults);
        setHierarchy(updatedTreeData as Domain[]);
        selectDomain(updatedTreeData as Domain[]);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.domain-plural'),
          })
        );
      } finally {
        setIsHierarchyLoading(false);
      }
    },
    [t, isDomainRestricted, userDomains]
  );

  const fetchDomainDetails = useCallback(
    async (fqn: string) => {
      if (!fqn) {
        setSelectedDomain(null);

        return;
      }
      setIsDomainLoading(true);
      try {
        const data = await getDomainByName(fqn, {
          fields: [
            TabSpecificField.CHILDREN,
            TabSpecificField.OWNERS,
            TabSpecificField.PARENT,
            TabSpecificField.EXPERTS,
            TabSpecificField.TAGS,
            TabSpecificField.FOLLOWERS,
            TabSpecificField.EXTENSION,
          ],
        });

        setSelectedDomain(data);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.domain-lowercase'),
          })
        );
      } finally {
        setIsDomainLoading(false);
      }
    },
    [t]
  );

  const handleError = useCallback(
    (error: unknown) => {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.domain-plural'),
        })
      );
    },
    [t]
  );

  const loadRootDomains = async (isLoadMore: boolean) => {
    const setLoadingState = isLoadMore
      ? setIsLoadingMore
      : setIsHierarchyLoading;
    setLoadingState(true);

    if (!isLoadMore) {
      setRootPaging({ offset: 0, limit: INITIAL_PAGE_SIZE, total: 0 });
      setHasMore(true);
    }

    try {
      const currentOffset = isLoadMore
        ? rootPaging.offset + rootPaging.limit
        : 0;

      const response = await getDomainChildrenPaginated(
        undefined,
        rootPaging.limit,
        currentOffset
      );

      const rawDomains = response.data ?? [];
      const domains =
        isDomainRestricted && userDomains.length
          ? filterDomainsToAllowed(rawDomains, userDomains)
          : rawDomains;
      const total = response.paging.total;

      setHierarchy((prev) => (isLoadMore ? [...prev, ...domains] : domains));

      if (!isLoadMore) {
        applySelection(domains, true);
      }

      setRootPaging({
        offset: currentOffset,
        limit: rootPaging.limit,
        total,
      });

      setHasMore(currentOffset + rootPaging.limit < total);
    } catch (error) {
      handleError(error);
    } finally {
      setLoadingState(false);
    }
  };

  const updateNested = (
    domains: EntityReference[],
    targetFqn: string,
    newChildren: Domain[],
    isAppend = false
  ): EntityReference[] => {
    return domains.map((domain) => {
      const domainData = domain as unknown as Domain;
      if (domainData.fullyQualifiedName === targetFqn) {
        return {
          ...domainData,
          children: isAppend
            ? [...(domainData.children ?? []), ...newChildren]
            : newChildren,
        } as unknown as EntityReference;
      }

      if (domainData.children?.length) {
        return {
          ...domainData,
          children: updateNested(
            domainData.children,
            targetFqn,
            newChildren,
            isAppend
          ),
        } as unknown as EntityReference;
      }

      return domain;
    });
  };

  const updateDomainInHierarchy = (
    domains: Domain[],
    updatedDomain: Domain
  ): Domain[] => {
    return domains.map((domain) => {
      if (domain.id === updatedDomain.id) {
        return {
          ...updatedDomain,
          children: domain.children,
        };
      }

      if (domain.children?.length) {
        return {
          ...domain,
          children: updateDomainInHierarchy(
            domain.children as unknown as Domain[],
            updatedDomain
          ) as unknown as EntityReference[],
        };
      }

      return domain;
    });
  };

  const loadChildDomains = useCallback(
    async (parentFqn: string, isLoadMore = false) => {
      setLoadingChildren((prev) => ({ ...prev, [parentFqn]: true }));

      try {
        const currentPaging = childPaging[parentFqn] || {
          offset: 0,
          limit: INITIAL_PAGE_SIZE,
          total: 0,
        };

        const currentOffset = isLoadMore
          ? currentPaging.offset + currentPaging.limit
          : 0;

        const response = await getDomainChildrenPaginated(
          parentFqn,
          INITIAL_PAGE_SIZE,
          currentOffset
        );
        const children = response.data ?? [];
        const total = response.paging.total;

        setChildPaging((prev) => ({
          ...prev,
          [parentFqn]: {
            offset: currentOffset,
            limit: INITIAL_PAGE_SIZE,
            total,
          },
        }));

        setHierarchy((prev): Domain[] => {
          const updated = prev.map((domain) => {
            if (domain.fullyQualifiedName === parentFqn) {
              return {
                ...domain,
                children: isLoadMore
                  ? [...(domain.children ?? []), ...children]
                  : children,
              };
            }

            if (domain.children?.length) {
              return {
                ...domain,
                children: updateNested(
                  domain.children,
                  parentFqn,
                  children,
                  isLoadMore
                ),
              };
            }

            return domain;
          });

          return updated as Domain[];
        });
      } catch (error) {
        handleError(error);
      } finally {
        setLoadingChildren((prev) => ({ ...prev, [parentFqn]: false }));
      }
    },
    [handleError, childPaging]
  );

  const loadDomains = useCallback(
    async (parentFqn?: string, isLoadMore = false) => {
      const key = parentFqn || '__root__';
      if (loadingChildren[key]) {
        return;
      }

      if (parentFqn) {
        await loadChildDomains(parentFqn, isLoadMore);
      } else {
        await loadRootDomains(isLoadMore);
      }
    },
    [loadingChildren, rootPaging, applySelection, loadChildDomains]
  );
  useEffect(() => {
    if (searchQuery || hasActiveFilters) {
      searchDomain(searchQuery);
    } else {
      loadDomains();
    }
  }, [refreshToken, searchQuery, hasActiveFilters]);

  useEffect(() => {
    if (selectedFqn) {
      fetchDomainDetails(selectedFqn);
      updateExpansionForFqn(selectedFqn);
    }
  }, [fetchDomainDetails, selectedFqn, updateExpansionForFqn]);

  useEffect(() => {
    if (selectedFqn) {
      setActiveTab(EntityTabs.DOCUMENTATION);
    }
  }, [selectedFqn]);

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        return;
      }

      const nextFqn = Array.from(keys).map(String)[0] ?? null;

      if (
        !nextFqn ||
        nextFqn.endsWith(LOAD_MORE_ITEM_SUFFIX) ||
        nextFqn === selectedFqnRef.current
      ) {
        return;
      }

      setSelectedFqn(nextFqn);
      updateExpansionForFqn(nextFqn);
    },
    [updateExpansionForFqn]
  );

  const handleExpandedChange = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        return;
      }

      const ids = Array.from(keys).map(String);
      const newlyExpandedIds = ids.filter((id) => !expandedItems.includes(id));

      for (const fqn of newlyExpandedIds) {
        const domain = domainMapper[fqn];

        if (!domain) {
          continue;
        }

        const hasLoaded = (domain.children?.length || 0) > 0;
        const hasChildrenCount = (domain.childrenCount ?? 0) > 0;

        if (!hasLoaded && hasChildrenCount && !loadingChildren[fqn]) {
          loadDomains(fqn);
        }
      }

      setExpandedItems(ids);
    },
    [expandedItems, domainMapper, loadDomains, loadingChildren]
  );

  const refreshAll = useCallback(async () => {
    if (searchQuery) {
      await searchDomain(searchQuery);

      return;
    }
    await loadDomains(selectedFqn ?? undefined);
  }, [loadDomains, selectedFqn, searchDomain, searchQuery]);

  const handleDomainUpdate = useCallback(
    async (updatedData: Domain) => {
      if (!selectedDomain) {
        return;
      }

      const jsonPatch = compare(
        selectedDomain,
        updatedData
      ) as unknown as Operation[];
      try {
        const response = await patchDomains(
          selectedDomain.id,
          jsonPatch as unknown as JsonPathOperation[]
        );
        setSelectedDomain(response);

        if (response.fullyQualifiedName) {
          setSelectedFqn(response.fullyQualifiedName);
        }

        setHierarchy((prev) => updateDomainInHierarchy(prev, response));

        await refreshAll();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [refreshAll, selectedDomain]
  );

  const handleDomainDelete = useCallback(async () => {
    const deletedFqn = selectedFqnRef.current;
    const domainToDelete = domainMapper[deletedFqn as string];
    const parentDomainFqn = domainToDelete?.parent?.fullyQualifiedName;

    setHierarchy((prev) => {
      const removeDomain = (domains: Domain[]): Domain[] => {
        const result: Domain[] = [];

        for (const domain of domains) {
          if (domain.fullyQualifiedName === deletedFqn) {
            continue;
          }

          if (domain.children?.length) {
            const newChildren = removeDomain(
              domain.children as unknown as Domain[]
            );
            result.push({
              ...domain,
              children: newChildren as unknown as EntityReference[],
            });
          } else {
            result.push(domain);
          }
        }

        return result;
      };

      const result = removeDomain(prev);

      applySelection(result, false, parentDomainFqn, false);

      return result;
    });

    setSelectedDomain(null);
  }, [domainMapper, applySelection]);

  const followDomain = useCallback(async () => {
    if (!selectedDomain?.id || !currentUserId) {
      return;
    }

    try {
      const res = await addFollower(selectedDomain.id, currentUserId);
      const { newValue } = res.changeDescription.fieldsAdded?.[0] ?? {};

      setSelectedDomain((prev) =>
        prev
          ? {
              ...prev,
              followers: [...(prev.followers ?? []), ...(newValue ?? [])],
            }
          : prev
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(selectedDomain),
        })
      );
    }
  }, [currentUserId, selectedDomain, t]);

  const unFollowDomain = useCallback(async () => {
    if (!selectedDomain?.id || !currentUserId) {
      return;
    }

    try {
      const res = await removeFollower(selectedDomain.id, currentUserId);
      const { oldValue } = res.changeDescription.fieldsDeleted?.[0] ?? {};
      const removedFollowerId = oldValue?.[0]?.id;

      setSelectedDomain((prev) =>
        prev
          ? {
              ...prev,
              followers:
                prev.followers?.filter(
                  (follower) => follower.id !== removedFollowerId
                ) ?? [],
            }
          : prev
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(selectedDomain),
        })
      );
    }
  }, [currentUserId, selectedDomain, t]);

  const isFollowing = useMemo(() => {
    if (!selectedDomain?.followers?.length || !currentUserId) {
      return false;
    }

    return selectedDomain.followers.some(({ id }) => id === currentUserId);
  }, [currentUserId, selectedDomain?.followers]);

  const handleFollowingToggle = useCallback(async () => {
    if (!selectedDomain) {
      return;
    }
    setIsFollowingLoading(true);
    try {
      if (isFollowing) {
        await unFollowDomain();
      } else {
        await followDomain();
      }
    } finally {
      setIsFollowingLoading(false);
    }
  }, [followDomain, isFollowing, selectedDomain, unFollowDomain]);

  const handleNavigate = useCallback(
    (path: string) => {
      if (path.includes('/versions/')) {
        navigate(path);

        return;
      }

      const regex = /^\/domain\/([^/]+)(?:\/([^/]+))?/;
      const match = regex.exec(path);
      if (match) {
        const decodedFqn = getDecodedFqn(match[1]);
        setSelectedFqn(decodedFqn);

        const requestedTab = match[2] as EntityTabs | undefined;
        if (requestedTab && Object.values(EntityTabs).includes(requestedTab)) {
          setActiveTab(requestedTab);
        } else {
          setActiveTab(EntityTabs.DOCUMENTATION);
        }

        updateExpansionForFqn(decodedFqn);
        fetchDomainDetails(decodedFqn);
      } else {
        navigate(path);
      }
    },
    [fetchDomainDetails, navigate, updateExpansionForFqn]
  );

  const handleAction = useCallback(
    (key: Key) => {
      const keyStr = String(key);

      if (keyStr.endsWith(LOAD_MORE_ITEM_SUFFIX)) {
        const parentFqn = keyStr.slice(0, -LOAD_MORE_ITEM_SUFFIX.length);
        loadDomains(parentFqn, true);
      }
    },
    [loadDomains]
  );

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (
        !hasMore ||
        isLoadingMore ||
        isHierarchyLoading ||
        searchQuery ||
        hasActiveFilters
      ) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;

      if (scrollHeight - scrollTop - clientHeight < SCROLL_TRIGGER_THRESHOLD) {
        loadDomains(undefined, true);
      }
    },
    [
      hasMore,
      isLoadingMore,
      isHierarchyLoading,
      searchQuery,
      hasActiveFilters,
      loadDomains,
    ]
  );

  const renderTreeItems = useCallback(
    (nodes: Domain[]) => {
      return nodes.map((node) => {
        const identifier = node?.fullyQualifiedName || node?.name || node?.id;

        if (!identifier) {
          return null;
        }

        const childDomains = (node?.children as unknown as Domain[]) ?? [];
        const childrenCount = node?.childrenCount || childDomains?.length || 0;
        const hasChildren = childDomains?.length > 0 || childrenCount > 0;
        const isLoading = loadingChildren?.[identifier] ?? false;
        const paging = childPaging?.[identifier];
        const hasMoreChildren =
          paging != null && paging?.offset + paging?.limit < paging?.total;

        return (
          <Tree.Item
            id={identifier}
            key={identifier}
            textValue={getEntityName(node)}>
            <Tree.ItemContent showGuideLines hasChildItems={hasChildren}>
              <Box align="center" direction="row" gap={2}>
                <Avatar size="xs" {...getEntityAvatarProps(node)} />
                <Typography
                  className="tw:text-primary"
                  size="text-sm"
                  weight="regular">
                  {getEntityName(node)}
                </Typography>
                {hasChildren && (
                  <Badge
                    className="tw:px-3"
                    color="gray"
                    size="xs"
                    type="pill-color">
                    {childrenCount}
                  </Badge>
                )}
                {isLoading && <Loader size="small" />}
              </Box>
            </Tree.ItemContent>
            {childDomains.length > 0 && renderTreeItems(childDomains)}
            {hasMoreChildren && (
              <Tree.Item
                id={`${identifier}${LOAD_MORE_ITEM_SUFFIX}`}
                key={`${identifier}${LOAD_MORE_ITEM_SUFFIX}`}
                textValue={t('label.load-more')}>
                <Tree.ItemContent showExpandIcon={false}>
                  <button
                    className="tw:flex tw:items-center tw:gap-2 tw:cursor-pointer tw:text-brand-primary tw:text-sm"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadDomains(identifier, true);
                    }}>
                    {loadingChildren[identifier] ? (
                      <Loader size="small" />
                    ) : (
                      t('label.load-more')
                    )}
                  </button>
                </Tree.ItemContent>
              </Tree.Item>
            )}
          </Tree.Item>
        );
      });
    },
    [loadingChildren, childPaging, loadDomains, t]
  );

  const domainSection = useMemo(() => {
    if (isDomainLoading) {
      return <Loader />;
    }

    if (selectedDomain) {
      return (
        <DomainDetails
          isTreeView
          activeTab={activeTab}
          domain={selectedDomain}
          handleFollowingClick={handleFollowingToggle}
          isFollowing={isFollowing}
          isFollowingLoading={isFollowingLoading}
          refreshDomains={refreshAll}
          onActiveTabChange={setActiveTab}
          onDelete={handleDomainDelete}
          onNavigate={handleNavigate}
          onUpdate={handleDomainUpdate}
        />
      );
    }

    return (
      <Typography className="tw:text-secondary tw:mt-2" size="text-sm">
        {t('label.no-entity-selected', {
          entity: t('label.domain'),
        })}
      </Typography>
    );
  }, [
    isDomainLoading,
    selectedDomain,
    activeTab,
    handleFollowingToggle,
    isFollowing,
    isFollowingLoading,
    refreshAll,
    handleDomainDelete,
    handleNavigate,
    handleDomainUpdate,
    t,
  ]);

  const hierarchySection = useMemo(() => {
    if (isHierarchyLoading) {
      return <Loader />;
    }

    if (hierarchy.length === 0) {
      return (
        <Typography className="tw:text-secondary tw:mt-2" size="text-sm">
          {t('label.no-entity-available', {
            entity: t('label.domain-plural'),
          })}
        </Typography>
      );
    }

    return (
      <>
        <Tree
          aria-label={t('label.domain-plural')}
          className="domain-tree-view"
          expandedKeys={new Set(expandedItems)}
          selectedKeys={
            selectedFqn ? new Set([selectedFqn]) : new Set<string>()
          }
          selectionMode="single"
          onAction={handleAction}
          onExpandedChange={handleExpandedChange}
          onSelectionChange={handleSelectionChange}>
          {renderTreeItems(hierarchy)}
        </Tree>
        {isLoadingMore && (
          <Box className="tw:py-2" justify="center">
            <Loader size="small" />
          </Box>
        )}
      </>
    );
  }, [
    isHierarchyLoading,
    hierarchy,
    expandedItems,
    selectedFqn,
    isLoadingMore,
    handleExpandedChange,
    handleSelectionChange,
    renderTreeItems,
    t,
  ]);
  if (!isHierarchyLoading && isEmpty(hierarchy)) {
    return (
      <ErrorPlaceHolder
        buttonId="domain-add-button"
        buttonTitle={t('label.add-entity', {
          entity: t('label.domain'),
        })}
        className="border-none"
        heading={t('message.no-data-message', {
          entity: t('label.domain-lowercase-plural'),
        })}
        icon={<FolderEmptyIcon />}
        permission={permissions.domain?.Create}
        type={ERROR_PLACEHOLDER_TYPE.CORE_CREATE}
        onClick={openAddDomainDrawer}
      />
    );
  }

  return (
    <ResizableLeftPanels
      showLearningIcon
      firstPanel={{
        className: 'domain-tree-panel border-right border-gray-200',
        minWidth: 280,
        flex: 0.25,
        title: t('label.domain-plural'),
        children: (
          <div
            className="tw:pt-4.5 tw:pr-3 tw:overflow-y-auto tw:max-h-[calc(80vh-220px)]"
            ref={scrollContainerRef}
            onScroll={handleScroll}>
            {hierarchySection}
          </div>
        ),
      }}
      learningPageId={LEARNING_PAGE_IDS.DOMAIN}
      learningTitle={t('label.domain-plural')}
      secondPanel={{
        className: 'domain-details-panel',
        minWidth: 600,
        flex: 0.75,
        children: (
          <div className="tw:pt-3 tw:overflow-y-auto tw:max-h-[calc(80vh-160px)]">
            {domainSection}
          </div>
        ),
      }}
    />
  );
};

export default DomainTreeView;

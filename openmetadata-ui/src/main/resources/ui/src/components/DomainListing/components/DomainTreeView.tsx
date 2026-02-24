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

import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Chip, Typography, useTheme } from '@mui/material';
import { SimpleTreeView, TreeItem, treeItemClasses } from '@mui/x-tree-view';
import { AxiosError } from 'axios';
import { compare, Operation as JsonPathOperation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ArrowCircleDown } from '../../../assets/svg/arrow-circle-down.svg';
import { ReactComponent as FolderEmptyIcon } from '../../../assets/svg/folder-empty.svg';
import { BORDER_COLOR } from '../../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, TabSpecificField } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  addFollower,
  getDomainByName,
  getDomainChildrenPaginated,
  patchDomains,
  removeFollower,
  searchDomains,
} from '../../../rest/domainAPI';
import { convertDomainsToTreeOptions } from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  escapeESReservedCharacters,
  getDecodedFqn,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { EntityAvatar } from '../../common/EntityAvatar/EntityAvatar';
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

const DomainTreeView = ({
  searchQuery,
  filters,
  refreshToken = 0,
  openAddDomainDrawer,
}: DomainTreeViewProps) => {
  const theme = useTheme();
  const outlineColor =
    theme.palette.allShades?.gray?.[200] ?? theme.palette.grey[300];
  const childIndent = theme.spacing(2);
  const connectorOffset = theme.spacing(1.5);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
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

        const updatedTreeData = convertDomainsToTreeOptions(results);
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
    [t]
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

      const domains = response.data ?? [];
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
    (value: string | string[] | null) => {
      const nextFqn = Array.isArray(value) ? value[0] : value;
      if (!nextFqn || nextFqn === selectedFqnRef.current) {
        return;
      }

      setSelectedFqn(nextFqn);
      updateExpansionForFqn(nextFqn);
    },
    [updateExpansionForFqn]
  );

  const handleExpandedChange = useCallback(
    (_: unknown, ids: string[]) => {
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
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < SCROLL_TRIGGER_THRESHOLD) {
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

  const handleLoadMoreChildren = useCallback(
    (parentFqn: string, event: React.MouseEvent) => {
      event.stopPropagation();
      loadDomains(parentFqn, true);
    },
    [loadDomains]
  );

  const renderTreeItems = useCallback(
    (nodes: Domain[], parentFqn?: string) => {
      const items = nodes.map((node) => {
        const identifier = node.fullyQualifiedName || node.name || node.id;

        if (!identifier) {
          return null;
        }

        const childDomains = (node.children as unknown as Domain[]) ?? [];
        const childrenCount = node.childrenCount || childDomains.length || 0;
        const hasChildren = childDomains.length > 0 || childrenCount > 0;
        const isLoading = loadingChildren[identifier] ?? false;

        return (
          <TreeItem
            itemId={identifier}
            key={identifier}
            label={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}>
                <EntityAvatar entity={node} size={24} variant="rounded" />
                <Typography
                  sx={{
                    color: theme.palette.allShades?.gray?.[800],
                  }}
                  variant="body2">
                  {getEntityName(node)}
                </Typography>
                {hasChildren && (
                  <Chip
                    label={childrenCount}
                    size="small"
                    sx={{
                      height: 20,
                      border: 'none',
                      color: theme.palette.allShades?.gray?.[800],
                      fontWeight: theme.typography.fontWeightRegular,
                      backgroundColor: theme.palette.allShades?.blueGray?.[100],
                    }}
                  />
                )}
                {isLoading && <Loader size="small" />}
              </Box>
            }>
            {childDomains.length > 0
              ? renderTreeItems(childDomains, identifier)
              : hasChildren && <div />}
          </TreeItem>
        );
      });

      if (parentFqn) {
        const paging = childPaging[parentFqn];
        if (paging) {
          const hasMoreChildren = paging.offset + paging.limit < paging.total;
          const isLoadingMore = loadingChildren[parentFqn] ?? false;

          if (hasMoreChildren) {
            items.push(
              <Box
                key={`${parentFqn}-load-more`}
                sx={{
                  ml: 1,
                  mb: 1.5,
                }}>
                <Button
                  startIcon={isLoadingMore ? null : <AddIcon />}
                  sx={{
                    p: 0,
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: theme.palette.primary.main,
                    fontWeight: theme.typography.fontWeightMedium,
                    '&:hover': {
                      color: theme.palette.primary.dark,
                      backgroundColor: 'transparent',
                    },
                  }}
                  variant="text"
                  onClick={(e) => handleLoadMoreChildren(parentFqn, e)}>
                  {isLoadingMore ? (
                    <Loader size="small" />
                  ) : (
                    <div>{t('label.load-more')}</div>
                  )}
                </Button>
              </Box>
            );
          }
        }
      }

      return items;
    },
    [
      childIndent,
      connectorOffset,
      outlineColor,
      theme.palette.allShades?.gray,
      theme.palette.primary.main,
      theme.typography.fontWeightMedium,
      theme.typography.fontWeightRegular,
      loadingChildren,
      childPaging,
      handleLoadMoreChildren,
      t,
      hierarchy,
    ]
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
      <Typography sx={{ color: 'text.secondary', mt: 2 }} variant="body2">
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
        <Typography sx={{ color: 'text.secondary', mt: 2 }} variant="body2">
          {t('label.no-entity-available', {
            entity: t('label.domain-plural'),
          })}
        </Typography>
      );
    }

    return (
      <>
        <SimpleTreeView
          expandedItems={expandedItems}
          selectedItems={selectedFqn}
          slots={{
            expandIcon: ArrowCircleDown,
            collapseIcon: ArrowCircleDown,
          }}
          sx={{
            '--tree-item-center': '22px',
            '& .MuiTreeItem-content': {
              borderRadius: 1,
              gap: 2,
              p: 0,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: '-24px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '1px',
                background: theme.palette.allShades?.gray?.[200],
                zIndex: 0,
              },
            },

            '& .MuiTreeItem-label': { p: 1 },
            '& .MuiChip-root': { px: 3 },
            '& .MuiChip-label': { fontSize: '10px' },

            '& .MuiTreeItem-iconContainer': {
              transition: 'transform 0.2s ease-in-out',
              '& svg': {
                transform: 'rotate(-90deg)',
              },
            },

            '& .Mui-expanded > .MuiTreeItem-iconContainer svg': {
              transform: 'rotate(0deg)',
            },

            '& .MuiTreeItem-iconContainer:empty': { display: 'none' },

            [`& .${treeItemClasses.groupTransition}`]: {
              ml: 3,
              pl: 5,
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: '-4.5px',
                top: '-24px',
                bottom: '24px',
                width: '1px',
                background: theme.palette.allShades?.gray?.[200],
                zIndex: 0,
              },
            },

            '& .MuiTreeItem-root:last-of-type, & .MuiTreeItem-group > .MuiTreeItem-root:last-of-type':
              {
                mb: 0,
              },

            '& .MuiTreeItem-content:has(.MuiTreeItem-iconContainer:empty)': {
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
              '&.Mui-selected': {
                backgroundColor: theme.palette.allShades?.blue?.[50],
              },
            },

            '& .MuiTreeItem-content:has(.MuiTreeItem-iconContainer:not(:empty))':
              {
                '&:hover, &.Mui-selected': {
                  backgroundColor: 'transparent !important',
                },
                '&:hover .MuiTreeItem-label': {
                  backgroundColor: theme.palette.action.hover,
                  borderRadius: '8px',
                },
                '&.Mui-selected .MuiTreeItem-label': {
                  backgroundColor: theme.palette.allShades?.blue?.[50],
                  borderRadius: '8px',
                },
              },
            'ul.MuiSimpleTreeView-itemGroupTransition:not(:has(.MuiTreeItem-iconContainer > svg))':
              {
                pl: '32px !important',
              },
            'ul.MuiSimpleTreeView-itemGroupTransition:not(:has(.MuiTreeItem-iconContainer > svg)) li .MuiTreeItem-content::before':
              {
                left: '-36px',
                width: '32px',
              },
            'li[style*="--TreeView-itemDepth:"] .MuiTreeItem-content::before': {
              borderBottom: `1px solid ${BORDER_COLOR}`,
              backgroundColor: 'transparent',
            },
            'li[style*="--TreeView-itemDepth:"] .MuiCollapse-vertical::before':
              {
                borderLeft: `1px solid ${BORDER_COLOR}`,
                backgroundColor: 'transparent',
              },
            'li[style*="--TreeView-itemDepth:"]:not([style*="--TreeView-itemDepth: 0"]):not([style*="--TreeView-itemDepth: 1"]) .MuiTreeItem-content::before':
              {
                borderBottom: `1px dashed ${BORDER_COLOR}`,
                backgroundColor: 'transparent',
              },
            'li[style*="--TreeView-itemDepth:"]:not([style*="--TreeView-itemDepth: 0"]) .MuiCollapse-vertical::before':
              {
                borderLeft: `1px dashed ${BORDER_COLOR}`,
                backgroundColor: 'transparent',
                bottom: '24px',
              },
          }}
          onExpandedItemsChange={handleExpandedChange}
          onSelectedItemsChange={(_, value) => handleSelectionChange(value)}>
          {renderTreeItems(hierarchy)}
        </SimpleTreeView>
        {isLoadingMore && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
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
    theme.palette.allShades?.gray,
    theme.palette.allShades?.blue,
    handleExpandedChange,
    handleSelectionChange,
    renderTreeItems,
    isLoadingMore,
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
        type={ERROR_PLACEHOLDER_TYPE.MUI_CREATE}
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
          <Box
            ref={scrollContainerRef}
            sx={{
              pt: 4.5,
              pr: 3,
              overflowY: 'auto',
              maxHeight: 'calc(80vh - 160px)',
            }}
            onScroll={handleScroll}>
            {hierarchySection}
          </Box>
        ),
      }}
      learningPageId={LEARNING_PAGE_IDS.DOMAIN}
      learningTitle={t('label.domain-plural')}
      secondPanel={{
        className: 'domain-details-panel',
        minWidth: 600,
        flex: 0.75,
        children: (
          <Box
            sx={{
              pt: 3,
              overflowY: 'auto',
              maxHeight: 'calc(80vh - 160px)',
            }}>
            {domainSection}
          </Box>
        ),
      }}
    />
  );
};

export default DomainTreeView;

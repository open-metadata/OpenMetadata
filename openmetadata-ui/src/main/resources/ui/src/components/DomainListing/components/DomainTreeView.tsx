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

import { Box, Chip, Typography, useTheme } from '@mui/material';
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
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, TabSpecificField } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  addFollower,
  getDomainByName,
  listDomainHierarchy,
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
import DomainDetails from '../../Domain/DomainDetails/DomainDetails.component';

interface DomainTreeViewProps {
  searchQuery?: string;
  onDomainMutated?: () => void;
  refreshToken?: number;
  openAddDomainDrawer?: () => void;
}

type DomainHierarchyMap = Record<string, Domain>;
type DomainParentMap = Record<string, string | undefined>;

const TREE_CONTAINER_MIN_WIDTH = 320;

const DomainTreeView = ({
  searchQuery,
  onDomainMutated,
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

  const [parentMap, setParentMap] = useState<DomainParentMap>({});

  const selectedFqnRef = useRef<string | null>(null);

  const currentUserId = currentUser?.id ?? '';

  useEffect(() => {
    selectedFqnRef.current = selectedFqn;
  }, [selectedFqn]);

  const buildHierarchyMaps = useCallback((domains: Domain[]) => {
    const map: DomainHierarchyMap = {};
    const parents: DomainParentMap = {};

    const traverse = (nodes: Domain[], parentFqn?: string) => {
      for (const node of nodes) {
        const identifier = node.fullyQualifiedName || node.name || node.id;

        if (!identifier) {
          continue;
        }

        map[identifier] = node;

        if (parentFqn) {
          parents[identifier] = parentFqn;
        }

        const childDomains = (node.children as unknown as Domain[]) ?? [];

        if (childDomains.length) {
          traverse(childDomains, identifier);
        }
      }
    };

    traverse(domains);

    return { map, parents };
  }, []);

  const updateExpansionForFqn = useCallback(
    (fqn: string, parents: DomainParentMap) => {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        let current = fqn;
        while (current) {
          next.add(current);
          const parent = parents[current];
          if (parent && !next.has(parent)) {
            current = parent;
          } else {
            break;
          }
        }

        return Array.from(next);
      });
    },
    []
  );

  const applySelection = useCallback(
    (domains: Domain[]) => {
      const { map, parents } = buildHierarchyMaps(domains);
      setParentMap(parents);

      const existingSelection = selectedFqnRef.current;

      const initialFqn =
        domains[0]?.fullyQualifiedName || domains[0]?.name || domains[0]?.id;

      if (existingSelection && map[existingSelection]) {
        updateExpansionForFqn(existingSelection, parents);
      } else if (initialFqn) {
        setSelectedFqn(initialFqn);
        updateExpansionForFqn(initialFqn, parents);
      }
    },
    [buildHierarchyMaps]
  );

  const searchDomain = async (value: string) => {
    try {
      setIsHierarchyLoading(true);
      const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
      const results: Domain[] = await searchDomains(encodedValue);

      const updatedTreeData = convertDomainsToTreeOptions(results);
      setHierarchy(updatedTreeData as Domain[]);
      applySelection(updatedTreeData as Domain[]);
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
  };

  const fetchHierarchy = useCallback(async () => {
    setIsHierarchyLoading(true);
    try {
      const response = await listDomainHierarchy({
        limit: 1000,
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
      const domains = response.data ?? [];

      setHierarchy(domains);
      applySelection(domains);
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
  }, [buildHierarchyMaps, t, updateExpansionForFqn]);

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

  useEffect(() => {
    if (searchQuery) {
      searchDomain(searchQuery);
    } else {
      setSelectedFqn(null);
      fetchHierarchy();
    }
  }, [fetchHierarchy, refreshToken, searchQuery]);

  useEffect(() => {
    if (selectedFqn) {
      fetchDomainDetails(selectedFqn);
      updateExpansionForFqn(selectedFqn, parentMap);
    }
  }, [fetchDomainDetails, parentMap, selectedFqn, updateExpansionForFqn]);

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
      updateExpansionForFqn(nextFqn, parentMap);
    },
    [parentMap, updateExpansionForFqn]
  );

  const handleExpandedChange = useCallback((_: unknown, ids: string[]) => {
    setExpandedItems(ids);
  }, []);

  const refreshAll = useCallback(async () => {
    if (onDomainMutated) {
      onDomainMutated();
    } else {
      await fetchHierarchy();
    }
  }, [fetchHierarchy, onDomainMutated]);

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

        await refreshAll();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [refreshAll, selectedDomain]
  );

  const handleDomainDelete = useCallback(async () => {
    const parentFqn =
      selectedDomain?.parent?.fullyQualifiedName ??
      parentMap[selectedFqnRef.current ?? ''];
    setSelectedDomain(null);
    setSelectedFqn(parentFqn ?? null);
    await refreshAll();
  }, [parentMap, refreshAll, selectedDomain]);

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
      onDomainMutated?.();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(selectedDomain),
        })
      );
    }
  }, [currentUserId, onDomainMutated, selectedDomain, t]);

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
      onDomainMutated?.();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(selectedDomain),
        })
      );
    }
  }, [currentUserId, onDomainMutated, selectedDomain, t]);

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

        updateExpansionForFqn(decodedFqn, parentMap);
        fetchDomainDetails(decodedFqn);
      } else {
        navigate(path);
      }
    },
    [fetchDomainDetails, navigate, parentMap, updateExpansionForFqn]
  );

  const renderTreeItems = useCallback(
    (nodes: Domain[]) =>
      nodes.map((node) => {
        const identifier = node.fullyQualifiedName || node.name || node.id;

        if (!identifier) {
          return null;
        }

        const childDomains = (node.children as unknown as Domain[]) ?? [];

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
                    color: 'text.primary',
                  }}>
                  {getEntityName(node)}
                </Typography>
                {childDomains.length > 0 && (
                  <Chip
                    label={childDomains.length}
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
              </Box>
            }>
            {childDomains.length > 0 && renderTreeItems(childDomains)}
          </TreeItem>
        );
      }),
    [childIndent, connectorOffset, outlineColor, theme.palette.allShades?.gray]
  );

  const renderDomainSection = () => {
    if (isDomainLoading) {
      return <Loader />;
    }

    if (selectedDomain) {
      return (
        <DomainDetails
          activeTab={activeTab}
          domain={selectedDomain}
          handleFollowingClick={handleFollowingToggle}
          isFollowing={isFollowing}
          isFollowingLoading={isFollowingLoading}
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
  };

  const renderHierarchySection = () => {
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
            gap: 3,
            p: 0,
            mb: 1.5,
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: '-20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '12px',
              height: '1px',
              background: theme.palette.allShades?.gray?.[200],
              zIndex: 0,
            },
          },

          '& .MuiTreeItem-label': { p: 1 },
          '& .MuiChip-root': { px: 3 },
          '& .MuiChip-label': { fontSize: '10px' },

          '& .MuiTreeItem-iconContainer:empty': { display: 'none' },

          [`& .${treeItemClasses.groupTransition}`]: {
            ml: 3,
            pl: 5,
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: '22px',
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
            '&:hover, &.Mui-selected': {
              backgroundColor: theme.palette.allShades?.blue?.[50],
            },
          },

          '& .MuiTreeItem-content:has(.MuiTreeItem-iconContainer:not(:empty))':
            {
              '&:hover, &.Mui-selected': {
                backgroundColor: 'transparent !important',
              },
              '&:hover .MuiTreeItem-label': {
                backgroundColor: '#0000000A',
                borderRadius: '8px',
              },
              '&.Mui-selected .MuiTreeItem-label': {
                backgroundColor: theme.palette.allShades?.blue?.[50],
                borderRadius: '8px',
              },
            },
          'ul.MuiSimpleTreeView-itemGroupTransition:not(:has(.MuiTreeItem-iconContainer > svg))':
            {
              pl: '36px !important',
            },
          'ul.MuiSimpleTreeView-itemGroupTransition:not(:has(.MuiTreeItem-iconContainer > svg)) li .MuiTreeItem-content::before':
            {
              left: '-35px',
              width: '28px',
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
            },
        }}
        onExpandedItemsChange={handleExpandedChange}
        onSelectedItemsChange={(_, value) => handleSelectionChange(value)}>
        {renderTreeItems(hierarchy)}
      </SimpleTreeView>
    );
  };
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
    <Box
      sx={{
        display: 'flex',
        gap: 3,
        minHeight: 480,
      }}>
      <Box
        sx={{
          width: TREE_CONTAINER_MIN_WIDTH,
          borderRight: `1px solid ${theme.palette.allShades?.gray?.[200]}`,
          pr: 3,
          pt: 3,
          mr: 1,
          overflowY: 'auto',
        }}>
        {renderHierarchySection()}
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: 'calc(80vh - 160px)',
          pt: 3,
        }}>
        {renderDomainSection()}
      </Box>
    </Box>
  );
};

export default DomainTreeView;

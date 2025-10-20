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

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Chip, Typography, useTheme } from '@mui/material';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
} from '../../../rest/domainAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { EntityAvatar } from '../../common/EntityAvatar/EntityAvatar';
import Loader from '../../common/Loader/Loader';
import DomainDetails from '../../Domain/DomainDetails/DomainDetails.component';

interface DomainTreeViewProps {
  onDomainMutated?: () => void;
  refreshToken?: number;
}

type DomainHierarchyMap = Record<string, Domain>;
type DomainParentMap = Record<string, string | undefined>;

const TREE_CONTAINER_MIN_WIDTH = 320;

const DomainTreeView = ({
  onDomainMutated,
  refreshToken = 0,
}: DomainTreeViewProps) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

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
      nodes.forEach((node) => {
        const identifier = node.fullyQualifiedName || node.name || node.id;

        if (!identifier) {
          return;
        }

        map[identifier] = node;

        if (parentFqn) {
          parents[identifier] = parentFqn;
        }

        const childDomains = (node.children as unknown as Domain[]) ?? [];

        if (childDomains.length) {
          traverse(childDomains, identifier);
        }
      });
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
      const { map, parents } = buildHierarchyMaps(domains);
      setParentMap(parents);

      const existingSelection = selectedFqnRef.current;

      if (existingSelection && map[existingSelection]) {
        updateExpansionForFqn(existingSelection, parents);
      } else if (!existingSelection && domains[0]) {
        const initialFqn =
          domains[0].fullyQualifiedName || domains[0].name || domains[0].id;
        if (initialFqn) {
          setSelectedFqn(initialFqn);
          updateExpansionForFqn(initialFqn, parents);
        }
      }
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
    fetchHierarchy();
  }, [fetchHierarchy, refreshToken]);

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
    (value: string | string[]) => {
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

      const jsonPatch = compare(selectedDomain, updatedData) as Operation[];
      try {
        const response = await patchDomains(selectedDomain.id, jsonPatch);
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

  const handleDomainDelete = useCallback(
    async (_id: string) => {
      const parentFqn =
        selectedDomain?.parent?.fullyQualifiedName ??
        parentMap[selectedFqnRef.current ?? ''];
      setSelectedDomain(null);
      setSelectedFqn(parentFqn ?? null);
      await refreshAll();
    },
    [parentMap, refreshAll, selectedDomain]
  );

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
      const match = path.match(/^\/domain\/([^/]+)(?:\/([^/]+))?/);
      if (match) {
        const decodedFqn = getDecodedFqn(match[1]);
        setSelectedFqn(decodedFqn);

        const requestedTab = match[2] as EntityTabs | undefined;
        if (
          requestedTab &&
          Object.values(EntityTabs).includes(requestedTab as EntityTabs)
        ) {
          setActiveTab(requestedTab as EntityTabs);
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
                  gap: 1.5,
                  py: 0.5,
                }}>
                <EntityAvatar entity={node} size={28} />
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'text.primary',
                  }}>
                  {getEntityName(node)}
                </Typography>
                {childDomains.length > 0 && (
                  <Chip
                    label={childDomains.length}
                    size="small"
                    sx={{
                      fontSize: '0.75rem',
                      height: 20,
                      backgroundColor: theme.palette.allShades?.gray?.[100],
                      color: theme.palette.allShades?.gray?.[700],
                    }}
                  />
                )}
              </Box>
            }>
            {childDomains.length > 0 && renderTreeItems(childDomains)}
          </TreeItem>
        );
      }),
    [theme.palette.allShades?.gray]
  );

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
        {isHierarchyLoading ? (
          <Loader />
        ) : hierarchy.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', mt: 2 }} variant="body2">
            {t('message.no-entity-available', {
              entity: t('label.domain-plural'),
            })}
          </Typography>
        ) : (
          <SimpleTreeView
            expandedItems={expandedItems}
            selectedItems={selectedFqn}
            slots={{
              expandIcon: ChevronRightIcon,
              collapseIcon: ExpandMoreIcon,
            }}
            sx={{
              '& .MuiTreeItem-content': {
                borderRadius: 0.5,
              },
            }}
            onExpandedItemsChange={handleExpandedChange}
            onSelectedItemsChange={(_, value) => handleSelectionChange(value)}>
            {renderTreeItems(hierarchy)}
          </SimpleTreeView>
        )}
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: 'calc(80vh - 160px)',
        }}>
        {isDomainLoading ? (
          <Loader />
        ) : selectedDomain ? (
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
        ) : (
          <Typography sx={{ color: 'text.secondary', mt: 2 }} variant="body2">
            {t('message.no-entity-selected', {
              entity: t('label.domain'),
            })}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default DomainTreeView;

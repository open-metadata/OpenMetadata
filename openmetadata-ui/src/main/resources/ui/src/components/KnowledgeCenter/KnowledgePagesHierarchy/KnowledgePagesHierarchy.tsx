/*
 *  Copyright 2026 Collate.
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
import type { TreeItemMoveEvent } from '@openmetadata/ui-core-components';
import {
  Box,
  Button,
  ButtonUtility,
  Card,
  Dialog,
  EmptyPlaceholder,
  Modal,
  ModalOverlay,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { Articles } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { Trash01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, uniq } from 'lodash';
import {
  forwardRef,
  ReactNode,
  UIEventHandler,
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as CollapseAllIcon } from '../../../assets/svg/collapse-new.svg';
import { ReactComponent as FileIcon } from '../../../assets/svg/common/file.svg';
import { ReactComponent as ExpandAllIcon } from '../../../assets/svg/expand-new.svg';
import { ReactComponent as QuickLinkIcon } from '../../../assets/svg/quick-link.svg';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import Loader from '../../../components/common/Loader/Loader';
import { CREATE_PAGE_HASH } from '../../../constants/constants';
import {
  KNOWLEDGE_CENTER_PAGINATION_LIMIT,
  KNOWLEDGE_CENTER_PAGINATION_OFFSET_INCREMENT,
} from '../../../constants/KnowledgeCenter.constant';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { useArticleDraftStore } from '../../../hooks/useArticleDraftStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import {
  KnowledgePage,
  KnowledgePagesHierarchyRef,
  MovedEntity,
  PageHierarchy,
  PageType,
  RecentlyViewedQuickLinks,
} from '../../../interface/knowledge-center.interface';
import { queryClient } from '../../../queryClient';
import {
  deleteKnowledgePage,
  getListKnowledgePages,
  getPageHierarchyFromES,
  patchKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { CONTEXT_CENTER_ARTICLES_COUNT_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';
import { getEntityName } from '../../../utils/EntityNameUtils';
import Fqn from '../../../utils/Fqn';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import {
  extractKnowledgePageParentFQN,
  findPageAndParentInTreeData,
  findPageInTreeData,
  getExpandedNodeKeys,
  getKnowledgePageName,
  getPageAllChildren,
  getUpdatePageHierarchy,
  getUpdatePageHierarchyForDelete,
  hierarchyPaginationInitialState,
  hierarchyPaginationReducer,
  integrateNodesIntoHierarchy,
  remapSubtreeFqn,
  updateTreeData,
} from '../../../utils/KnowledgePagePureUtils';
import { updateKnowledgeCenterRecentViewed } from '../../../utils/KnowledgePageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';

interface KnowledgePagesHierarchyProps {
  permissions: OperationPermission;
  activeKey?: string;
  activePage?: KnowledgePage;
  homeRoute?: string;
  onPageDelete?: (id: string | string[]) => void;
  onQuickLinkClick?: (fqn: string) => void;
}
const SCROLL_BOTTOM_THRESHOLD = 1;

// Deduped via React Query — multiple mount/create-hash/delete/forceRefresh
// triggers all collapse into a single in-flight request instead of firing
// one GET /contextCenter/pages?limit=0 per trigger.
const KNOWLEDGE_PAGES_TOTAL_COUNT_QUERY_KEY = ['knowledge-pages-total-count'];

const KnowledgePagesHierarchy = forwardRef<
  KnowledgePagesHierarchyRef,
  KnowledgePagesHierarchyProps
>(
  (
    {
      activeKey,
      activePage,
      homeRoute,
      onPageDelete,
      onQuickLinkClick,
      permissions,
    },
    ref
  ) => {
    const { fqn } = useRequiredParams<{ fqn: string }>();
    const navigate = useNavigate();
    const { hash } = useCustomLocation();
    const { t } = useTranslation();
    const [knowledgePageHierarchy, setKnowledgePageHierarchy] = useState<
      PageHierarchy[]
    >([]);
    const { getResourceLimit } = useLimitStore();

    const [isHierarchyInitialized, setIsHierarchyInitialized] =
      useState<boolean>(false);
    const lastFetchedFqnRef = useRef<string | null>(null);
    const consumedCreateHashFqnRef = useRef<string | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [isUserExpandedAll, setIsUserExpandedAll] = useState(false);
    const [deletePage, setDeletePage] = useState<PageHierarchy>();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExpandingAll, setIsExpandingAll] = useState(false);
    const { data: knowledgePagesTotalCount = 0 } = useQuery({
      queryKey: KNOWLEDGE_PAGES_TOTAL_COUNT_QUERY_KEY,
      queryFn: async () => {
        try {
          const res = await getListKnowledgePages({ limit: 0 });

          return res.paging.total;
        } catch (error) {
          showErrorToast(error as AxiosError);

          throw error;
        }
      },
    });

    const [movedPage, setMovedPage] = useState<MovedEntity>();
    const [isMovingPage, setIsMovingPage] = useState<boolean>(false);
    const {
      preferences: { recentlyViewedQuickLinks: recentlyViewed },
    } = useCurrentUserPreferences();
    const { removeDraft } = useArticleDraftStore();

    const [paginationState, setPaginationState] = useReducer(
      hierarchyPaginationReducer,
      hierarchyPaginationInitialState
    );

    const nodesLoadingChildrenRef = useRef<Set<string>>(new Set());
    const nodesWithNoMoreChildrenRef = useRef<Set<string>>(new Set());
    const nodeChildrenOffsetRef = useRef<Map<string, number>>(new Map());

    const handleExpandAll = useCallback(async () => {
      setIsExpandingAll(true);
      try {
        let traversalHierarchy = knowledgePageHierarchy;
        let nodesPendingChildren: PageHierarchy[] = [];
        const fetchedChildrenByParentFqn = new Map<string, PageHierarchy[]>();

        const collectUnloadedExpandableNodes = (
          nodes: PageHierarchy[]
        ): PageHierarchy[] => {
          const unloaded: PageHierarchy[] = [];
          nodes.forEach((n) => {
            const isExhausted = nodesWithNoMoreChildrenRef.current.has(
              n.fullyQualifiedName
            );
            if (n.childrenCount > (n.children?.length ?? 0) && !isExhausted) {
              unloaded.push(n);
            } else if (n.children) {
              unloaded.push(...collectUnloadedExpandableNodes(n.children));
            }
          });

          return unloaded;
        };

        nodesPendingChildren =
          collectUnloadedExpandableNodes(traversalHierarchy);

        while (nodesPendingChildren.length > 0) {
          const childrenResults = await Promise.all(
            nodesPendingChildren.map((node) => {
              const offset =
                nodeChildrenOffsetRef.current.get(node.fullyQualifiedName) ??
                node.children?.length ??
                0;

              return getPageHierarchyFromES(
                node.fullyQualifiedName,
                undefined,
                offset,
                KNOWLEDGE_CENTER_PAGINATION_LIMIT
              );
            })
          );

          nodesPendingChildren.forEach((node, index) => {
            const fetchedChildren = childrenResults[index].data;
            const offset =
              nodeChildrenOffsetRef.current.get(node.fullyQualifiedName) ??
              node.children?.length ??
              0;

            nodeChildrenOffsetRef.current.set(
              node.fullyQualifiedName,
              offset + fetchedChildren.length
            );

            if (fetchedChildren.length < KNOWLEDGE_CENTER_PAGINATION_LIMIT) {
              nodesWithNoMoreChildrenRef.current.add(node.fullyQualifiedName);
            }

            fetchedChildrenByParentFqn.set(node.fullyQualifiedName, [
              ...(fetchedChildrenByParentFqn.get(node.fullyQualifiedName) ??
                []),
              ...fetchedChildren,
            ]);
            traversalHierarchy = updateTreeData(
              traversalHierarchy,
              fetchedChildren,
              node.fullyQualifiedName
            );
          });

          nodesPendingChildren =
            collectUnloadedExpandableNodes(traversalHierarchy);
        }

        setKnowledgePageHierarchy((prev) => {
          let merged = prev;
          fetchedChildrenByParentFqn.forEach((children, parentFqn) => {
            merged = updateTreeData(merged, children, parentFqn);
          });

          return merged;
        });

        const ids: string[] = [];
        const collect = (nodes: PageHierarchy[]) => {
          nodes.forEach((n) => {
            if (n.childrenCount > 0 || !isEmpty(n.children)) {
              ids.push(n.fullyQualifiedName);
              if (n.children) {
                collect(n.children);
              }
            }
          });
        };
        collect(traversalHierarchy);

        setExpandedKeys((prev) => uniq([...prev, ...ids]));
        setIsUserExpandedAll(true);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsExpandingAll(false);
      }
    }, [knowledgePageHierarchy]);

    const fetchKnowledgePageHierarchy = async (
      setLoading = true,
      isPaginationLoading = false,
      offset = 0,
      limit = KNOWLEDGE_CENTER_PAGINATION_LIMIT,
      forceRefresh = false
    ) => {
      const isCreateHash =
        hash?.slice(1) === CREATE_PAGE_HASH &&
        !isPaginationLoading &&
        consumedCreateHashFqnRef.current !== fqn;

      const hasCachedHierarchyForFqn =
        isHierarchyInitialized &&
        knowledgePageHierarchy.length > 0 &&
        lastFetchedFqnRef.current === fqn;

      if (
        !forceRefresh &&
        !isPaginationLoading &&
        hasCachedHierarchyForFqn &&
        !isCreateHash
      ) {
        return;
      }

      if (setLoading && !isCreateHash) {
        setIsLoading(true);
      }

      if (isPaginationLoading) {
        setPaginationState({ type: 'SET_PAGINATION_LOADING', value: true });
      }
      try {
        const { data, paging } = await getPageHierarchyFromES(
          undefined,
          undefined,
          offset,
          limit,
          fqn
        );

        lastFetchedFqnRef.current = fqn;

        setPaginationState({ type: 'SET_PAGING_VALUE', value: paging });

        if (
          data.length === 0 ||
          knowledgePageHierarchy.length === paging.total
        ) {
          setPaginationState({ type: 'SET_IS_PAGINATION_END', value: true });
        }

        if (isCreateHash || forceRefresh) {
          setKnowledgePageHierarchy(data);
          if (forceRefresh) {
            setExpandedKeys([]);
            setIsUserExpandedAll(false);
            nodesWithNoMoreChildrenRef.current.clear();
            nodesLoadingChildrenRef.current.clear();
            nodeChildrenOffsetRef.current.clear();
          }
          if (isCreateHash) {
            consumedCreateHashFqnRef.current = fqn;
          }
        } else {
          const fqnParts = fqn ? Fqn.split(fqn) : [];
          const isNestedNode = fqnParts.length > 1;

          if (isNestedNode && data.length > 0) {
            const parentFQN = extractKnowledgePageParentFQN(fqn);
            setKnowledgePageHierarchy((prev) =>
              integrateNodesIntoHierarchy(prev, data)
            );
            setExpandedKeys((prev) => uniq([...prev, ...parentFQN]));
          } else {
            setKnowledgePageHierarchy((prev) => {
              const merged = prev.concat(data);

              return Array.from(
                new Map(merged.map((item) => [item.id, item])).values()
              );
            });
          }
        }
        setIsHierarchyInitialized(true);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
        setPaginationState({ type: 'SET_PAGINATION_LOADING', value: false });
      }
    };

    const fetchKnowledgePageHierarchyRef = useRef(fetchKnowledgePageHierarchy);
    fetchKnowledgePageHierarchyRef.current = fetchKnowledgePageHierarchy;

    const loadNodeChildren = useCallback(
      async (nodeKey: string) => {
        const node = findPageInTreeData(knowledgePageHierarchy, nodeKey);
        const loadedCount = node?.children?.length ?? 0;
        if (!node || node.childrenCount <= loadedCount) {
          return;
        }
        if (
          nodesLoadingChildrenRef.current.has(nodeKey) ||
          nodesWithNoMoreChildrenRef.current.has(nodeKey)
        ) {
          return;
        }
        nodesLoadingChildrenRef.current.add(nodeKey);
        try {
          const fetchOffset =
            nodeChildrenOffsetRef.current.get(nodeKey) ?? loadedCount;
          const { data: children } = await getPageHierarchyFromES(
            nodeKey,
            undefined,
            fetchOffset,
            KNOWLEDGE_CENTER_PAGINATION_LIMIT
          );
          nodeChildrenOffsetRef.current.set(
            nodeKey,
            fetchOffset + children.length
          );
          if (children.length < KNOWLEDGE_CENTER_PAGINATION_LIMIT) {
            nodesWithNoMoreChildrenRef.current.add(nodeKey);
          }
          if (children.length === 0) {
            return;
          }
          setKnowledgePageHierarchy(
            updateTreeData(knowledgePageHierarchy, children, nodeKey)
          );
        } catch {
          // do nothing
        } finally {
          nodesLoadingChildrenRef.current.delete(nodeKey);
        }
      },
      [knowledgePageHierarchy]
    );

    const handleDeletePage = useCallback(
      (pageKey: string) => {
        const page = findPageInTreeData(knowledgePageHierarchy, pageKey);
        if (page) {
          setDeletePage(page);
        }
      },
      [knowledgePageHierarchy]
    );

    const handleAfterDeletePage = useCallback(
      async (deletedPageData: PageHierarchy) => {
        const deletedPageHierarchy = findPageInTreeData(
          knowledgePageHierarchy,
          deletedPageData?.fullyQualifiedName ?? ''
        );

        const isActivePageParent = findPageInTreeData(
          [...(deletedPageHierarchy?.children ?? [])],
          activePage?.fullyQualifiedName ?? ''
        );

        const deletedPages = [
          deletedPageData.id,
          ...getPageAllChildren(deletedPageHierarchy?.children ?? []).map(
            (c) => c.id
          ),
        ];

        onPageDelete?.(deletedPages);

        await getResourceLimit('knowledgeCenter', true, true);
        queryClient.invalidateQueries({
          queryKey: KNOWLEDGE_PAGES_TOTAL_COUNT_QUERY_KEY,
        });

        updateKnowledgeCenterRecentViewed(
          recentlyViewed.filter(
            (page) => !deletedPages.includes(page.id)
          ) as unknown as RecentlyViewedQuickLinks['data']
        );

        setKnowledgePageHierarchy((prev) =>
          getUpdatePageHierarchyForDelete(
            deletedPageData.fullyQualifiedName,
            prev
          )
        );

        if (
          activeKey === deletedPageData.fullyQualifiedName ||
          isActivePageParent
        ) {
          navigate(homeRoute ?? contextCenterClassBase.getArticlesListPath());
        }
      },
      [knowledgePageHierarchy, onPageDelete, activeKey, activePage]
    );

    const handleMovePage = async (movedPageData: MovedEntity) => {
      try {
        setIsMovingPage(true);
        const { sourceNode, sourceNodeParent, targetNode } = movedPageData;
        const newExpandedKeys: string[] = [];

        const oldSourceFQN = sourceNode.fullyQualifiedName;
        const newSourceFQN = targetNode
          ? Fqn.build(targetNode.fullyQualifiedName, sourceNode.name)
          : Fqn.build(sourceNode.name);

        const updatedSourceNodeForPatch = {
          ...sourceNode,
          parent: targetNode
            ? {
                id: targetNode.id,
                type: 'page',
                fullyQualifiedName: targetNode.fullyQualifiedName,
                name: targetNode.name,
                displayName: targetNode.displayName,
              }
            : undefined,
        };

        await patchKnowledgePage(
          sourceNode.id,
          compare(sourceNode, updatedSourceNodeForPatch)
        );

        setExpandedKeys((prev) =>
          prev.map((key) =>
            key === oldSourceFQN || key.startsWith(`${oldSourceFQN}.`)
              ? newSourceFQN + key.slice(oldSourceFQN.length)
              : key
          )
        );

        if (isUndefined(targetNode)) {
          fetchKnowledgePageHierarchy(
            true,
            false,
            0,
            KNOWLEDGE_CENTER_PAGINATION_LIMIT,
            true
          );
        } else {
          const targetNodeChildren = await getPageHierarchyFromES(
            targetNode.fullyQualifiedName
          );

          nodesWithNoMoreChildrenRef.current.delete(
            targetNode.fullyQualifiedName
          );
          nodesLoadingChildrenRef.current.delete(targetNode.fullyQualifiedName);
          nodeChildrenOffsetRef.current.delete(targetNode.fullyQualifiedName);

          const targetChildrenWithMovedSubtree = targetNodeChildren.data.map(
            (child) =>
              child.fullyQualifiedName === newSourceFQN &&
              isEmpty(child.children) &&
              !isEmpty(sourceNode.children)
                ? {
                    ...child,
                    children: remapSubtreeFqn(
                      sourceNode.children ?? [],
                      oldSourceFQN,
                      newSourceFQN
                    ),
                  }
                : child
          );

          setKnowledgePageHierarchy((prev) =>
            getUpdatePageHierarchy(
              prev,
              { ...targetNode, children: targetChildrenWithMovedSubtree },
              true
            )
          );

          newExpandedKeys.push(targetNode.fullyQualifiedName);

          if (sourceNodeParent) {
            const sourceNodeParentChildren = await getPageHierarchyFromES(
              sourceNodeParent.fullyQualifiedName
            );

            nodesWithNoMoreChildrenRef.current.delete(
              sourceNodeParent.fullyQualifiedName
            );
            nodesLoadingChildrenRef.current.delete(
              sourceNodeParent.fullyQualifiedName
            );
            nodeChildrenOffsetRef.current.delete(
              sourceNodeParent.fullyQualifiedName
            );

            setKnowledgePageHierarchy((prev) =>
              getUpdatePageHierarchy(
                prev,
                {
                  ...sourceNodeParent,
                  children: sourceNodeParentChildren.data,
                },
                true
              )
            );

            newExpandedKeys.push(sourceNodeParent.fullyQualifiedName);
          } else {
            setKnowledgePageHierarchy((prev) =>
              prev.filter((page) => page.id !== sourceNode.id)
            );
          }

          setExpandedKeys((prev) => uniq([...prev, ...newExpandedKeys]));
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setMovedPage(undefined);
        setIsMovingPage(false);
      }
    };

    const handleItemMove = useCallback(
      ({ sourceKey, targetKey, dropPosition }: TreeItemMoveEvent) => {
        if (!permissions.EditAll) {
          return;
        }

        if (sourceKey === targetKey) {
          return;
        }

        const isDropOnNode = dropPosition === 'on';
        const targetNode = isDropOnNode
          ? findPageInTreeData(knowledgePageHierarchy, targetKey as string)
          : undefined;

        if (isDropOnNode && !targetNode) {
          return;
        }

        const { page: sourceNode, parent: sourceNodeParent } =
          findPageAndParentInTreeData(
            knowledgePageHierarchy,
            sourceKey as string
          );

        if (!sourceNode) {
          return;
        }

        const isAlreadyChild =
          targetNode &&
          (targetNode.children ?? []).some((c) => c.id === sourceNode.id);

        if (isAlreadyChild) {
          return;
        }

        setMovedPage({ sourceNode, sourceNodeParent, targetNode });
      },
      [knowledgePageHierarchy, permissions.EditAll]
    );

    const handleScroll: UIEventHandler<HTMLElement> = useCallback(
      (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isNearBottom =
          scrollTop + clientHeight >= scrollHeight - SCROLL_BOTTOM_THRESHOLD;

        if (
          isNearBottom &&
          !paginationState.isPaginationEnd &&
          !paginationState.paginationLoading
        ) {
          fetchKnowledgePageHierarchyRef.current(
            false,
            true,
            paginationState.paging.offset +
              KNOWLEDGE_CENTER_PAGINATION_OFFSET_INCREMENT
          );
        }
      },
      [paginationState]
    );

    const renderNode = useCallback(
      (node: PageHierarchy): ReactNode => {
        const isActive = activeKey === node.fullyQualifiedName;
        const displayName = getKnowledgePageName(node);
        const isQuickLink = node.pageType === PageType.QUICK_LINK;

        const hasChildren = node.childrenCount > 0 || !isEmpty(node.children);

        const nodeContent = (
          <Box
            align="center"
            className="tw:min-w-0 tw:flex-1 tw:cursor-pointer"
            gap={2}>
            {isQuickLink ? (
              <QuickLinkIcon
                className="tw:shrink-0 tw:text-quaternary"
                data-testid="quick-link-icon"
                height={14}
                width={14}
              />
            ) : (
              <FileIcon
                className="tw:shrink-0 tw:text-quaternary"
                data-testid="page-icon"
                height={14}
                width={14}
              />
            )}
            <Typography
              ellipsis
              className="knowledge-hierarchy-page-title"
              size="text-sm"
              weight={isActive ? 'medium' : 'regular'}>
              {displayName}
            </Typography>
          </Box>
        );

        const deleteButton = permissions.Delete ? (
          <ButtonUtility
            className="tw:opacity-0 group-hover-opacity-100 tw:shrink-0 tw:p-0"
            color="tertiary"
            data-testid={`${displayName}-delete-page-btn`}
            icon={Trash01}
            size="xs"
            tooltip={t('label.delete')}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeletePage(node.fullyQualifiedName);
            }}
          />
        ) : null;

        return (
          <Tree.Item
            id={node.fullyQualifiedName}
            key={node.fullyQualifiedName}
            textValue={displayName}>
            <Tree.ItemContent showGuideLines hasChildItems={hasChildren}>
              {() =>
                isQuickLink && onQuickLinkClick ? (
                  <div className="custom-group tw:flex tw:items-center tw:justify-between tw:flex-1 tw:min-w-0">
                    <button
                      className="tw:gap-2 tw:cursor-pointer tw:border-none tw:bg-transparent tw:p-0 tw:text-left tw:truncate"
                      data-isactive={isActive}
                      data-testid={`page-node-${displayName}`}
                      onClick={() => onQuickLinkClick(node.fullyQualifiedName)}>
                      {nodeContent}
                    </button>
                    {deleteButton}
                  </div>
                ) : (
                  <Link
                    className="tw:flex tw:items-center tw:min-w-0 tw:flex-1 custom-group tw:justify-between tw:gap-2 tw:cursor-pointer tw:hover:no-underline"
                    data-isactive={isActive}
                    data-testid={`page-node-${displayName}`}
                    to={contextCenterClassBase.getArticlePath(
                      node.fullyQualifiedName
                    )}>
                    {nodeContent}
                    {deleteButton}
                  </Link>
                )
              }
            </Tree.ItemContent>
            {node.children?.map(renderNode)}
          </Tree.Item>
        );
      },
      [activeKey, onQuickLinkClick, permissions.Delete, handleDeletePage, t]
    );

    useImperativeHandle(ref, () => ({
      fetchKnowledgePageHierarchy: async (forceRefresh = false) => {
        await fetchKnowledgePageHierarchy(
          true,
          false,
          0,
          KNOWLEDGE_CENTER_PAGINATION_LIMIT,
          forceRefresh
        );
        if (forceRefresh) {
          queryClient.invalidateQueries({
            queryKey: KNOWLEDGE_PAGES_TOTAL_COUNT_QUERY_KEY,
          });
        }
      },
    }));

    useEffect(() => {
      const isCreateHash = hash?.slice(1) === CREATE_PAGE_HASH;

      if (!isHierarchyInitialized || isCreateHash) {
        fetchKnowledgePageHierarchy();
      } else if (fqn !== lastFetchedFqnRef.current) {
        lastFetchedFqnRef.current = fqn;
      }
    }, [hash, fqn]);

    const autoExpandedForKeyRef = useRef<string | undefined>(undefined);

    useEffect(() => {
      if (activeKey && autoExpandedForKeyRef.current !== activeKey) {
        autoExpandedForKeyRef.current = activeKey;
        setExpandedKeys((prev) =>
          uniq([
            ...prev,
            ...getExpandedNodeKeys(knowledgePageHierarchy, activeKey),
          ])
        );
      }
    }, [activeKey, knowledgePageHierarchy]);

    useEffect(() => {
      if (activePage) {
        setKnowledgePageHierarchy((prev) =>
          getUpdatePageHierarchy(prev, activePage)
        );
      }
    }, [activePage]);

    useEffect(() => {
      expandedKeys.forEach((key) => {
        const node = findPageInTreeData(knowledgePageHierarchy, key);
        if (node && node.childrenCount > (node.children?.length ?? 0)) {
          loadNodeChildren(key);
        }
      });
    }, [expandedKeys, knowledgePageHierarchy, loadNodeChildren]);

    const isHierarchyEmpty = !isLoading && knowledgePageHierarchy.length === 0;

    return (
      <Card
        aria-label={t('label.article-plural')}
        className="tw:h-full tw:flex tw:flex-col tw:py-5 tw:px-0"
        data-testid="knowledge-pages-hierarchy-container"
        role="region"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (!permissions.EditAll) {
            return;
          }
          const sourceKey = e.dataTransfer.getData('text/plain');
          if (!sourceKey) {
            return;
          }
          const { page: sourceNode, parent: sourceNodeParent } =
            findPageAndParentInTreeData(knowledgePageHierarchy, sourceKey);
          if (sourceNode && sourceNodeParent) {
            setMovedPage({
              sourceNode,
              sourceNodeParent,
              targetNode: undefined,
            });
          }
        }}>
        <Card.Content className="tw:p-0 tw:flex tw:flex-col tw:flex-1 tw:min-h-0 tw:h-full">
          <Box
            align="center"
            className="tw:pb-5 tw:shrink-0 tw:px-5"
            justify="between">
            <Box align="center" gap={3}>
              <div className="tw:p-3 tw:rounded-lg tw:bg-utility-gray-blue-50 tw:leading-0">
                <FileIcon
                  className="tw:text-quaternary"
                  height={20}
                  width={20}
                />
              </div>
              <div>
                <Typography size="text-md" weight="medium">
                  {t('label.article-plural')}
                </Typography>
                <Typography
                  className="tw:text-quaternary tw:flex tw:items-center tw:gap-2"
                  size="text-xs">
                  {knowledgePagesTotalCount} {t('label.article-plural')}
                </Typography>
              </div>
            </Box>
            {isUserExpandedAll ? (
              <ButtonUtility
                color="tertiary"
                icon={<CollapseAllIcon className="tw:size-6" />}
                size="sm"
                tooltip={t('label.collapse-all')}
                onClick={() => {
                  setExpandedKeys([]);
                  setIsUserExpandedAll(false);
                }}
              />
            ) : (
              <ButtonUtility
                color="tertiary"
                icon={<ExpandAllIcon className="tw:size-6" />}
                isDisabled={isExpandingAll}
                size="sm"
                tooltip={t('label.expand-all')}
                onClick={handleExpandAll}
              />
            )}
          </Box>

          <div
            className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:px-5"
            data-testid="article-list-container"
            onScroll={handleScroll}>
            {isLoading && (
              <div className="tw:px-1.5">
                {Array.from({ length: 8 }, (_, i) => (
                  <div
                    className="tw:h-5 tw:mb-2 tw:rounded tw:bg-tertiary tw:animate-pulse"
                    key={`skeleton-${i}`}
                    style={{ width: `${60 + (i % 3) * 15}%` }}
                  />
                ))}
              </div>
            )}

            {isHierarchyEmpty && (
              <div className="tw:relative tw:flex-1 tw:h-full tw:border-0 tw:px-4">
                <EmptyPlaceholder
                  description={t('message.no-articles-listed')}
                  icon={<Articles className="tw:text-secondary" />}
                  title={t('label.no-entity', {
                    entity: t('label.article-plural'),
                  })}
                  width={200}
                />
              </div>
            )}

            {!isLoading && !isHierarchyEmpty && (
              <Tree
                aria-label={t('label.article-plural')}
                className="knowledge-pages-tree"
                data-testid="knowledge-pages-hierarchy"
                expandedKeys={new Set(expandedKeys)}
                selectedKeys={
                  activeKey ? new Set([activeKey]) : new Set<string>()
                }
                selectionMode="single"
                onExpandedChange={(keys: Selection) => {
                  if (keys !== 'all') {
                    setExpandedKeys(Array.from(keys).map(String));
                  }
                }}
                onItemMove={handleItemMove}
                onItemRootDrop={(sourceKey) => {
                  if (!permissions.EditAll) {
                    return;
                  }
                  const { page: sourceNode, parent: sourceNodeParent } =
                    findPageAndParentInTreeData(
                      knowledgePageHierarchy,
                      sourceKey as string
                    );
                  if (sourceNode && sourceNodeParent) {
                    setMovedPage({
                      sourceNode,
                      sourceNodeParent,
                      targetNode: undefined,
                    });
                  }
                }}>
                {knowledgePageHierarchy.map(renderNode)}
              </Tree>
            )}

            {paginationState.paginationLoading && <Loader size="x-small" />}
          </div>

          <DeleteModal
            entityTitle={getKnowledgePageName(deletePage, t)}
            isDeleting={isDeleting}
            message={t('message.delete-entity-permanently', {
              entityType:
                deletePage?.pageType === PageType.QUICK_LINK
                  ? t('label.quick-link-lowercase')
                  : t('label.article-lowercase'),
            })}
            open={!isUndefined(deletePage)}
            onCancel={() => setDeletePage(undefined)}
            onDelete={async () => {
              if (!deletePage?.id) {
                return;
              }
              setIsDeleting(true);
              try {
                if (deletePage.pageType === PageType.QUICK_LINK) {
                  await deleteKnowledgePage(deletePage.id, false, true);
                } else {
                  await deleteKnowledgePage(deletePage.id);
                }
                queryClient.invalidateQueries({
                  queryKey: CONTEXT_CENTER_ARTICLES_COUNT_QUERY_KEY,
                });
                removeDraft(deletePage.id);
                await handleAfterDeletePage(deletePage);
                setDeletePage(undefined);
              } catch (error) {
                showErrorToast(error as AxiosError);
              } finally {
                setIsDeleting(false);
              }
            }}
          />

          <ModalOverlay
            isOpen={Boolean(movedPage)}
            style={{ zIndex: 999 }}
            onOpenChange={(open) => {
              if (!open) {
                setMovedPage(undefined);
              }
            }}>
            <Modal>
              <Dialog
                showCloseButton
                data-testid="confirmation-modal"
                onClose={() => setMovedPage(undefined)}>
                <Dialog.Header
                  title={t('label.move-the-entity', {
                    entity: t('label.article'),
                  })}
                />
                <Dialog.Content className="tw:block">
                  {movedPage?.targetNode ? (
                    <Transi18next
                      i18nKey="message.entity-transfer-message"
                      renderElement={<strong />}
                      values={{
                        from: getEntityName(movedPage?.sourceNode),
                        to: getEntityName(movedPage.targetNode),
                        entity: t('label.page-lowercase'),
                      }}
                    />
                  ) : (
                    <Transi18next
                      i18nKey="message.move-page-to-top-level-message"
                      renderElement={<strong />}
                      values={{
                        entity: getEntityName(movedPage?.sourceNode),
                      }}
                    />
                  )}
                </Dialog.Content>
                <Dialog.Footer className="quick-link-modal-footer">
                  <Button
                    color="secondary"
                    isDisabled={isMovingPage}
                    size="sm"
                    onPress={() => setMovedPage(undefined)}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    isLoading={isMovingPage}
                    size="sm"
                    onPress={() => movedPage && handleMovePage(movedPage)}>
                    {t('label.confirm')}
                  </Button>
                </Dialog.Footer>
              </Dialog>
            </Modal>
          </ModalOverlay>
        </Card.Content>
      </Card>
    );
  }
);

export default KnowledgePagesHierarchy;

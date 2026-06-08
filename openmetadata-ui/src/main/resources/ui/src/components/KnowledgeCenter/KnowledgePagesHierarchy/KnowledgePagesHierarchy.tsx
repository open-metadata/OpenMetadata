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
  Dialog,
  Dot,
  Modal,
  ModalOverlay,
  Tabs,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { File06, Trash01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, uniq } from 'lodash';
import {
  forwardRef,
  ReactNode,
  UIEventHandler,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ARTICLE_FILTER_TABS } from 'src/constants/ContextCenter.constants';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import CreateErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/CreateErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { CREATE_PAGE_HASH } from '../../../constants/constants';
import {
  KNOWLEDGE_CENTER_PAGINATION_LIMIT,
  KNOWLEDGE_CENTER_PAGINATION_OFFSET_INCREMENT,
  KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET,
  KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET_CHILD_ARTICLE,
} from '../../../constants/KnowledgeCenter.constant';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { SIZE } from '../../../enums/common.enum';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import {
  KnowledgePage,
  KnowledgePagesHierarchyRef,
  MovedEntity,
  PageHierarchy,
  RecentlyViewedQuickLinks,
} from '../../../interface/knowledge-center.interface';
import {
  deleteKnowledgePage,
  getPageHierarchyFromES,
  patchKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
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
  updateKnowledgeCenterRecentViewed,
  updateTreeData,
} from '../../../utils/KnowledgePageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';

type ArticleFilterTab = 'all' | 'published' | 'draft' | 'sensitive';

interface KnowledgePagesHierarchyProps {
  permissions: OperationPermission;
  isPageHeaderAvailable: boolean;
  activeKey?: string;
  activePage?: KnowledgePage;
  homeRoute?: string;
  onPageDelete?: (id: string | string[]) => void;
}

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
      permissions,
      isPageHeaderAvailable,
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

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [activeFilter, setActiveFilter] = useState<ArticleFilterTab>('all');
    const [deletePage, setDeletePage] = useState<PageHierarchy>();
    const [isDeleting, setIsDeleting] = useState(false);

    const [movedPage, setMovedPage] = useState<MovedEntity>();
    const [isMovingPage, setIsMovingPage] = useState<boolean>(false);
    const {
      preferences: { recentlyViewedQuickLinks: recentlyViewed },
    } = useCurrentUserPreferences();

    const [paginationState, setPaginationState] = useReducer(
      hierarchyPaginationReducer,
      hierarchyPaginationInitialState
    );

    const TREE_HEIGHT = useMemo(
      () =>
        window.innerHeight -
        (isPageHeaderAvailable
          ? KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET_CHILD_ARTICLE
          : KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET),
      [isPageHeaderAvailable]
    );

    const allExpandableIds = useMemo(() => {
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
      collect(knowledgePageHierarchy);

      return ids;
    }, [knowledgePageHierarchy]);

    const fetchKnowledgePageHierarchy = async (
      setLoading = true,
      isPaginationLoading = false,
      offset = 0,
      limit = KNOWLEDGE_CENTER_PAGINATION_LIMIT,
      forceRefresh = false
    ) => {
      const isCreateHash = hash?.slice(1) === CREATE_PAGE_HASH;

      if (
        !forceRefresh &&
        !isPaginationLoading &&
        isHierarchyInitialized &&
        knowledgePageHierarchy.length > 0 &&
        lastFetchedFqnRef.current === fqn &&
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

    const loadNodeChildren = useCallback(
      async (nodeKey: string) => {
        const node = findPageInTreeData(knowledgePageHierarchy, nodeKey);
        if (!node || node.children) {
          return;
        }
        try {
          const { data: children } = await getPageHierarchyFromES(nodeKey);
          setKnowledgePageHierarchy(
            updateTreeData(knowledgePageHierarchy, children, nodeKey)
          );
        } catch {
          // do nothing
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

        if (isUndefined(targetNode)) {
          fetchKnowledgePageHierarchy(
            true,
            false,
            0,
            KNOWLEDGE_CENTER_PAGINATION_LIMIT,
            true
          );
          setExpandedKeys([]);
        } else {
          const targetNodeChildren = await getPageHierarchyFromES(
            targetNode.fullyQualifiedName
          );

          setKnowledgePageHierarchy((prev) =>
            getUpdatePageHierarchy(
              prev,
              { ...targetNode, children: targetNodeChildren.data },
              true
            )
          );

          newExpandedKeys.push(targetNode.fullyQualifiedName);

          if (sourceNodeParent) {
            const sourceNodeParentChildren = await getPageHierarchyFromES(
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

          setExpandedKeys(newExpandedKeys);
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
      [knowledgePageHierarchy]
    );

    const handleScroll: UIEventHandler<HTMLElement> = useCallback(
      (e) => {
        const scrollHeight =
          e.currentTarget.scrollHeight - e.currentTarget.scrollTop;
        const windowHeight =
          window.innerHeight - KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET;
        const finalScrollHeight =
          scrollHeight + (isPageHeaderAvailable ? 70 : 0);

        if (
          finalScrollHeight >= windowHeight - 1 &&
          finalScrollHeight <= windowHeight + 1 &&
          !paginationState.isPaginationEnd &&
          !paginationState.paginationLoading
        ) {
          fetchKnowledgePageHierarchy(
            false,
            true,
            paginationState.paging.offset +
              KNOWLEDGE_CENTER_PAGINATION_OFFSET_INCREMENT
          );
        }
      },
      [isPageHeaderAvailable, paginationState]
    );

    const renderNode = useCallback(
      (node: PageHierarchy): ReactNode => {
        const isActive = activeKey === node.fullyQualifiedName;
        const displayName = getKnowledgePageName(node);

        const hasChildren = node.childrenCount > 0 || !isEmpty(node.children);

        return (
          <Tree.Item
            id={node.fullyQualifiedName}
            key={node.fullyQualifiedName}
            textValue={displayName}>
            <Tree.ItemContent
              showGuideLines
              className="knowledge-hierarchy-node-wrapper"
              hasChildItems={hasChildren}>
              {() => (
                <Link
                  className="knowledge-hierarchy-node-link tw:flex tw:items-center tw:min-w-0 tw:flex-1 custom-group tw:justify-between tw:gap-2 tw:hover:no-underline"
                  data-isactive={isActive}
                  data-testid={`page-node-${displayName}`}
                  to={contextCenterClassBase.getArticlePath(
                    node.fullyQualifiedName
                  )}>
                  <Box align="center" className="tw:min-w-0 tw:flex-1" gap={2}>
                    <File06
                      className="tw:shrink-0 tw:text-gray-500"
                      data-testid="page-icon"
                      height={13}
                      width={13}
                    />
                    <Typography
                      ellipsis
                      className="knowledge-hierarchy-page-title"
                      size="text-sm"
                      weight={isActive ? 'semibold' : 'medium'}>
                      {displayName}
                    </Typography>
                  </Box>
                  {permissions.Delete && (
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
                  )}
                </Link>
              )}
            </Tree.ItemContent>
            {node.children?.map(renderNode)}
          </Tree.Item>
        );
      },
      [activeKey, permissions.Delete, handleDeletePage, t]
    );

    useImperativeHandle(ref, () => ({
      fetchKnowledgePageHierarchy: (forceRefresh = false) =>
        fetchKnowledgePageHierarchy(
          true,
          false,
          0,
          KNOWLEDGE_CENTER_PAGINATION_LIMIT,
          forceRefresh
        ),
    }));

    useEffect(() => {
      const isCreateHash = hash?.slice(1) === CREATE_PAGE_HASH;

      if (!isHierarchyInitialized || isCreateHash) {
        fetchKnowledgePageHierarchy();
      } else if (fqn !== lastFetchedFqnRef.current) {
        lastFetchedFqnRef.current = fqn;
      }
    }, [hash, fqn]);

    useEffect(() => {
      if (activeKey) {
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
        if (node && !node.children) {
          loadNodeChildren(key);
        }
      });
    }, [expandedKeys, knowledgePageHierarchy, loadNodeChildren]);

    if (isLoading) {
      return (
        <div className="knowledge-pages-hierarchy-wrapper">
          <Box align="center" className="tw:p-4 tw:pb-2" gap={3}>
            <Box
              align="center"
              className="tw:p-3 tw:rounded-lg tw:bg-gray-100 tw:leading-none"
              justify="center">
              <File06
                className="tw:text-gray-600"
                height={20}
                strokeWidth={1.2}
                width={20}
              />
            </Box>
            <Typography size="text-md" weight="semibold">
              {t('label.article-plural')}
            </Typography>
          </Box>
          <div className="tw:px-4 tw:pt-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                className="tw:h-5 tw:mb-2 tw:rounded tw:bg-gray-100 tw:animate-pulse"
                key={`skeleton-${i}`}
                style={{ width: `${60 + (i % 3) * 15}%` }}
              />
            ))}
          </div>
        </div>
      );
    }

    if (!isLoading && knowledgePageHierarchy.length === 0) {
      return (
        <CreateErrorPlaceHolder
          className="border-none p-x-md"
          permission={permissions.Create}
          placeholderText={t('message.no-articles-listed')}
          size={SIZE.MEDIUM}
        />
      );
    }

    return (
      <section
        aria-label={t('label.article-plural')}
        className="knowledge-pages-hierarchy-wrapper tw:pt-2 tw:px-3"
        data-testid="knowledge-pages-hierarchy-container"
        style={{ height: TREE_HEIGHT, overflow: 'auto' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
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
        }}
        onScroll={handleScroll}>
        <div className="tw:px-1.5 tw:pb-2.5">
          <Tabs
            className="tw:w-full"
            selectedKey={activeFilter}
            onSelectionChange={(key) =>
              setActiveFilter(key as ArticleFilterTab)
            }>
            <Tabs.List
              className="tw:gap-1 tw:flex-wrap"
              items={ARTICLE_FILTER_TABS.map((tab) => ({
                id: tab.id,
                label: t(tab.labelKey),
              }))}
              type="button-brand">
              {(tab) => (
                <Tabs.Item
                  {...tab}
                  className={({ isSelected }) =>
                    classNames(
                      'tw:rounded-full tw:border tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:cursor-pointer',
                      {
                        'tw:border-brand-100 tw:bg-brand-50 tw:text-brand-700':
                          isSelected,
                        'tw:border-gray-300 tw:bg-white tw:text-gray-700':
                          !isSelected,
                      }
                    )
                  }
                />
              )}
            </Tabs.List>
          </Tabs>
        </div>

        <Box align="center" className="tw:px-1.5 tw:pb-3" gap={2}>
          <Button
            className="tw:hover:*:data-text:decoration-transparent"
            color="link-gray"
            size="xs"
            onPress={() => setExpandedKeys(allExpandableIds)}>
            {t('label.expand-all')}
          </Button>
          <Dot className="tw:text-gray-300" size="micro" />
          <Button
            className="tw:hover:*:data-text:decoration-transparent"
            color="link-gray"
            size="xs"
            onPress={() => setExpandedKeys([])}>
            {t('label.collapse-all')}
          </Button>
        </Box>

        <Tree
          aria-label={t('label.article-plural')}
          className="knowledge-pages-tree"
          data-testid="knowledge-pages-hierarchy"
          expandedKeys={new Set(expandedKeys)}
          selectedKeys={activeKey ? new Set([activeKey]) : new Set<string>()}
          selectionMode="single"
          onExpandedChange={(keys: Selection) => {
            if (keys !== 'all') {
              setExpandedKeys(Array.from(keys).map(String));
            }
          }}
          onItemMove={handleItemMove}
          onItemRootDrop={(sourceKey) => {
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

        {paginationState.paginationLoading && <Loader size="x-small" />}

        <DeleteModal
          entityTitle={getKnowledgePageName(deletePage, t)}
          isDeleting={isDeleting}
          message={t('message.soft-delete-message-for-entity', {
            entity: getKnowledgePageName(deletePage, t),
          })}
          open={!isUndefined(deletePage)}
          onCancel={() => setDeletePage(undefined)}
          onDelete={async () => {
            if (!deletePage?.id) {
              return;
            }
            setIsDeleting(true);
            try {
              await deleteKnowledgePage(deletePage.id);
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
                  entity: t('label.knowledge-page'),
                })}
              />
              <Dialog.Content className="tw:block">
                <Transi18next
                  i18nKey="message.entity-transfer-message"
                  renderElement={<strong />}
                  values={{
                    from: getEntityName(movedPage?.sourceNode),
                    to: movedPage?.targetNode
                      ? getEntityName(movedPage.targetNode)
                      : t('label.base-knowledge'),
                    entity: t('label.page-lowercase'),
                  }}
                />
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
      </section>
    );
  }
);

export default KnowledgePagesHierarchy;

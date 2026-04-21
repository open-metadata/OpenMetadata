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
import { Button, Modal, Skeleton, Tree, Typography } from 'antd';
import { DataNode } from 'antd/es/tree';
import { AntTreeNodeProps, DirectoryTreeProps, TreeProps } from 'antd/lib/tree';
import { ReactComponent as KnowLedgePageIcon } from 'assets/svg/ic-knowledge-page.svg';
import { AxiosError } from 'axios';
import { CREATE_PAGE_HASH, ROUTES } from 'constants/constants';
import {
  CreateKnowledgePage,
  KnowledgePage,
  KnowledgePagesHierarchyRef,
  MovedEntity,
  PageHierarchy,
  PageType,
  RecentlyViewedQuickLinks,
} from 'interface/knowledge-center.interface';

import {
  forwardRef,
  Key,
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
import { Link, useNavigate } from 'react-router-dom';
import {
  getPageHierarchyFromES,
  patchKnowledgePage,
  postKnowledgePage,
} from 'rest/knowledgeCenterAPI';
import { showErrorToast } from 'utils/ToastUtils';

import { PlusOutlined } from '@ant-design/icons';
import { ReactComponent as DragIcon } from 'assets/svg/drag.svg';
import { ReactComponent as IconDown } from 'assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from 'assets/svg/ic-arrow-right.svg';
import { ReactComponent as DeleteIcon } from 'assets/svg/ic-delete.svg';
import classNames from 'classnames';
import DeleteWidgetModal from 'components/common/DeleteWidget/DeleteWidgetModal';
import CreateErrorPlaceHolder from 'components/common/ErrorWithPlaceholder/CreateErrorPlaceHolder';
import Loader from 'components/common/Loader/Loader';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import {
  KNOWLEDGE_CENTER_INSTANCE_NAME_LENGTH,
  KNOWLEDGE_CENTER_PAGINATION_LIMIT,
  KNOWLEDGE_CENTER_PAGINATION_OFFSET_INCREMENT,
  KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET,
  KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET_CHILD_ARTICLE,
} from 'constants/KnowledgeCenter.constant';
import { useLimitStore } from 'context/LimitsProvider/useLimitsStore';
import { OperationPermission } from 'context/PermissionProvider/PermissionProvider.interface';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { SIZE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { compare } from 'fast-json-patch';
import { useCurrentUserPreferences } from 'hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from 'hooks/useApplicationStore';
import useCustomLocation from 'hooks/useCustomLocation/useCustomLocation';
import { isUndefined, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Transi18next } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import Fqn from 'utils/Fqn';
import {
  convertToTreeData,
  extractKnowledgePageParentFQN,
  findPageAndParentInTreeData,
  findPageInTreeData,
  getExpandedNodeKeys,
  getKnowledgePagePath,
  getPageAllChildren,
  getUpdatePageHierarchy,
  getUpdatePageHierarchyForDelete,
  hierarchyPaginationInitialState,
  hierarchyPaginationReducer,
  integrateNodesIntoHierarchy,
  updateKnowledgeCenterRecentViewed,
  updateTreeData,
} from 'utils/KnowledgePageUtils';
import { useRequiredParams } from 'utils/useRequiredParams';
import './knowledge-pages-hierarchy.less';
const { DirectoryTree } = Tree;

interface KnowledgePagesHierarchyProps {
  permissions: OperationPermission;
  isPageHeaderAvailable: boolean;
  activeKey?: DirectoryTreeProps['activeKey'];
  activePage?: KnowledgePage;
  onPageDelete?: (id: string | string[]) => void;
  onLoading?: (isLoading: boolean) => void;
}

const KnowledgePagesHierarchy = forwardRef<
  KnowledgePagesHierarchyRef,
  KnowledgePagesHierarchyProps
>(
  (
    {
      activeKey,
      activePage,
      onPageDelete,
      onLoading,
      permissions,
      isPageHeaderAvailable,
    },
    ref
  ) => {
    const { fqn } = useRequiredParams<{ fqn: string }>();
    const navigate = useNavigate();
    const { hash } = useCustomLocation();
    const { currentUser } = useApplicationStore();
    const { t } = useTranslation();
    const [knowledgePageHierarchy, setKnowledgePageHierarchy] = useState<
      PageHierarchy[]
    >([]);
    const { getResourceLimit } = useLimitStore();

    // Cache to track if initial hierarchy has been loaded
    const [isHierarchyInitialized, setIsHierarchyInitialized] =
      useState<boolean>(false);
    // Track the last fqn for which hierarchy was fetched
    const lastFetchedFqnRef = useRef<string | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
    const [deletePage, setDeletePage] = useState<PageHierarchy>();

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

    const treeData: DataNode[] = useMemo(() => {
      return convertToTreeData(activePage, knowledgePageHierarchy);
    }, [knowledgePageHierarchy, activePage]);

    const fetchKnowledgePageHierarchy = async (
      setLoading = true,
      isPaginationLoading = false,
      offset = 0,
      limit = KNOWLEDGE_CENTER_PAGINATION_LIMIT,
      forceRefresh = false
    ) => {
      const isCreateHash = Boolean(hash && hash.slice(1) === CREATE_PAGE_HASH);

      // Skip fetching if hierarchy is already initialized and not forcing refresh
      // and not doing pagination loading and the fqn hasn't changed
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
        setPaginationState({
          type: 'SET_PAGINATION_LOADING',
          value: true,
        });
      }
      try {
        const { data, paging } = await getPageHierarchyFromES(
          undefined,
          undefined,
          offset,
          limit,
          fqn
        );

        // Update the last fetched fqn
        lastFetchedFqnRef.current = fqn;

        // set the pagination state
        setPaginationState({
          type: 'SET_PAGING_VALUE',
          value: paging,
        });

        // if the data is empty or the total count is equal to the current hierarchy
        if (
          data.length === 0 ||
          knowledgePageHierarchy.length === paging.total
        ) {
          setPaginationState({
            type: 'SET_IS_PAGINATION_END',
            value: true,
          });
        }

        if (isCreateHash) {
          setKnowledgePageHierarchy(data);
        } else {
          // Check if we have an activeFqn that represents a nested child node
          const fqnParts = fqn ? Fqn.split(fqn) : [];
          const isNestedNode = fqnParts.length > 1;

          // If it's a nested node, we need to ensure all parent nodes exist in the hierarchy
          if (isNestedNode && data.length > 0) {
            // Extract all parent FQNs from the activeFqn
            const parentFQN = extractKnowledgePageParentFQN(fqn);
            setKnowledgePageHierarchy((prevHierarchy) => {
              return integrateNodesIntoHierarchy(prevHierarchy, data);
            });

            // Ensure all parent nodes are expanded
            setExpandedKeys((prevKeys) => uniq([...prevKeys, ...parentFQN]));
          } else {
            // Standard merging logic for root-level items
            setKnowledgePageHierarchy((prevHierarchy) => {
              const mergedArray = prevHierarchy.concat(data);
              const updatedHierarchy = Array.from(
                new Map(mergedArray.map((item) => [item.id, item])).values()
              );

              return updatedHierarchy;
            });
          }
        }
        setIsHierarchyInitialized(true);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
        setPaginationState({
          type: 'SET_PAGINATION_LOADING',
          value: false,
        });
      }
    };

    const onLoadData = useCallback(
      async (node: DataNode) => {
        try {
          if (node.children) {
            return;
          }

          const { data: children } = await getPageHierarchyFromES(
            node.key as string
          );

          setKnowledgePageHierarchy(
            updateTreeData(
              knowledgePageHierarchy,
              children,
              node.key.toString()
            )
          );
        } catch {
          // do nothing
        }
      },
      [knowledgePageHierarchy]
    );

    const handleDeletePage = useCallback(
      (pageNode: DataNode) => {
        // find the page in the tree data
        const page = findPageInTreeData(
          knowledgePageHierarchy,
          pageNode.key as string
        );
        // if page is not found, return
        if (!page) {
          return;
        }
        // set the page to be deleted
        setDeletePage(page);
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
            (children) => children.id
          ),
        ];

        // call the callback if provided
        onPageDelete?.(deletedPages);

        // Update current count when Create / Delete operation performed
        await getResourceLimit('knowledgeCenter', true, true);

        // update the recent views
        updateKnowledgeCenterRecentViewed(
          recentlyViewed.filter(
            (page) => !deletedPages.includes(page.id)
          ) as unknown as RecentlyViewedQuickLinks['data']
        );

        // refresh the hierarchy
        deletedPageData &&
          setKnowledgePageHierarchy((prevHierarchy) =>
            getUpdatePageHierarchyForDelete(
              deletedPageData.fullyQualifiedName,
              prevHierarchy
            )
          );

        // if the deleted page is the active page or parent of active page, navigate to knowledge center
        if (
          activeKey === deletedPageData.fullyQualifiedName ||
          isActivePageParent
        ) {
          navigate(ROUTES.KNOWLEDGE_CENTER);
        }
      },
      [knowledgePageHierarchy, onPageDelete, activeKey, activePage]
    );

    const handleAddPage = useCallback(
      async (pageNode: DataNode) => {
        // find the page in the tree data
        const page = findPageInTreeData(
          knowledgePageHierarchy,
          pageNode.key as string
        );

        // if page is not found, return
        if (!page) {
          return;
        }

        try {
          onLoading?.(true);
          const instanceName = `${PageType.ARTICLE}_${cryptoRandomString({
            length: KNOWLEDGE_CENTER_INSTANCE_NAME_LENGTH,
            type: 'alphanumeric',
          })}`;

          // create a new page
          const data: CreateKnowledgePage = {
            name: instanceName,
            displayName: '',
            description: '',
            pageType: PageType.ARTICLE,
            page: {
              publicationDate: new Date(),
              relatedArticles: [],
            },
            owners: [
              {
                type: 'user',
                id: currentUser?.id ?? '',
              },
            ],
            parent: { id: page.id, type: 'page' },
          };
          const response = await postKnowledgePage(data);

          // Convert the created page response to PageHierarchy format
          const newPageHierarchy: PageHierarchy = {
            id: response.id,
            name: response.name,
            fullyQualifiedName: response.fullyQualifiedName,
            displayName: response.displayName,
            description: response.description,
            pageType: response.pageType,
            childrenCount: 0,
          };

          // Add the newly created page to the hierarchy tree immediately
          setKnowledgePageHierarchy((prevHierarchy) =>
            updateTreeData(
              prevHierarchy,
              [newPageHierarchy],
              page.fullyQualifiedName
            )
          );

          // Ensure parent node is expanded to show the new child
          setExpandedKeys((prevKeys) =>
            uniq([...prevKeys, page.fullyQualifiedName])
          );

          // Update resource limit count
          await getResourceLimit('knowledgeCenter', true, true);

          // push to the newly created page
          navigate({
            pathname: getKnowledgePagePath(response.fullyQualifiedName),
          });
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          onLoading?.(false);
        }
      },
      [currentUser, knowledgePageHierarchy, getResourceLimit]
    );

    const titleRender = useCallback(
      (node: DataNode) => {
        const nodeKey = node.key as string;

        return (
          <div
            data-isactive={activeKey === node.key}
            data-testid={`page-node-${node.title}`}>
            <Link
              className="anchor-no-underline"
              to={getKnowledgePagePath(nodeKey)}>
              <div
                className={classNames(
                  'knowledge-hierarchy-page-title-wrapper',
                  {
                    'leaf-node-title': node.isLeaf,
                  }
                )}>
                <span className="node-page-icon">
                  <KnowLedgePageIcon data-testid="page-icon" />
                </span>
                <Typography.Text
                  ellipsis
                  className="text-base-color knowledge-hierarchy-page-title">
                  {node.title as ReactNode}
                </Typography.Text>
              </div>
            </Link>
            <div
              className="d-flex knowledge-hierarchy-action-btn"
              data-testid={`${node.title}-page-node-action-buttons`}>
              <Button
                className="knowledge-hierarchy-action-btn-item"
                data-testid={`${node.title}-delete-page-btn`}
                disabled={!permissions.Delete}
                title="Delete Page"
                type="text"
                onClick={() => handleDeletePage(node)}>
                <DeleteIcon
                  className="text-grey-muted"
                  style={{ verticalAlign: 'middle' }}
                  width={12}
                />
              </Button>
              <Button
                className="knowledge-hierarchy-action-btn-item"
                data-testid={`${node.title}-add-page-btn`}
                disabled={!permissions.Create}
                title="Quickly add a page inside"
                type="text"
                onClick={() => handleAddPage(node)}>
                <PlusOutlined className="text-grey-muted" />
              </Button>
            </div>
          </div>
        );
      },
      [handleDeletePage, handleAddPage, activeKey]
    );

    const handleMovePage = async (movedPageData: MovedEntity) => {
      try {
        setIsMovingPage(true);
        const { sourceNode, sourceNodeParent, targetNode } = movedPageData;

        const newExpandedKeys = [];

        // step1: update the source node parent
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

        const sourceNodePatch = compare(sourceNode, updatedSourceNodeForPatch);

        await patchKnowledgePage(sourceNode.id, sourceNodePatch);

        if (!isUndefined(targetNode)) {
          // step2: fetch updated children for the target node
          const targetNodeChildren = await getPageHierarchyFromES(
            targetNode.fullyQualifiedName
          );

          setKnowledgePageHierarchy((prevHierarchy) => {
            return getUpdatePageHierarchy(
              prevHierarchy,
              {
                ...targetNode,
                children: targetNodeChildren.data,
              },
              true
            );
          });

          newExpandedKeys.push(targetNode.fullyQualifiedName);

          // step3: fetch updated children for the source node parent
          if (sourceNodeParent) {
            const sourceNodeParentChildren = await getPageHierarchyFromES(
              sourceNodeParent.fullyQualifiedName
            );

            setKnowledgePageHierarchy((prevHierarchy) => {
              return getUpdatePageHierarchy(
                prevHierarchy,
                {
                  ...sourceNodeParent,
                  children: sourceNodeParentChildren.data,
                },
                true
              );
            });

            newExpandedKeys.push(sourceNodeParent.fullyQualifiedName);
          } else {
            // if the source node parent is not found, remove the source node from the hierarchy
            setKnowledgePageHierarchy((prevHierarchy) => {
              return prevHierarchy.filter((page) => page.id !== sourceNode.id);
            });
          }

          // step4: update expanded keys
          setExpandedKeys(newExpandedKeys);
        } else {
          fetchKnowledgePageHierarchy(
            true,
            false,
            0,
            KNOWLEDGE_CENTER_PAGINATION_LIMIT,
            true
          );
          setExpandedKeys([]);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setMovedPage(undefined);
        setIsMovingPage(false);
      }
    };

    const handleDragAndDrop: TreeProps['onDrop'] = async (info) => {
      const isDropPositionParentLevel = info.dropPosition === -1;
      const sources = info.dragNode;
      const target = info.node;

      // if the source and target are same, return
      if (sources.key === target.key) {
        return;
      }

      const targetNode = findPageInTreeData(
        knowledgePageHierarchy,
        target.key.toString()
      );

      if (!targetNode) {
        return;
      }

      const { page: sourceNode, parent: sourceNodeParent } =
        findPageAndParentInTreeData(
          knowledgePageHierarchy,
          sources.key.toString()
        );

      if (!sourceNode) {
        return;
      }

      // if the source node is already a direct child of the target node, return
      const isChild = (targetNode.children ?? []).find(
        (child) => child.id === sourceNode.id
      );

      if (isChild && !isDropPositionParentLevel) {
        return;
      }

      const movedPageData = {
        sourceNode,
        sourceNodeParent,
        targetNode: isDropPositionParentLevel ? undefined : targetNode,
      };

      setMovedPage(movedPageData);
    };

    const handleScroll: UIEventHandler<HTMLElement> = useCallback(
      (e) => {
        const scrollHeight =
          e.currentTarget.scrollHeight - e.currentTarget.scrollTop;
        const windowHeight =
          window.innerHeight - KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET;

        // if the scroll height is within the range of window height, fetch the next page,
        // since on bigger screen there can be a chance the height is not exactly window height

        const finalScrollHeight =
          scrollHeight + (isPageHeaderAvailable ? 70 : 0); // to maintain the height of panel after header added
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
      // Only fetch on initial mount or when hash changes to CREATE_PAGE_HASH
      const isCreateHash = Boolean(hash && hash.slice(1) === CREATE_PAGE_HASH);

      if (!isHierarchyInitialized || isCreateHash) {
        fetchKnowledgePageHierarchy();
      } else if (fqn !== lastFetchedFqnRef.current) {
        // FQN changed but we already have hierarchy data, just update the ref
        // The tree selection will be handled by activeKey prop
        lastFetchedFqnRef.current = fqn;
      }
    }, [hash, fqn]);

    useEffect(() => {
      if (activeKey) {
        setExpandedKeys((prevKeys) =>
          uniq([
            ...prevKeys,
            ...getExpandedNodeKeys(knowledgePageHierarchy, activeKey as string),
          ])
        );
      }
    }, [activeKey, knowledgePageHierarchy]);

    useEffect(() => {
      if (activePage) {
        setKnowledgePageHierarchy((prevHierarchy) => {
          const updatedHierarchy = getUpdatePageHierarchy(
            prevHierarchy,
            activePage
          );

          return updatedHierarchy;
        });
      }
    }, [activePage]);

    if (isLoading) {
      return (
        <div className="knowledge-pages-hierarchy-wrapper">
          <Skeleton
            active
            className="w-max-200 knowledge-hierarchy-page-title m-l-lg"
            paragraph={{ rows: 10 }}
            title={false}
          />
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
      <div className="knowledge-pages-hierarchy-wrapper">
        <DirectoryTree
          data-testid="knowledge-pages-hierarchy"
          defaultExpandAll={false}
          draggable={{
            icon: <DragIcon color={DE_ACTIVE_COLOR} />,
            nodeDraggable: () => true,
          }}
          expandAction={false}
          expandedKeys={expandedKeys}
          height={TREE_HEIGHT}
          icon={null}
          loadData={onLoadData}
          loadedKeys={expandedKeys}
          selectedKeys={activeKey ? [activeKey] : []}
          switcherIcon={(props: AntTreeNodeProps) => {
            return props.expanded ? (
              <IconDown data-testid={`${props.title}-collapse-icon`} />
            ) : (
              <IconRight data-testid={`${props.title}-collapse-icon`} />
            );
          }}
          titleRender={titleRender}
          treeData={treeData}
          onDrop={handleDragAndDrop}
          onExpand={(keys) => setExpandedKeys(keys)}
          onScroll={handleScroll}
        />

        {paginationState.paginationLoading && <Loader size="x-small" />}

        {deletePage && (
          <DeleteWidgetModal
            isRecursiveDelete
            afterDeleteAction={() => handleAfterDeletePage(deletePage)}
            allowSoftDelete={false}
            entityId={deletePage.id}
            entityName={deletePage.displayName || t('label.untitled')}
            entityType={EntityType.KNOWLEDGE_PAGE as unknown as EntityType}
            prepareType={false}
            successMessage={t('server.entity-deleted-successfully', {
              entity: t('label.article'),
            })}
            visible={!isUndefined(deletePage)}
            onCancel={() => setDeletePage(undefined)}
          />
        )}

        {movedPage && (
          <Modal
            centered
            destroyOnClose
            cancelButtonProps={{ disabled: isMovingPage, type: 'text' }}
            closable={false}
            confirmLoading={isMovingPage}
            data-testid="confirmation-modal"
            maskClosable={false}
            okText={t('label.confirm')}
            open={Boolean(movedPage)}
            title={t('label.move-the-entity', {
              entity: t('label.knowledge-page'),
            })}
            onCancel={() => setMovedPage(undefined)}
            onOk={() => handleMovePage(movedPage)}>
            <Transi18next
              i18nKey="message.entity-transfer-message"
              renderElement={<strong />}
              values={{
                from: getEntityName(movedPage.sourceNode),
                to: movedPage.targetNode
                  ? getEntityName(movedPage.targetNode)
                  : t('label.base-knowledge'),
                entity: t('label.page-lowercase'),
              }}
            />
          </Modal>
        )}
      </div>
    );
  }
);

export default KnowledgePagesHierarchy;

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

import { DownOutlined, WarningOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Button,
  Checkbox,
  Col,
  Dropdown,
  Input,
  MenuProps,
  Modal,
  Popover,
  Row,
  Space,
  TableProps,
  Tooltip,
} from 'antd';
import { ColumnsType, ExpandableConfig } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { debounce, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as IconDrag } from '../../../assets/svg/drag.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import { ReactComponent as DownUpArrowIcon } from '../../../assets/svg/ic-down-up-arrow.svg';
import { ReactComponent as UpDownArrowIcon } from '../../../assets/svg/ic-up-down-arrow.svg';
import { ReactComponent as PlusOutlinedIcon } from '../../../assets/svg/plus-outlined.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import StatusBadge from '../../../components/common/StatusBadge/StatusBadge.component';
import {
  API_RES_MAX_SIZE,
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_LARGE,
  TEXT_BODY_COLOR,
} from '../../../constants/constants';
import { GLOSSARIES_DOCS } from '../../../constants/docs.constants';
import { TaskOperation } from '../../../constants/Feeds.constants';
import {
  DEFAULT_VISIBLE_COLUMNS,
  GLOSSARY_TERM_STATUS_OPTIONS,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS,
  STATIC_VISIBLE_COLUMNS,
} from '../../../constants/Glossary.contant';
import { TABLE_CONSTANTS } from '../../../constants/Teams.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { ResolveTask } from '../../../generated/api/feed/resolveTask';
import {
  EntityReference,
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { User } from '../../../generated/entity/teams/user';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getAllFeeds, updateTask } from '../../../rest/feedsAPI';
import {
  getFirstLevelGlossaryTermsPaginated,
  getGlossaryTermChildrenLazy,
  getGlossaryTerms,
  patchGlossaryTerm,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import { getBulkEditButton } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import { EntityStatusClass } from '../../../utils/EntityStatusUtils';
import {
  getEntityBulkEditPath,
  getEntityName,
} from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import {
  buildTree,
  findExpandableKeysForArray,
  glossaryTermTableColumnsWidth,
  permissionForApproveOrReject,
} from '../../../utils/GlossaryUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { ownerTableObject } from '../../../utils/TableColumn.util';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { DraggableBodyRowProps } from '../../common/Draggable/DraggableBodyRowProps.interface';
import Loader from '../../common/Loader/Loader';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import StatusAction from '../../common/StatusAction/StatusAction';
import Table from '../../common/Table/Table';
import TagButton from '../../common/TagButton/TagButton.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import WorkflowHistory from '../GlossaryTerms/tabs/WorkFlowTab/WorkflowHistory.component';
import { ModifiedGlossary, useGlossaryStore } from '../useGlossary.store';
import {
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
  MoveGlossaryTermType,
} from './GlossaryTermTab.interface';

const GlossaryTermTab = ({ isGlossary, className }: GlossaryTermTabProps) => {
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const {
    activeGlossary,
    glossaryChildTerms,
    setGlossaryChildTerms,
    onAddGlossaryTerm,
    onEditGlossaryTerm,
    refreshGlossaryTerms,
  } = useGlossaryStore();
  const { permissions } = useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [termTaskThreads, setTermTaskThreads] = useState<
    Record<string, Thread[]>
  >({});

  const { glossaryTerms, expandableKeys } = useMemo(() => {
    const terms = Array.isArray(glossaryChildTerms)
      ? (glossaryChildTerms as ModifiedGlossaryTerm[])
      : [];

    return {
      expandableKeys: findExpandableKeysForArray(terms),
      glossaryTerms: terms,
    };
  }, [glossaryChildTerms, findExpandableKeysForArray]);

  const [movedGlossaryTerm, setMovedGlossaryTerm] =
    useState<MoveGlossaryTermType>();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isTableHovered, setIsTableHovered] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [isStatusDropdownVisible, setIsStatusDropdownVisible] =
    useState<boolean>(false);
  const [statusDropdownSelection, setStatusDropdownSelection] = useState<
    string[]
  >([EntityStatus.Approved, EntityStatus.Draft, EntityStatus.InReview]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([
    ...statusDropdownSelection,
  ]);
  const [confirmCheckboxChecked, setConfirmCheckboxChecked] = useState(false);

  const { paging, handlePagingChange } = usePaging(PAGE_SIZE_LARGE);
  const [loadingChildren, setLoadingChildren] = useState<
    Record<string, boolean>
  >({});

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [previousGlossaryFQN, setPreviousGlossaryFQN] = useState<
    string | undefined
  >(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchPaging, setSearchPaging] = useState<{
    offset: number;
    total?: number;
    hasMore: boolean;
  }>({ offset: 0, total: undefined, hasMore: true });
  const [isExpandingAll, setIsExpandingAll] = useState(false);
  const [toggleExpandBtn, setToggleExpandBtn] = useState(false);

  const { ref: infiniteScrollRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: '50px',
    trackVisibility: true,
    delay: 100,
  });
  // handle search
  const handleSearch = useCallback(async (value: string) => {
    setSearchTerm(value);
  }, []);

  const debouncedSetSearchTerm = useCallback(debounce(handleSearch, 500), [
    handleSearch,
  ]);

  const fetchChildTerms = async (parentFQN: string, after?: string) => {
    setLoadingChildren((prev) => ({ ...prev, [parentFQN]: true }));
    try {
      const response = await getGlossaryTermChildrenLazy(parentFQN, 50, after);
      const { data, paging } = response;

      // Validate glossaryChildTerms is an array
      if (!Array.isArray(glossaryChildTerms)) {
        return;
      }

      // Recursive function to update nested terms
      const updateNestedTerms = (
        terms: ModifiedGlossary[]
      ): ModifiedGlossary[] => {
        return terms.map((term) => {
          if (term.fullyQualifiedName === parentFQN) {
            const existingChildren = after ? term.children ?? [] : [];
            const newChildren = data;

            return {
              ...term,
              children: [...existingChildren, ...newChildren],
              hasMoreChildren: !!paging?.after,
              childrenPagingAfter: paging?.after,
            };
          }

          // Check if this term has children and recursively update them
          if (term.children && term.children.length > 0) {
            return {
              ...term,
              children: updateNestedTerms(
                term.children as ModifiedGlossary[]
              ) as ModifiedGlossaryTerm[],
            };
          }

          return term;
        });
      };

      const updatedTerms = updateNestedTerms(glossaryChildTerms);
      setGlossaryChildTerms(updatedTerms);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingChildren((prev) => ({ ...prev, [parentFQN]: false }));
    }
  };

  const initializeLoadingStates = (loadMore: boolean) => {
    if (loadMore) {
      setIsLoadingMore(true);

      return;
    }

    setIsTableLoading(true);

    if (searchTerm) {
      setSearchPaging({ offset: 0, total: undefined, hasMore: true });
    } else {
      handlePagingChange((prev) => ({ ...prev, after: undefined }));
    }
  };

  const fetchAllTerms = async (loadMore = false) => {
    initializeLoadingStates(loadMore);

    try {
      let data;
      let pagingResponse: Paging | undefined;

      // Use search API if search term is present
      if (searchTerm) {
        const currentOffset = loadMore ? searchPaging.offset : 0;
        const response = await searchGlossaryTermsPaginated(
          searchTerm,
          undefined,
          activeGlossary?.fullyQualifiedName,
          undefined,
          undefined,
          PAGE_SIZE_LARGE,
          currentOffset,
          'children,relatedTerms,reviewers,owners,tags,usageCount,domains,extension,childrenCount'
        );
        data = response.data;
        pagingResponse = response.paging;

        // Update search pagination state
        const newOffset = currentOffset + PAGE_SIZE_LARGE;
        const hasMore =
          data.length === PAGE_SIZE_LARGE &&
          (pagingResponse?.total === undefined ||
            newOffset < pagingResponse?.total);
        setSearchPaging({
          offset: newOffset,
          total: pagingResponse?.total,
          hasMore,
        });
      } else {
        // Use regular listing API when no search term
        const response = await getFirstLevelGlossaryTermsPaginated(
          activeGlossary?.fullyQualifiedName || '',
          PAGE_SIZE_LARGE,
          loadMore ? paging.after : undefined
        );
        data = response.data;
        pagingResponse = response.paging;

        // Update regular paging state for next page
        handlePagingChange((prev) => ({
          ...prev,
          after: pagingResponse?.after,
          total: pagingResponse?.total || prev.total,
        }));
      }

      if (!data || !Array.isArray(data)) {
        return;
      }

      const newTerms = data as ModifiedGlossary[];

      if (loadMore && Array.isArray(glossaryChildTerms)) {
        // Use unionBy to append new terms while avoiding duplicates
        const mergedTerms = [...glossaryChildTerms, ...newTerms];

        setGlossaryChildTerms(mergedTerms);
      } else {
        // Replace terms
        setGlossaryChildTerms(data as ModifiedGlossary[]);
        // Start with all terms collapsed
        setExpandedRowKeys([]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTableLoading(false);
      setIsLoadingMore(false);
    }
  };

  const fetchExpadedTree = async () => {
    setIsTableLoading(true);
    setIsExpandingAll(true);
    const key = isGlossary ? 'glossary' : 'parent';
    const { data } = await getGlossaryTerms({
      [key]: activeGlossary?.id || '',
      limit: API_RES_MAX_SIZE,
      fields: [
        TabSpecificField.OWNERS,
        TabSpecificField.PARENT,
        TabSpecificField.CHILDREN,
      ],
    });
    setGlossaryChildTerms(buildTree(data) as ModifiedGlossary[]);
    const keys = data.reduce((prev, curr) => {
      if (curr.children?.length) {
        prev.push(curr.fullyQualifiedName ?? '');
      }

      return prev;
    }, [] as string[]);

    setExpandedRowKeys(keys);
    setIsTableLoading(false);
    setIsExpandingAll(false);
  };
  const fetchAllTasks = useCallback(async () => {
    if (!activeGlossary?.fullyQualifiedName) {
      return;
    }

    const entityType = isGlossary
      ? EntityType.GLOSSARY
      : EntityType.GLOSSARY_TERM;

    try {
      const { data } = await getAllFeeds(
        `<#E::${entityType}::${activeGlossary.fullyQualifiedName}>`,
        undefined,
        ThreadType.Task,
        undefined,
        ThreadTaskStatus.Open,
        undefined,
        API_RES_MAX_SIZE
      );

      // Organize tasks by glossary term FQN
      const tasksByTerm = data.reduce(
        (acc: Record<string, Thread[]>, thread: Thread) => {
          const termFQN = thread.about;
          if (termFQN) {
            if (!acc[termFQN]) {
              acc[termFQN] = [];
            }
            acc[termFQN].push(thread);
          }

          return acc;
        },
        {}
      );

      setTermTaskThreads(tasksByTerm);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [activeGlossary?.fullyQualifiedName]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  useEffect(() => {
    const currentFQN = activeGlossary?.fullyQualifiedName;

    if (
      currentFQN &&
      !isLoadingMore &&
      currentFQN !== previousGlossaryFQN &&
      !toggleExpandBtn &&
      !searchTerm // Don't fetch if there's an active search
    ) {
      // Clear existing terms when switching glossaries
      setGlossaryChildTerms([]);
      handlePagingChange((prev) => ({ ...prev, after: undefined }));
      setPreviousGlossaryFQN(currentFQN);
      fetchAllTerms();
    }
  }, [
    activeGlossary?.fullyQualifiedName,
    isLoadingMore,
    previousGlossaryFQN,
    toggleExpandBtn,
    searchTerm,
  ]);

  // Clear terms when component unmounts
  useEffect(() => {
    return () => {
      setGlossaryChildTerms([]);
    };
  }, []);

  const findScrollContainer = useCallback(() => {
    // First check for our specific scrollable container
    const scrollContainer = document.querySelector(
      '.glossary-terms-scroll-container'
    );
    if (scrollContainer) {
      return scrollContainer;
    }

    // Fallback to other selectors
    const selectors = [
      '.glossary-term-page-tabs .ant-tabs-tabpane-active',
      '.glossary-page-tabs .ant-tabs-tabpane-active',
      '.ant-tabs-tabpane-active',
      '.ant-tabs-content',
      '.grid-container',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.scrollHeight > element.clientHeight) {
        return element;
      }
    }

    return null;
  }, []);

  useEffect(() => {
    // For search mode, check searchPaging.hasMore; for regular mode, check paging.after
    const canLoadMore = searchTerm
      ? searchPaging.hasMore
      : paging.after !== undefined;

    if (
      inView &&
      canLoadMore &&
      !isLoadingMore &&
      !isTableLoading &&
      !toggleExpandBtn
    ) {
      fetchAllTerms(true);
    }
  }, [
    inView,
    paging.after,
    searchPaging.hasMore,
    isLoadingMore,
    isTableLoading,
    toggleExpandBtn,
  ]);

  // Monitor for DOM changes to detect when the table becomes scrollable
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const scrollContainer = findScrollContainer();
      // Check if we can load more based on search vs regular mode
      const canLoadMore = searchTerm
        ? searchPaging.hasMore
        : paging.after !== undefined;

      if (
        scrollContainer &&
        canLoadMore &&
        !isLoadingMore &&
        !toggleExpandBtn &&
        !isTableLoading // Added check to prevent multiple fetches
      ) {
        const { scrollHeight, clientHeight } = scrollContainer;
        // If content doesn't fill the viewport, load more
        if (scrollHeight <= clientHeight + 10) {
          fetchAllTerms(true);
        }
      }
    });

    const scrollContainer = document.querySelector(
      '.glossary-terms-scroll-container'
    );
    if (scrollContainer) {
      observer.observe(scrollContainer, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    return () => observer.disconnect();
  }, [
    paging.after,
    searchPaging.hasMore,
    isLoadingMore,
    findScrollContainer,
    toggleExpandBtn,
    isTableLoading,
  ]);

  // Additional scroll handler for parent container
  useEffect(() => {
    const handleScroll = (event: Event) => {
      const scrollContainer = event.target as HTMLElement;
      // Check if we can load more based on search vs regular mode
      const canLoadMore = searchTerm
        ? searchPaging.hasMore
        : paging.after !== undefined;

      if (
        scrollContainer &&
        canLoadMore &&
        !isLoadingMore &&
        !isTableLoading &&
        !toggleExpandBtn
      ) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        // Load more when user is 200px from the bottom
        if (scrollHeight - scrollTop - clientHeight < 200) {
          fetchAllTerms(true);
        }
      }
    };

    const scrollContainer = findScrollContainer();
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, {
        passive: true,
      });

      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }

    // If container not found initially, no need for timeout -
    // the component should handle cases where container might appear later
    return undefined;
  }, [
    paging.after,
    searchPaging.hasMore,
    searchTerm,
    isLoadingMore,
    isTableLoading,
    findScrollContainer,
    fetchAllTerms,
  ]);

  const glossaryTermStatus: EntityStatus | null = useMemo(() => {
    if (!isGlossary) {
      return (
        (activeGlossary as GlossaryTerm).entityStatus ?? EntityStatus.Approved
      );
    }

    return null;
  }, [isGlossary, activeGlossary]);

  const tableColumnsWidth = useMemo(
    () => glossaryTermTableColumnsWidth(containerWidth, permissions.Create),
    [permissions.Create, containerWidth]
  );

  const updateGlossaryTermStatus = (
    terms: ModifiedGlossary[],
    targetFqn: string,
    newStatus: EntityStatus
  ): ModifiedGlossary[] => {
    return terms.map((term) => {
      if (term.fullyQualifiedName === targetFqn) {
        return {
          ...term,
          entityStatus: newStatus,
        };
      }

      if (term.children && term.children.length > 0) {
        return {
          ...term,
          children: updateGlossaryTermStatus(
            term.children as ModifiedGlossary[],
            targetFqn,
            newStatus
          ),
        };
      }

      return term;
    }) as ModifiedGlossary[];
  };

  const updateTaskData = useCallback(
    async (
      data: ResolveTask,
      taskId: string | number,
      glossaryTermFqn: string
    ) => {
      try {
        if (!taskId) {
          return;
        }

        await updateTask(TaskOperation.RESOLVE, taskId + '', data);
        showSuccessToast(t('server.task-resolved-successfully'));

        const currentExpandedKeys = [...expandedRowKeys];
        setExpandedRowKeys(currentExpandedKeys);

        if (glossaryChildTerms && glossaryTermFqn) {
          const newStatus =
            data.newValue === 'approved'
              ? EntityStatus.Approved
              : EntityStatus.Rejected;

          const updatedTerms = updateGlossaryTermStatus(
            glossaryChildTerms,
            glossaryTermFqn,
            newStatus
          );

          setGlossaryChildTerms(updatedTerms);

          // remove resolved task from term task threads
          if (termTaskThreads[glossaryTermFqn]) {
            const updatedThreads = { ...termTaskThreads };
            updatedThreads[glossaryTermFqn] = updatedThreads[
              glossaryTermFqn
            ].filter(
              (thread) => !(thread.id && thread.id.toString() === taskId)
            );

            setTermTaskThreads(updatedThreads);
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [expandedRowKeys, glossaryChildTerms, termTaskThreads]
  );

  const handleApproveGlossaryTerm = useCallback(
    (taskId: string | number, glossaryTermFqn: string) => {
      const data = { newValue: 'approved' } as ResolveTask;
      updateTaskData(data, taskId, glossaryTermFqn);
    },
    [updateTaskData]
  );

  const handleRejectGlossaryTerm = useCallback(
    (taskId: string | number, glossaryTermFqn: string) => {
      const data = { newValue: 'rejected' } as ResolveTask;
      updateTaskData(data, taskId, glossaryTermFqn);
    },
    [updateTaskData]
  );

  const handleLoadMoreChildren = useCallback(
    (record: ModifiedGlossaryTerm) => {
      if (record.childrenPagingAfter) {
        fetchChildTerms(
          record.fullyQualifiedName || '',
          record.childrenPagingAfter
        );
      }
    },
    [fetchChildTerms]
  );

  const columns = useMemo(() => {
    const data: ColumnsType<ModifiedGlossaryTerm> = [
      {
        title: t('label.term-plural'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.NAME,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.NAME,
        className: 'glossary-name-column',
        ellipsis: true,
        width: tableColumnsWidth.name,
        render: (_, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            const parentRecord = (
              record as ModifiedGlossaryTerm & {
                parentRecord?: ModifiedGlossaryTerm;
              }
            ).parentRecord;
            const isLoading =
              loadingChildren[parentRecord?.fullyQualifiedName || ''];

            const loadedCount = parentRecord?.children?.length ?? 0;
            const totalCount = parentRecord?.childrenCount ?? 0;
            const remainingCount = totalCount - loadedCount;

            return (
              <Button
                className="text-primary"
                data-testid="load-more-children-button"
                loading={isLoading}
                size="small"
                type="link"
                onClick={() =>
                  parentRecord && handleLoadMoreChildren(parentRecord)
                }>
                {t('label.view-more-count', {
                  countValue: remainingCount,
                })}
              </Button>
            );
          }

          const name = getEntityName(record);

          return (
            <>
              {record.style?.iconURL && (
                <img
                  alt={record.name}
                  className="m-r-xss vertical-baseline"
                  data-testid="tag-icon"
                  height={12}
                  src={record.style.iconURL}
                />
              )}
              <Link
                className="cursor-pointer vertical-baseline"
                data-testid={name}
                style={{ color: record.style?.color }}
                to={getGlossaryPath(record.fullyQualifiedName ?? record.name)}>
                {name}
              </Link>
            </>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: tableColumnsWidth.description,
        render: (description: string, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return description?.trim() ? (
            <RichTextEditorPreviewerNew
              enableSeeMoreVariant
              markdown={description}
              maxLength={120}
            />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          );
        },
      },
      {
        title: t('label.status'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
        // this check is added to the width, since the last column is optional and to maintain
        // the re-sizing of the column should not be affected the others columns width sizes.
        ...(permissions.Create && {
          width: tableColumnsWidth.status,
        }),
        render: (_, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          const status = record.entityStatus ?? EntityStatus.Approved;
          const termFQN = record.fullyQualifiedName ?? '';
          const { permission, taskId } = permissionForApproveOrReject(
            record,
            currentUser as User,
            termTaskThreads
          );

          if (status === EntityStatus.InReview && permission) {
            return (
              <StatusAction
                dataTestId={record.name}
                onApprove={() => handleApproveGlossaryTerm(taskId, termFQN)}
                onReject={() => handleRejectGlossaryTerm(taskId, termFQN)}
              />
            );
          }

          return (
            <Popover
              content={
                <WorkflowHistory glossaryTerm={record as GlossaryTerm} />
              }
              overlayStyle={{ minWidth: '260px' }}
              placement="topLeft"
              trigger="hover">
              <div>
                <StatusBadge
                  dataTestId={termFQN + '-status'}
                  label={status}
                  status={EntityStatusClass[status]}
                />
              </div>
            </Popover>
          );
        },
        onFilter: (value, record) => record.entityStatus === value,
      },
      {
        title: t('label.reviewer'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.REVIEWERS,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.REVIEWERS,
        width: tableColumnsWidth.reviewers,
        render: (reviewers: EntityReference[], record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return (
            <OwnerLabel
              isCompactView={false}
              owners={reviewers}
              placeHolder={t('label.no-entity', {
                entity: t('label.reviewer-plural'),
              })}
              showLabel={false}
            />
          );
        },
      },
      {
        title: t('label.synonym-plural'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.SYNONYMS,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.SYNONYMS,
        width: tableColumnsWidth.synonyms,
        render: (synonyms: string[], record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return isEmpty(synonyms) ? (
            <div>{NO_DATA_PLACEHOLDER}</div>
          ) : (
            <div className="d-flex flex-wrap">
              {synonyms.map((synonym: string) => (
                <TagButton
                  className="glossary-synonym-tag"
                  key={synonym}
                  label={synonym}
                />
              ))}
            </div>
          );
        },
      },
      ...ownerTableObject<ModifiedGlossaryTerm>().map((col) => ({
        ...col,
        render: (owners: EntityReference[], record: ModifiedGlossaryTerm) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return col.render ? col.render(owners, record, 0) : null;
        },
      })),
    ];
    if (permissions.Create) {
      data.push({
        title: t('label.action-plural'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
        render: (_, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          const status = record.entityStatus ?? EntityStatus.Approved;
          const allowAddTerm = status === EntityStatus.Approved;

          return (
            <div className="d-flex items-center">
              {allowAddTerm && (
                <Tooltip
                  title={t('label.add-entity', {
                    entity: t('label.glossary-term'),
                  })}>
                  <Button
                    className="add-new-term-btn text-grey-muted flex-center"
                    data-testid="add-classification"
                    icon={
                      <PlusOutlinedIcon color={DE_ACTIVE_COLOR} width="14px" />
                    }
                    size="small"
                    type="text"
                    onClick={() => {
                      onAddGlossaryTerm(record as GlossaryTerm);
                    }}
                  />
                </Tooltip>
              )}

              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.glossary-term'),
                })}>
                <Button
                  className="cursor-pointer flex-center"
                  data-testid="edit-button"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                  onClick={() => onEditGlossaryTerm(record as GlossaryTerm)}
                />
              </Tooltip>
            </div>
          );
        },
      });
    }

    return data;
  }, [
    permissions,
    tableColumnsWidth,
    termTaskThreads,
    handleApproveGlossaryTerm,
    handleRejectGlossaryTerm,
    handleLoadMoreChildren,
    loadingChildren,
  ]);

  const handleCheckboxChange = useCallback(
    (key: string, checked: boolean) => {
      const setCheckedList = setStatusDropdownSelection;

      const optionsToUse = GLOSSARY_TERM_STATUS_OPTIONS;

      if (key === 'all') {
        if (checked) {
          const newCheckedList = [
            'all',
            ...optionsToUse.map((option) => option.value),
          ];
          setCheckedList(newCheckedList);
        } else {
          setCheckedList([]);
        }
      } else {
        setCheckedList((prev: string[]) => {
          const newCheckedList = checked
            ? [...prev, key]
            : prev.filter((item) => item !== key);

          const allChecked = (optionsToUse as { value: string }[]).every(
            (opt) => newCheckedList.includes(opt.value ?? '')
          );

          if (allChecked) {
            return ['all', ...newCheckedList];
          }

          return newCheckedList.filter((item) => item !== 'all');
        });
      }
    },
    [columns, setStatusDropdownSelection]
  );

  const handleStatusSelectionDropdownSave = () => {
    setSelectedStatus(statusDropdownSelection);
    setIsStatusDropdownVisible(false);
  };

  const handleStatusSelectionDropdownCancel = () => {
    setStatusDropdownSelection(selectedStatus);
    setIsStatusDropdownVisible(false);
  };

  const toggleExpandAll = useCallback(async () => {
    setToggleExpandBtn((prev) => !prev);
    if (expandedRowKeys.length === expandableKeys.length) {
      // Collapse all - immediate UI update
      setExpandedRowKeys([]);
      fetchAllTerms();
    } else {
      fetchExpadedTree();
    }
  }, [
    glossaryTerms,
    glossaryChildTerms,
    setGlossaryChildTerms,
    loadingChildren,
    setLoadingChildren,
    expandedRowKeys,
    expandableKeys,
    setExpandedRowKeys,
    showErrorToast,
  ]);

  const isAllExpanded = useMemo(() => {
    return expandedRowKeys.length === expandableKeys.length;
  }, [expandedRowKeys, expandableKeys]);

  const statusDropdownMenu: MenuProps = useMemo(
    () => ({
      items: [
        {
          key: 'statusSelection',
          label: (
            <div className="status-selection-dropdown">
              <Checkbox.Group
                className="glossary-col-sel-checkbox-group"
                value={statusDropdownSelection}>
                {GLOSSARY_TERM_STATUS_OPTIONS.map((option) => (
                  <div key={option.value}>
                    <Checkbox
                      className="custom-glossary-col-sel-checkbox"
                      value={option.value}
                      onChange={(e) =>
                        handleCheckboxChange(option.value, e.target.checked)
                      }>
                      <p className="glossary-dropdown-label">{option.text}</p>
                    </Checkbox>
                  </div>
                ))}
              </Checkbox.Group>
            </div>
          ),
        },
        {
          key: 'divider',
          type: 'divider',
          className: 'm-b-xs',
        },
        {
          key: 'actions',
          label: (
            <div className="flex-center">
              <Space>
                <Button
                  className="custom-glossary-dropdown-action-btn"
                  type="primary"
                  onClick={handleStatusSelectionDropdownSave}>
                  {t('label.save')}
                </Button>
                <Button
                  className="custom-glossary-dropdown-action-btn"
                  type="default"
                  onClick={handleStatusSelectionDropdownCancel}>
                  {t('label.cancel')}
                </Button>
              </Space>
            </div>
          ),
        },
      ],
    }),
    [
      statusDropdownSelection,
      handleStatusSelectionDropdownSave,
      handleStatusSelectionDropdownCancel,
    ]
  );

  const handleEditGlossary = () => {
    navigate({
      pathname: getEntityBulkEditPath(
        EntityType.GLOSSARY_TERM,
        activeGlossary?.fullyQualifiedName ?? ''
      ),
    });
  };

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchInput(value);
      debouncedSetSearchTerm(value);
    },
    [debouncedSetSearchTerm]
  );

  const extraTableFilters = useMemo(() => {
    let expandCollapseLabel = '';

    if (isExpandingAll) {
      expandCollapseLabel = t('label.loading');
    } else if (isAllExpanded) {
      expandCollapseLabel = t('label.collapse-all');
    } else {
      expandCollapseLabel = t('label.expand-all');
    }

    return (
      <>
        <Input
          allowClear
          placeholder={t('label.search-entity', {
            entity: t('label.term-plural'),
          })}
          style={{ width: 250 }}
          value={searchInput}
          onChange={handleSearchChange}
        />

        <Dropdown
          className="custom-glossary-dropdown-menu status-dropdown"
          menu={statusDropdownMenu}
          open={isStatusDropdownVisible}
          trigger={['click']}
          onOpenChange={setIsStatusDropdownVisible}>
          <Button
            className="text-primary remove-button-background-hover"
            data-testid="glossary-status-dropdown"
            size="small"
            type="text">
            <Space>
              {t('label.status')}
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>

        {getBulkEditButton(permissions.EditAll, handleEditGlossary)}

        <Button
          className="text-primary remove-button-background-hover"
          data-testid="expand-collapse-all-button"
          disabled={isExpandingAll}
          size="small"
          type="text"
          onClick={toggleExpandAll}>
          <Space align="center" size={4}>
            {isExpandingAll ? (
              <Loader size="small" />
            ) : (
              <Icon
                className="text-primary"
                component={isAllExpanded ? DownUpArrowIcon : UpDownArrowIcon}
                height="14px"
              />
            )}
            {expandCollapseLabel}
          </Space>
        </Button>
      </>
    );
  }, [
    isAllExpanded,
    isExpandingAll,
    isStatusDropdownVisible,
    statusDropdownMenu,
    searchInput,
    toggleExpandAll,
  ]);

  const handleAddGlossaryTermClick = () => {
    onAddGlossaryTerm(
      isGlossary ? undefined : (activeGlossary as GlossaryTerm)
    );
  };

  const getRowClassName = useCallback(
    (record: ModifiedGlossaryTerm) => {
      const isNested = (record.level ?? 0) > 0;
      const isExpanded = expandedRowKeys.includes(
        record.fullyQualifiedName || ''
      );

      return isNested || isExpanded ? 'glossary-nested-row' : '';
    },
    [expandedRowKeys]
  );

  const expandableConfig: ExpandableConfig<ModifiedGlossaryTerm> = useMemo(
    () => ({
      expandIcon: ({ expanded, onExpand, record }) => {
        const isLoadMoreRow = record.isLoadMoreButton;

        if (isLoadMoreRow) {
          return <span className="expand-cell-empty-icon-container" />;
        }

        const { children, childrenCount } = record;
        const isLoading = loadingChildren[record.fullyQualifiedName || ''];

        return (childrenCount ?? children?.length ?? 0) > 0 ? (
          <>
            <IconDrag className="m-r-xs drag-icon" height={12} width={8} />
            {isLoading ? (
              <span className="m-r-xs expand-loader">
                <Loader size="x-small" />
              </span>
            ) : (
              <Icon
                className="m-r-xs vertical-baseline"
                component={expanded ? IconDown : IconRight}
                data-testid="expand-icon"
                style={{ fontSize: '10px', color: TEXT_BODY_COLOR }}
                onClick={(e) => onExpand(record, e)}
              />
            )}
          </>
        ) : (
          <>
            <IconDrag className="m-r-xs drag-icon" height={12} width={8} />
            <span className="expand-cell-empty-icon-container" />
          </>
        );
      },
      expandedRowKeys: expandedRowKeys,
      onExpand: async (expanded, record) => {
        if (expanded) {
          // Add to expanded keys immediately for responsive UI
          setExpandedRowKeys((prev) => [
            ...prev,
            record.fullyQualifiedName || '',
          ]);

          // Load children if needed
          if (
            (!record.children || record.children.length === 0) &&
            record.childrenCount &&
            record.childrenCount > 0
          ) {
            await fetchChildTerms(record.fullyQualifiedName || '');
          }

          return;
        }
        // Remove from expanded keys immediately
        const newExpandedKeys = expandedRowKeys.filter(
          (key) => key !== record.fullyQualifiedName
        );
        setExpandedRowKeys(newExpandedKeys);
      },
      rowExpandable: (record) => {
        const rec = record;
        const isLoadMoreRow = rec.isLoadMoreButton;

        return (
          !isLoadMoreRow &&
          ((rec.childrenCount ?? 0) > 0 || (rec.children?.length ?? 0) > 0)
        );
      },
    }),
    [
      glossaryTerms,
      setGlossaryChildTerms,
      expandedRowKeys,
      loadingChildren,
      fetchChildTerms,
      glossaryChildTerms,
    ]
  );

  const handleMoveRow = useCallback(
    async (dragRecord: GlossaryTerm, dropRecord?: GlossaryTerm) => {
      const dropRecordFqnPart =
        Fqn.split(dragRecord.fullyQualifiedName ?? '').length === 2;

      if (isUndefined(dropRecord) && dropRecordFqnPart) {
        return;
      }
      if (dragRecord.id === dropRecord?.id) {
        return;
      }

      setMovedGlossaryTerm({
        from: dragRecord,
        to: dropRecord,
      });
      setIsModalOpen(true);
    },
    []
  );

  const handleTableHover = (value: boolean) => setIsTableHovered(value);

  const handleChangeGlossaryTerm = async () => {
    if (movedGlossaryTerm) {
      setIsTableLoading(true);
      const newTermData = {
        ...movedGlossaryTerm.from,
        parent: isUndefined(movedGlossaryTerm.to)
          ? null
          : {
              fullyQualifiedName: movedGlossaryTerm.to.fullyQualifiedName,
            },
      };
      const jsonPatch = compare(movedGlossaryTerm.from, newTermData);

      try {
        await patchGlossaryTerm(movedGlossaryTerm.from?.id || '', jsonPatch);
        refreshGlossaryTerms?.();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsTableLoading(false);
        setIsModalOpen(false);
        setIsTableHovered(false);
      }
    }
  };

  const onTableRow: TableProps<ModifiedGlossaryTerm>['onRow'] = (
    record,
    index
  ) =>
    ({
      index,
      handleMoveRow,
      handleTableHover,
      record,
    } as DraggableBodyRowProps<GlossaryTerm>);

  const onTableHeader: TableProps<ModifiedGlossaryTerm>['onHeaderRow'] = () =>
    ({
      handleMoveRow,
      handleTableHover,
    } as DraggableBodyRowProps<GlossaryTerm>);

  const onDragConfirmationModalClose = useCallback(() => {
    setIsModalOpen(false);
    setIsTableHovered(false);
    setConfirmCheckboxChecked(false);
  }, []);

  const hasReviewers = useMemo(() => {
    return !isEmpty(activeGlossary.reviewers);
  }, [movedGlossaryTerm, activeGlossary]);

  const processTermsWithLoadMore = useCallback(
    (terms: ModifiedGlossaryTerm[], level = 0): ModifiedGlossaryTerm[] => {
      return terms.map((term) => {
        let processedTerm: ModifiedGlossaryTerm = { ...term, level };

        if (term.children && term.children.length > 0) {
          processedTerm = {
            ...processedTerm,
            children: processTermsWithLoadMore(term.children, level + 1),
          };
        }

        if (term.hasMoreChildren) {
          const loadMoreItem: ModifiedGlossaryTerm = {
            id: `${term.fullyQualifiedName}-load-more`,
            name: 'load-more-placeholder',
            fullyQualifiedName: `${term.fullyQualifiedName}-load-more`,
            description: '',
            displayName: '',
            entityStatus: term.entityStatus,
            isLoadMoreButton: true,
            parentRecord: term,
            level: level + 1,
          } as ModifiedGlossaryTerm;

          processedTerm = {
            ...processedTerm,
            children: [...(processedTerm.children ?? []), loadMoreItem],
          };
        }

        return processedTerm;
      });
    },
    []
  );

  const filteredGlossaryTerms = useMemo(() => {
    if (!Array.isArray(glossaryTerms)) {
      return [];
    }

    const filtered = glossaryTerms.filter((term) => {
      const matchesStatus = selectedStatus.includes(
        term.entityStatus as string
      );

      return matchesStatus;
    });

    return processTermsWithLoadMore(filtered);
  }, [glossaryTerms, selectedStatus, processTermsWithLoadMore]);

  useEffect(() => {
    if (!tableContainerRef.current) {
      return;
    }
    setContainerWidth(tableContainerRef.current.offsetWidth);
  }, []);

  // Trigger new fetch when search term changes
  useEffect(() => {
    if (
      activeGlossary &&
      previousGlossaryFQN === activeGlossary?.fullyQualifiedName
    ) {
      // Only fetch if we're on the same glossary (not switching glossaries)
      // Reset search pagination when search term changes
      if (searchTerm) {
        setSearchPaging({ offset: 0, total: undefined, hasMore: true });
      }
      fetchAllTerms();
    }
  }, [searchTerm]);

  // Check if this is due to search returning no results
  const isSearchActive = Boolean(searchTerm && searchTerm.trim().length > 0);
  const hasNoTerms = isEmpty(glossaryTerms);

  const glossaryPlaceholderText = useMemo(() => {
    if (isSearchActive && searchTerm) {
      return `No Glossary Term found for "${searchTerm}"`;
    }
    if (isSearchActive) {
      return 'No Glossary Term found';
    }

    return 'No Glossary Terms';
  }, [isSearchActive, searchTerm]);

  // Special case: if there are truly no terms in the glossary at all (not just search results)
  // and no search is active, show the full placeholder
  if (hasNoTerms && !isSearchActive && !isTableLoading) {
    return (
      <div className="h-full" ref={tableContainerRef}>
        <ErrorPlaceHolder
          className="p-md p-b-lg border-none"
          doc={GLOSSARIES_DOCS}
          heading={t('label.glossary-term')}
          permission={permissions.Create}
          permissionValue={t('label.create-entity', {
            entity: t('label.glossary-term'),
          })}
          placeholderText={t('message.no-glossary-term')}
          type={
            permissions.Create && glossaryTermStatus === EntityStatus.Approved
              ? ERROR_PLACEHOLDER_TYPE.CREATE
              : ERROR_PLACEHOLDER_TYPE.NO_DATA
          }
          onClick={handleAddGlossaryTermClick}
        />
      </div>
    );
  }

  return (
    <Row className={className} gutter={[0, 16]}>
      {/* Have use the col to set the width of the table, to only use the viewport width for the table columns */}
      <Col className="w-full" ref={tableContainerRef} span={24}>
        <div
          className="glossary-terms-scroll-container"
          style={{
            height: 'calc(100vh - 300px)',
            overflow: 'auto',
            position: 'relative',
          }}>
          {glossaryTerms.length > 0 ? (
            <>
              <Table
                resizableColumns
                className={classNames('drop-over-background', {
                  'drop-over-table': isTableHovered,
                })}
                columns={columns}
                components={TABLE_CONSTANTS}
                data-testid="glossary-terms-table"
                dataSource={filteredGlossaryTerms}
                defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
                expandable={expandableConfig}
                extraTableFilters={extraTableFilters}
                loading={isTableLoading || isExpandingAll}
                pagination={false}
                rowClassName={getRowClassName}
                rowKey="fullyQualifiedName"
                size="small"
                staticVisibleColumns={STATIC_VISIBLE_COLUMNS}
                onHeaderRow={onTableHeader}
                onRow={onTableRow}
              />
              {/* Show infinite scroll trigger if there are more results */}
              {((!searchTerm && paging.after !== undefined) ||
                (searchTerm && searchPaging.hasMore)) && (
                <div
                  className="m-t-md m-b-md text-center p-y-lg"
                  ref={infiniteScrollRef}
                  style={{ minHeight: '80px', background: 'transparent' }}>
                  {isLoadingMore && <Loader size="small" />}
                </div>
              )}
            </>
          ) : (
            // Show empty state within the table container when search returns no results
            // This keeps the search bar and filters visible
            <Table
              resizableColumns
              className="glossary-terms-table"
              columns={columns}
              components={TABLE_CONSTANTS}
              data-testid="glossary-terms-table"
              dataSource={[]}
              defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
              expandable={expandableConfig}
              extraTableFilters={extraTableFilters}
              loading={isTableLoading}
              locale={{
                emptyText: (
                  <ErrorPlaceHolder
                    className="p-md"
                    placeholderText={glossaryPlaceholderText}
                    type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
                  />
                ),
              }}
              pagination={false}
              rowClassName={getRowClassName}
              rowKey="fullyQualifiedName"
              size="small"
              staticVisibleColumns={STATIC_VISIBLE_COLUMNS}
              onHeaderRow={onTableHeader}
              onRow={onTableRow}
            />
          )}
        </div>
        <Modal
          centered
          destroyOnClose
          closable={false}
          confirmLoading={isTableLoading}
          data-testid="confirmation-modal"
          maskClosable={false}
          okButtonProps={{ disabled: hasReviewers && !confirmCheckboxChecked }}
          okText={t('label.move')}
          open={isModalOpen}
          title={
            <>
              <WarningOutlined className="m-r-xs warning-icon" />
              {t('label.move-the-entity', {
                entity: t('label.glossary-term'),
              })}
            </>
          }
          onCancel={onDragConfirmationModalClose}
          onOk={handleChangeGlossaryTerm}>
          <Transi18next
            i18nKey="message.entity-transfer-message"
            renderElement={<strong />}
            values={{
              from: movedGlossaryTerm?.from.name,
              to:
                movedGlossaryTerm?.to?.name ??
                (activeGlossary && getEntityName(activeGlossary)),
              entity: isUndefined(movedGlossaryTerm?.to)
                ? ''
                : t('label.term-lowercase'),
            }}
          />
          {hasReviewers && (
            <div className="m-t-md">
              <Checkbox
                checked={confirmCheckboxChecked}
                className="text-grey-700"
                data-testid="confirm-status-checkbox"
                onChange={(e) => setConfirmCheckboxChecked(e.target.checked)}>
                <span>
                  <Transi18next
                    i18nKey="message.entity-transfer-confirmation-message"
                    renderElement={<strong />}
                    values={{
                      from: movedGlossaryTerm?.from.name,
                    }}
                  />
                  <span className="d-inline-block m-l-xss">
                    <StatusBadge
                      className="p-x-xs p-y-xss"
                      dataTestId=""
                      label={EntityStatus.InReview}
                      status={EntityStatusClass[EntityStatus.InReview]}
                    />
                  </span>
                </span>
              </Checkbox>
            </div>
          )}
        </Modal>
      </Col>
    </Row>
  );
};

export default GlossaryTermTab;

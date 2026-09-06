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
  Button as CoreButton,
  EmptyPlaceholder,
  Input,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { File02, Plus } from '@untitledui/icons';
import {
  Button,
  Checkbox,
  Col,
  Dropdown,
  MenuProps,
  Modal,
  Popover,
  Row,
  Space,
  Tooltip,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { TFunction } from 'i18next';
import { debounce, isEmpty, isUndefined, uniqBy } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button as AriaButton,
  DropOperation,
  useDragAndDrop,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
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
import {
  DEFAULT_VISIBLE_COLUMNS,
  GLOSSARY_TERM_STATUS_OPTIONS,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS,
  STATIC_VISIBLE_COLUMNS,
} from '../../../constants/Glossary.contant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { CursorType } from '../../../enums/pagination.enum';
import { ResolveTask } from '../../../generated/api/feed/resolveTask';
import {
  EntityReference,
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { User } from '../../../generated/entity/teams/user';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getFirstLevelGlossaryTermsPaginated,
  getGlossaryTermChildrenLazy,
  getGlossaryTerms,
  patchGlossaryTerm,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import {
  listTasks,
  resolveTask as resolveTaskAPI,
  Task,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from '../../../rest/tasksAPI';
import { getBulkEditButton } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityBulkEditPath } from '../../../utils/EntityPureUtils';
import { EntityStatusClass } from '../../../utils/EntityStatusUtils';
import Fqn from '../../../utils/Fqn';
import {
  buildTree,
  glossaryTermTableColumnsWidth,
  permissionForApproveOrReject,
} from '../../../utils/GlossaryPureUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { ownerTableObject } from '../../../utils/TableColumn.util';
import { isTaskPendingFurtherApproval } from '../../../utils/TaskNavigationUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import Loader from '../../common/Loader/Loader';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import StatusAction from '../../common/StatusAction/StatusAction';
import {
  ColumnsType,
  ExpandableConfig,
} from '../../common/Table/Table.interface';
import Table from '../../common/Table/TableV2';
import TagButton from '../../common/TagButton/TagButton.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { ModifiedGlossary, useGlossaryStore } from '../useGlossary.store';
import {
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
  MoveGlossaryTermType,
} from './GlossaryTermTab.interface';
const WorkflowHistory = withSuspenseFallback(
  lazy(
    () => import('../GlossaryTerms/tabs/WorkFlowTab/WorkflowHistory.component')
  )
);

const GLOSSARY_TERM_DRAG_TYPE = 'application/x-om-glossary-term';

const GLOSSARY_TABLE_SCROLL = { x: 'max-content', y: 'calc(100vh - 350px)' };

const renderGlossaryExpandIcon = (
  {
    expanded,
    onExpand,
    record,
  }: Parameters<
    NonNullable<ExpandableConfig<ModifiedGlossaryTerm>['expandIcon']>
  >[0],
  loadingChildren: Record<string, boolean>,
  t: TFunction
) => {
  const isLoadMoreRow = record.isLoadMoreButton;

  if (isLoadMoreRow) {
    return (
      <>
        <AriaButton
          aria-label={t('label.move-the-entity', {
            entity: t('label.term-lowercase'),
          })}
          className="glossary-term-drag-handle-hidden"
          slot="drag">
          <span />
        </AriaButton>
        <span className="expand-cell-empty-icon-container" />
      </>
    );
  }

  const { children, childrenCount } = record;
  const isLoading = loadingChildren[record.fullyQualifiedName || ''];
  const dragHandle = (
    <AriaButton
      aria-label={t('label.move-the-entity', {
        entity: t('label.term-lowercase'),
      })}
      className="glossary-term-drag-handle m-r-xs"
      slot="drag">
      <IconDrag className="drag-icon" height={12} width={8} />
    </AriaButton>
  );

  const totalChildrenCount = childrenCount ?? children?.length ?? 0;

  return totalChildrenCount > 0 ? (
    <>
      {dragHandle}
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
      {dragHandle}
      <span className="expand-cell-empty-icon-container" />
    </>
  );
};

const GlossaryTermTab = ({ isGlossary, className }: GlossaryTermTabProps) => {
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const draggedGlossaryTermRef = useRef<GlossaryTerm>();
  const fetchRequestSeqRef = useRef(0);
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
    Record<string, Task[]>
  >({});

  const glossaryTerms = useMemo(() => {
    // Deduplicate by FQN: the table keys rows on fullyQualifiedName, and
    // duplicate keys make the underlying collection unrepresentable (it throws
    // "Invalid array length" while building rows). Guard here so no write path
    // can ever hand the table colliding keys.
    return uniqBy(
      Array.isArray(glossaryChildTerms)
        ? (glossaryChildTerms as ModifiedGlossaryTerm[])
        : [],
      'fullyQualifiedName'
    );
  }, [glossaryChildTerms]);

  // Precompute each term's loaded-descendant count once per data change (the
  // API's childrenCount is the whole subtree size, so this must be recursive).
  // The name column looks it up in O(1) rather than re-walking every subtree
  // on each render.
  const loadedNestedCountByFqn = useMemo(() => {
    const counts = new Map<string, number>();
    const walk = (term: ModifiedGlossaryTerm): number => {
      const children = (term.children ?? []) as ModifiedGlossaryTerm[];
      const count = children.reduce((sum, child) => sum + 1 + walk(child), 0);
      if (term.fullyQualifiedName) {
        counts.set(term.fullyQualifiedName, count);
      }

      return count;
    };
    glossaryTerms.forEach(walk);

    return counts;
  }, [glossaryTerms]);

  const [movedGlossaryTerm, setMovedGlossaryTerm] =
    useState<MoveGlossaryTermType>();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [isStatusDropdownVisible, setIsStatusDropdownVisible] =
    useState<boolean>(false);
  const [statusDropdownSelection, setStatusDropdownSelection] = useState<
    string[]
  >([EntityStatus.Approved, EntityStatus.Draft, EntityStatus.InReview]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([
    ...statusDropdownSelection,
  ]);
  const selectedStatusRef = useRef(selectedStatus);
  selectedStatusRef.current = selectedStatus;
  const [confirmCheckboxChecked, setConfirmCheckboxChecked] = useState(false);
  const [totalTermsCount, setTotalTermsCount] = useState<number>(0);

  const { paging, handlePagingChange, pageSize } = usePaging(PAGE_SIZE_LARGE);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingChildren, setLoadingChildren] = useState<
    Record<string, boolean>
  >({});

  const [previousGlossaryFQN, setPreviousGlossaryFQN] = useState<
    string | undefined
  >(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTermRef = useRef(searchTerm);
  searchTermRef.current = searchTerm;
  const [searchInput, setSearchInput] = useState('');
  const [isExpandingAll, setIsExpandingAll] = useState(false);
  const [isLoadingMoreTree, setIsLoadingMoreTree] = useState(false);
  const [expandTree, setExpandTree] = useState<{
    after?: string;
    loaded: number;
    total: number;
  }>({ loaded: 0, total: 0 });
  const expandedTreeFlatRef = useRef<GlossaryTerm[]>([]);
  const [isDraggingTerm, setIsDraggingTerm] = useState(false);
  const [isTopLevelDropActive, setIsTopLevelDropActive] = useState(false);
  const [toggleExpandBtn, setToggleExpandBtn] = useState(false);

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

  const fetchAllTerms = async (options?: {
    after?: string;
    before?: string;
    offset?: number;
  }) => {
    // `fetchSearchTerm` / `fetchStatusKey` record the search and status filter
    // this request was issued for so its response can be discarded if either has
    // since changed. `requestSeq` tracks the most recent fetch so only the
    // latest one clears the loading indicator, avoiding flicker when requests
    // overlap.
    const requestSeq = ++fetchRequestSeqRef.current;
    const fetchSearchTerm = searchTerm;
    const fetchStatusKey = selectedStatus.join(',');
    setIsTableLoading(true);

    try {
      let data;
      let pagingResponse: Paging | undefined;

      const isStatusFilterActive = !selectedStatus.includes('all');
      const entityStatusParam = isStatusFilterActive
        ? selectedStatus.filter((s) => s !== 'all').join(',')
        : undefined;

      // Search uses offset-based paging; the first-level listing uses cursor
      // (before/after) paging. Either way the response replaces the current
      // page of rows — navigation is now explicit Previous/Next, not appending.
      if (searchTerm) {
        const response = await searchGlossaryTermsPaginated({
          q: searchTerm,
          glossaryFqn: activeGlossary?.fullyQualifiedName,
          // limit must match the pageSize used to compute the offset, else
          // Previous/Next would skip or repeat results if pageSize changes.
          limit: pageSize,
          offset: options?.offset ?? 0,
          fields:
            'children,relatedTerms,reviewers,owners,tags,usageCount,domains,extension,childrenCount',
          entityStatus: entityStatusParam,
        });
        data = response.data;
        pagingResponse = response.paging;
      } else {
        const response = await getFirstLevelGlossaryTermsPaginated(
          activeGlossary?.fullyQualifiedName || '',
          pageSize,
          options?.after,
          entityStatusParam,
          options?.before
        );
        data = response.data;
        pagingResponse = response.paging;
      }

      // Apply the response only when it still matches the active search context.
      // A response computed for a different (now-outdated) search term or status
      // filter — e.g. a listing request in flight when the user typed a query —
      // is discarded so it cannot repopulate or clear the table against the
      // user's current intent.
      if (
        !data ||
        !Array.isArray(data) ||
        fetchSearchTerm !== searchTermRef.current ||
        fetchStatusKey !== selectedStatusRef.current.join(',')
      ) {
        return;
      }

      if (data.length === 0 && isStatusFilterActive) {
        const countResponse = await getFirstLevelGlossaryTermsPaginated(
          activeGlossary?.fullyQualifiedName || '',
          0
        );
        setTotalTermsCount(countResponse.paging?.total ?? 0);
      } else {
        setTotalTermsCount(pagingResponse?.total ?? data.length);
      }

      // Search mode has no cursor; clear before/after so the footer falls back
      // to number-based (offset) paging driven by currentPage + total.
      handlePagingChange((prev) => ({
        ...prev,
        after: searchTerm ? undefined : pagingResponse?.after,
        before: searchTerm ? undefined : pagingResponse?.before,
        total: pagingResponse?.total ?? prev.total,
      }));

      setGlossaryChildTerms(data as ModifiedGlossary[]);
      // A freshly loaded page starts with every row collapsed.
      setExpandedRowKeys([]);
    } catch (error) {
      if (requestSeq === fetchRequestSeqRef.current) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (requestSeq === fetchRequestSeqRef.current) {
        setIsTableLoading(false);
      }
    }
  };

  const fetchExpadedTree = async (loadMore = false) => {
    if (loadMore) {
      setIsLoadingMoreTree(true);
    } else {
      setIsTableLoading(true);
      setIsExpandingAll(true);
      expandedTreeFlatRef.current = [];
    }

    try {
      const key = isGlossary ? 'glossary' : 'parent';
      const { data, paging } = await getGlossaryTerms({
        [key]: activeGlossary?.id || '',
        limit: PAGE_SIZE_LARGE,
        after: loadMore ? expandTree.after : undefined,
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.PARENT,
          TabSpecificField.CHILDREN,
          TabSpecificField.CHILDREN_COUNT,
        ],
      });

      // Accumulate the flat term list across pages and rebuild the tree from
      // it; nesting fills in progressively as parents/children load.
      const mergedFlat = uniqBy(
        [...expandedTreeFlatRef.current, ...data],
        'fullyQualifiedName'
      );
      expandedTreeFlatRef.current = mergedFlat;

      setGlossaryChildTerms(
        buildTree(
          mergedFlat,
          activeGlossary?.fullyQualifiedName
        ) as ModifiedGlossary[]
      );

      const keys = mergedFlat.reduce((prev, curr) => {
        if (curr.children?.length) {
          prev.push(curr.fullyQualifiedName ?? '');
        }

        return prev;
      }, [] as string[]);
      setExpandedRowKeys(keys);

      setExpandTree({
        after: paging?.after,
        loaded: mergedFlat.length,
        total: paging?.total ?? mergedFlat.length,
      });
      // Keep the pager showing a single, non-navigable page while expanded.
      setCurrentPage(1);
      handlePagingChange((prev) => ({
        ...prev,
        after: undefined,
        before: undefined,
        total: 0,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTableLoading(false);
      setIsExpandingAll(false);
      setIsLoadingMoreTree(false);
    }
  };
  const fetchAllTasks = useCallback(async () => {
    if (!activeGlossary?.fullyQualifiedName) {
      return;
    }

    try {
      const { data } = await listTasks({
        status: TaskEntityStatus.Open,
        category: TaskCategory.Approval,
        type: TaskEntityType.RequestApproval,
        limit: API_RES_MAX_SIZE,
        fields: 'about,assignees',
      });

      // Glossary approvals are now workflow-managed RequestApproval tasks created
      // for each glossary term, not legacy glossary-root tasks.
      const tasksByTerm = data.reduce(
        (acc: Record<string, Task[]>, task: Task) => {
          const termFQN = task.about?.fullyQualifiedName;
          const isGlossaryTermTask =
            task.about?.type === EntityType.GLOSSARY_TERM &&
            termFQN?.startsWith(`${activeGlossary.fullyQualifiedName}.`);

          if (isGlossaryTermTask && termFQN) {
            const entityLink = `<#E::${EntityType.GLOSSARY_TERM}::${termFQN}>`;
            if (!acc[entityLink]) {
              acc[entityLink] = [];
            }
            acc[entityLink].push(task);
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
      currentFQN !== previousGlossaryFQN &&
      !toggleExpandBtn &&
      !searchTerm // Don't fetch if there's an active search
    ) {
      // Clear existing terms when switching glossaries
      setGlossaryChildTerms([]);
      handlePagingChange((prev) => ({
        ...prev,
        after: undefined,
        before: undefined,
      }));
      setCurrentPage(1);
      setPreviousGlossaryFQN(currentFQN);
      fetchAllTerms();
    }
  }, [
    activeGlossary?.fullyQualifiedName,
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

  const glossaryTermStatus: EntityStatus | null = useMemo(() => {
    if (!isGlossary) {
      return (
        (activeGlossary as GlossaryTerm).entityStatus ?? EntityStatus.Approved
      );
    }

    return null;
  }, [isGlossary, activeGlossary]);

  const tableColumnsWidth = useMemo(() => glossaryTermTableColumnsWidth(), []);

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

  const updateGlossaryTermTask = (
    tasks: Record<string, Task[]>,
    entityLink: string,
    updatedTask: Task
  ) => {
    const existingTasks = tasks[entityLink] ?? [];

    return {
      ...tasks,
      [entityLink]: existingTasks.map((task) =>
        task.id === updatedTask.id ? updatedTask : task
      ),
    };
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

        const resolutionType =
          data.newValue === 'approved'
            ? TaskResolutionType.Approved
            : TaskResolutionType.Rejected;

        const updatedTask = await resolveTaskAPI(taskId + '', {
          resolutionType,
          newValue: data.newValue,
        });
        const isPendingFurtherApproval =
          isTaskPendingFurtherApproval(updatedTask);

        showSuccessToast(
          isPendingFurtherApproval
            ? 'Vote recorded.'
            : t('server.task-resolved-successfully')
        );

        const currentExpandedKeys = [...expandedRowKeys];
        setExpandedRowKeys(currentExpandedKeys);

        if (glossaryChildTerms && glossaryTermFqn) {
          const entityLink = `<#E::${EntityType.GLOSSARY_TERM}::${glossaryTermFqn}>`;
          if (isPendingFurtherApproval) {
            if (termTaskThreads[entityLink]) {
              setTermTaskThreads(
                updateGlossaryTermTask(termTaskThreads, entityLink, updatedTask)
              );
            }

            return;
          }

          const newStatus =
            data.newValue === 'approved'
              ? EntityStatus.Approved
              : EntityStatus.Rejected;

          const updatedTerms = updateGlossaryTermStatus(
            glossaryChildTerms,
            glossaryTermFqn,
            newStatus
          );

          if (
            !selectedStatus.includes('all') &&
            !selectedStatus.includes(newStatus)
          ) {
            setGlossaryChildTerms(
              updatedTerms.filter(
                (term) => term.fullyQualifiedName !== glossaryTermFqn
              )
            );
          } else {
            setGlossaryChildTerms(updatedTerms);
          }

          if (termTaskThreads[entityLink]) {
            const updatedThreads = { ...termTaskThreads };
            updatedThreads[entityLink] = updatedThreads[entityLink].filter(
              (task) => !(task.id && task.id.toString() === taskId)
            );

            setTermTaskThreads(updatedThreads);
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [expandedRowKeys, glossaryChildTerms, selectedStatus, termTaskThreads]
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
          const totalNested = record.childrenCount ?? 0;
          const loadedNested =
            loadedNestedCountByFqn.get(record.fullyQualifiedName ?? '') ?? 0;
          // Collapsed shows the total ("N terms"); expanded shows load
          // progress ("x of y loaded", reaching "y of y loaded" once done).
          const isRowExpanded = expandedRowKeys.includes(
            record.fullyQualifiedName ?? ''
          );
          const termCountKey =
            totalNested === 1 ? 'label.count-term' : 'label.count-term-plural';

          return (
            <div className="tw:flex tw:min-w-0 tw:items-center">
              {record.style?.iconURL && (
                <img
                  alt={record.name}
                  className="m-r-xss"
                  data-testid="tag-icon"
                  height={12}
                  src={record.style.iconURL}
                />
              )}
              <Link
                className="cursor-pointer tw:inline-block tw:max-w-50 tw:truncate"
                data-testid={name}
                style={{ color: record.style?.color }}
                title={name}
                to={getGlossaryPath(record.fullyQualifiedName ?? record.name)}>
                {name}
              </Link>
              {totalNested > 0 && (
                <span
                  className="tw:ml-2 tw:shrink-0 tw:whitespace-nowrap tw:text-xs tw:text-tertiary"
                  data-testid="nested-term-count">
                  {isRowExpanded
                    ? t('label.count-of-total-loaded', {
                        count: loadedNested,
                        total: totalNested,
                      })
                    : t(termCountKey, { count: totalNested })}
                </span>
              )}
            </div>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.DESCRIPTION,
        render: (description: string, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return (
            <div
              style={{
                maxWidth: tableColumnsWidth.descriptionMax,
                minWidth: tableColumnsWidth.descriptionMin,
              }}>
              {description?.trim() ? (
                <RichTextEditorPreviewerNew
                  clampByLines
                  enableSeeMoreVariant
                  markdown={description}
                />
              ) : (
                <Typography color="secondary">
                  {t('label.no-description')}
                </Typography>
              )}
            </div>
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
        width: 120,
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
    expandedRowKeys,
    loadedNestedCountByFqn,
  ]);

  const handleCheckboxChange = useCallback(
    (key: string, checked: boolean) => {
      const optionsToUse = GLOSSARY_TERM_STATUS_OPTIONS;

      if (key === 'all') {
        if (checked) {
          setStatusDropdownSelection([
            'all',
            ...optionsToUse.map((option) => option.value),
          ]);
        } else {
          setStatusDropdownSelection([]);
        }
      } else {
        setStatusDropdownSelection((prev: string[]) => {
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
    [setStatusDropdownSelection]
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
    // Drive the action off the expand-all mode flag, not a row-count equality:
    // a partially loaded tree (only the first page of nested terms) never has
    // every expandable row expanded, so a row-count check would wrongly treat
    // a second click as another expand and reset the accumulated pages.
    if (toggleExpandBtn) {
      // Collapse all - reload the first page of top-level terms and clear the
      // accumulated expand-all tree state so a later expand starts clean.
      setToggleExpandBtn(false);
      setExpandedRowKeys([]);
      setCurrentPage(1);
      setExpandTree({ loaded: 0, total: 0 });
      expandedTreeFlatRef.current = [];
      handlePagingChange((prev) => ({
        ...prev,
        after: undefined,
        before: undefined,
      }));
      fetchAllTerms();
    } else {
      // Enter expand-all mode explicitly so the "load more" bar stays visible
      // through subsequent renders (e.g. after a manual row collapse).
      setToggleExpandBtn(true);
      fetchExpadedTree();
    }
  }, [toggleExpandBtn, fetchAllTerms, fetchExpadedTree, handlePagingChange]);

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
                      data-testid={`glossary-status-option-${option.value}`}
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
                  data-testid="glossary-status-save-btn"
                  type="primary"
                  onClick={handleStatusSelectionDropdownSave}>
                  {t('label.save')}
                </Button>
                <Button
                  className="custom-glossary-dropdown-action-btn"
                  data-testid="glossary-status-cancel-btn"
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
        isGlossary ? EntityType.GLOSSARY : EntityType.GLOSSARY_TERM,
        activeGlossary?.fullyQualifiedName ?? ''
      ),
    });
  };

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      debouncedSetSearchTerm(value);
    },
    [debouncedSetSearchTerm]
  );

  const extraTableFilters = useMemo(() => {
    let expandCollapseLabel = '';

    if (isExpandingAll) {
      expandCollapseLabel = t('label.loading');
    } else if (toggleExpandBtn) {
      expandCollapseLabel = t('label.collapse-all');
    } else {
      expandCollapseLabel = t('label.expand-all');
    }

    return (
      <>
        <Input
          className="tw:mr-auto tw:w-80"
          inputDataTestId="search-glossary-terms-input"
          placeholder={t('label.search-entity', {
            entity: t('label.term-plural'),
          })}
          size="sm"
          value={searchInput}
          onChange={handleSearchChange}
        />

        <div className="d-flex items-center gap-5 flex-shrink">
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
                  component={
                    toggleExpandBtn ? DownUpArrowIcon : UpDownArrowIcon
                  }
                  height="14px"
                />
              )}
              {expandCollapseLabel}
            </Space>
          </Button>
        </div>
      </>
    );
  }, [
    toggleExpandBtn,
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
      const rowClasses: string[] = [];

      if (!record.isLoadMoreButton) {
        rowClasses.push('glossary-term-draggable-row');
      }
      if (isNested || isExpanded) {
        rowClasses.push('glossary-nested-row');
      }

      return rowClasses.join(' ');
    },
    [expandedRowKeys]
  );

  const expandableConfig: ExpandableConfig<ModifiedGlossaryTerm> = useMemo(
    () => ({
      expandIcon: (props) =>
        renderGlossaryExpandIcon(props, loadingChildren, t),
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
        const hasChildren =
          (rec.childrenCount ?? 0) > 0 || (rec.children?.length ?? 0) > 0;

        return !isLoadMoreRow && hasChildren;
      },
    }),
    [
      glossaryTerms,
      setGlossaryChildTerms,
      expandedRowKeys,
      loadingChildren,
      fetchChildTerms,
      glossaryChildTerms,
      t,
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

  const moveDraggedGlossaryTermToRoot = useCallback(() => {
    const dragRecord = draggedGlossaryTermRef.current;
    draggedGlossaryTermRef.current = undefined;

    if (dragRecord) {
      handleMoveRow(dragRecord);
    }
  }, [handleMoveRow]);

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
      }
    }
  };

  const onDragConfirmationModalClose = useCallback(() => {
    setIsModalOpen(false);
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

    return processTermsWithLoadMore(glossaryTerms);
  }, [glossaryTerms, processTermsWithLoadMore]);

  const glossaryTermByFqn = useMemo(() => {
    const termByFqn = new Map<string, ModifiedGlossaryTerm>();
    const walk = (terms: ModifiedGlossaryTerm[]) => {
      terms.forEach((term) => {
        if (term.fullyQualifiedName) {
          termByFqn.set(term.fullyQualifiedName, term);
        }
        if (term.children?.length) {
          walk(term.children as ModifiedGlossaryTerm[]);
        }
      });
    };
    walk(filteredGlossaryTerms);

    return termByFqn;
  }, [filteredGlossaryTerms]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => {
      const key = Array.from(keys)[0];
      const record = key ? glossaryTermByFqn.get(String(key)) : undefined;

      if (!record || record.isLoadMoreButton) {
        return [];
      }

      return [{ [GLOSSARY_TERM_DRAG_TYPE]: record.fullyQualifiedName ?? '' }];
    },
    acceptedDragTypes: [GLOSSARY_TERM_DRAG_TYPE],
    onDragStart: (event) => {
      const key = Array.from(event.keys)[0];
      const record = key ? glossaryTermByFqn.get(String(key)) : undefined;

      if (!record || record.isLoadMoreButton) {
        draggedGlossaryTermRef.current = undefined;

        return;
      }

      draggedGlossaryTermRef.current = record as GlossaryTerm;
      setIsDraggingTerm(true);
    },
    onDragEnd: () => {
      draggedGlossaryTermRef.current = undefined;
      setIsDraggingTerm(false);
      setIsTopLevelDropActive(false);
    },
    getDropOperation: (target, types) => {
      let operation: DropOperation = 'move';

      if (!types.has(GLOSSARY_TERM_DRAG_TYPE)) {
        operation = 'cancel';
      } else if (target.type === 'item') {
        const record = glossaryTermByFqn.get(String(target.key));
        const isReparentTarget =
          target.dropPosition === 'on' && !!record && !record.isLoadMoreButton;
        operation = isReparentTarget ? 'move' : 'cancel';
      }

      return operation;
    },
    onItemDrop: (event) => {
      const dragRecord = draggedGlossaryTermRef.current;
      draggedGlossaryTermRef.current = undefined;
      const targetRecord = glossaryTermByFqn.get(String(event.target.key));

      if (dragRecord && targetRecord && !targetRecord.isLoadMoreButton) {
        handleMoveRow(dragRecord, targetRecord as GlossaryTerm);
      }
    },
    onRootDrop: () => {
      moveDraggedGlossaryTermToRoot();
    },
  });

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;

    if (!isDraggingTerm || !scrollEl) {
      return;
    }

    const targets = [
      scrollEl.querySelector('thead'),
      scrollEl.querySelector('[data-testid="table-toolbar"]'),
    ].filter((el): el is HTMLElement => el instanceof HTMLElement);

    const isAlreadyTopLevel = () => {
      const term = draggedGlossaryTermRef.current;

      return !!term && Fqn.split(term.fullyQualifiedName ?? '').length === 2;
    };

    const isRowDropTargetActive = () =>
      !!scrollEl.querySelector('tr[data-drop-target]');

    const onDragOver = (event: DragEvent) => {
      if (isAlreadyTopLevel()) {
        return;
      }

      if (isRowDropTargetActive()) {
        setIsTopLevelDropActive(false);

        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }

      setIsTopLevelDropActive(true);
    };

    const onDragLeave = (event: DragEvent) => {
      const element = event.currentTarget as HTMLElement;

      if (!element.contains(event.relatedTarget as Node | null)) {
        setIsTopLevelDropActive(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      if (isRowDropTargetActive()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIsTopLevelDropActive(false);
      moveDraggedGlossaryTermToRoot();
    };

    targets.forEach((element) => {
      element.addEventListener('dragover', onDragOver);
      element.addEventListener('dragleave', onDragLeave);
      element.addEventListener('drop', onDrop);
    });

    return () => {
      targets.forEach((element) => {
        element.removeEventListener('dragover', onDragOver);
        element.removeEventListener('dragleave', onDragLeave);
        element.removeEventListener('drop', onDrop);
      });
    };
  }, [isDraggingTerm, moveDraggedGlossaryTermToRoot]);

  // Trigger new fetch when search term or status filter changes. Both reset
  // pagination back to the first page.
  useEffect(() => {
    if (
      activeGlossary &&
      previousGlossaryFQN === activeGlossary?.fullyQualifiedName
    ) {
      setCurrentPage(1);
      handlePagingChange((prev) => ({
        ...prev,
        after: undefined,
        before: undefined,
      }));
      fetchAllTerms();
    }
  }, [searchTerm, selectedStatus]);

  // Check if this is due to search or filter returning no results
  const isSearchActive = Boolean(searchTerm && searchTerm.trim().length > 0);
  const isStatusFilterActive = !selectedStatus.includes('all');
  const hasNoTerms = isEmpty(glossaryTerms);

  const showPagination = glossaryTerms.length > 0;
  // In expand-all mode, offer a "load more" affordance instead of page
  // navigation: the tree is fetched a page of nested terms at a time.
  const showExpandTreeLoadMore = toggleExpandBtn && Boolean(expandTree.after);

  const handleExpandTreeLoadMore = () => {
    if (expandTree.after) {
      fetchExpadedTree(true);
    }
  };

  const handleGlossaryTermPageChange = ({
    currentPage: nextPage,
    cursorType,
  }: PagingHandlerParams) => {
    setCurrentPage(nextPage);

    // Search results are offset-paged; the listing is cursor-paged.
    if (isSearchActive) {
      fetchAllTerms({ offset: (nextPage - 1) * pageSize });

      return;
    }

    const cursor =
      cursorType === CursorType.BEFORE ? paging.before : paging.after;
    fetchAllTerms(
      cursorType === CursorType.BEFORE ? { before: cursor } : { after: cursor }
    );
  };

  const glossaryPlaceholderText = useMemo(() => {
    if (isSearchActive && searchTerm) {
      return `No Glossary Term found for "${searchTerm}"`;
    }
    if (isSearchActive || isStatusFilterActive) {
      return 'No Glossary Term found';
    }

    return 'No Glossary Terms';
  }, [isSearchActive, isStatusFilterActive, searchTerm]);

  if (
    hasNoTerms &&
    !isSearchActive &&
    totalTermsCount === 0 &&
    !isTableLoading
  ) {
    // A top-level glossary always allows adding terms; for a glossary term,
    // sub-terms can only be added once the parent term is approved.
    const canCreateTerm =
      permissions.Create &&
      (isGlossary || glossaryTermStatus === EntityStatus.Approved);

    return (
      <div
        className="tw:relative tw:flex tw:items-center tw:justify-center glossary-terms-empty-container"
        ref={tableContainerRef}>
        <EmptyPlaceholder
          data-testid={`create-error-placeholder-${t('label.glossary-term')}`}
          description={t('message.glossary-term-empty-description')}
          footer={
            canCreateTerm ? (
              <CoreButton
                color="primary"
                data-testid="add-placeholder-button"
                iconLeading={Plus}
                size="sm"
                onPress={handleAddGlossaryTermClick}>
                {t('label.new-term')}
              </CoreButton>
            ) : undefined
          }
          icon={<File02 className="tw:text-fg-warning-primary" />}
          title={t('message.add-the-first-term')}
          variant="blank"
        />
      </div>
    );
  }

  return (
    <Row className={className} gutter={[0, 16]}>
      {/* Have use the col to set the width of the table, to only use the viewport width for the table columns */}
      <Col className="w-full" ref={tableContainerRef} span={24}>
        <div
          className={classNames(
            'glossary-terms-scroll-container tw:flex tw:flex-col',
            {
              'glossary-terms-scroll-container-drop-target':
                isTopLevelDropActive,
            }
          )}
          data-testid="glossary-terms-scroll-container"
          ref={scrollContainerRef}
          style={{ position: 'relative' }}>
          {glossaryTerms.length > 0 ? (
            <TableCard.Root
              className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:border tw:border-secondary tw:outline-0"
              size="sm">
              <Table
                cellClassName="tw:p-2 tw:align-middle"
                columns={columns}
                containerClassName="glossary-terms-table drop-over-background tw:!border-0 tw:!rounded-none tw:min-h-0 tw:flex-1 tw:!overflow-auto"
                data-testid="glossary-terms-table"
                dataSource={filteredGlossaryTerms}
                defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
                dragAndDropHooks={dragAndDropHooks}
                expandable={expandableConfig}
                extraTableFilters={extraTableFilters}
                loading={isTableLoading || isExpandingAll}
                pagination={false}
                rowClassName={getRowClassName}
                rowKey="fullyQualifiedName"
                scroll={GLOSSARY_TABLE_SCROLL}
                size="small"
                staticVisibleColumns={STATIC_VISIBLE_COLUMNS}
              />
              {showExpandTreeLoadMore && (
                <div
                  className="tw:flex tw:shrink-0 tw:items-center tw:gap-4 tw:border-t tw:border-secondary tw:bg-secondary tw:px-4 tw:py-3"
                  data-testid="expand-tree-load-more">
                  <CoreButton
                    color="secondary"
                    data-testid="expand-tree-load-more-button"
                    isDisabled={isLoadingMoreTree}
                    isLoading={isLoadingMoreTree}
                    size="sm"
                    onPress={handleExpandTreeLoadMore}>
                    {t('label.load-more')}
                  </CoreButton>
                  <span className="tw:text-sm tw:text-tertiary">
                    {t('label.showing-count-of-total-nested-terms', {
                      current: expandTree.loaded,
                      total: expandTree.total,
                    })}
                  </span>
                </div>
              )}
              {showPagination && (
                <div className="tw:shrink-0 tw:border-t tw:border-secondary tw:py-4">
                  <NextPrevious
                    currentPage={currentPage}
                    isLoading={isTableLoading}
                    isNumberBased={isSearchActive}
                    pageSize={pageSize}
                    paging={paging}
                    pagingHandler={handleGlossaryTermPageChange}
                  />
                </div>
              )}
            </TableCard.Root>
          ) : (
            // Show empty state within the table container when search returns no results
            // This keeps the search bar and filters visible
            <TableCard.Root
              className="tw:border tw:border-secondary tw:outline-0"
              size="sm">
              <Table
                columns={columns}
                containerClassName="glossary-terms-table tw:!border-0 tw:!rounded-none"
                data-testid="glossary-terms-table"
                dataSource={[]}
                defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
                dragAndDropHooks={dragAndDropHooks}
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
                scroll={GLOSSARY_TABLE_SCROLL}
                size="small"
                staticVisibleColumns={STATIC_VISIBLE_COLUMNS}
              />
            </TableCard.Root>
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

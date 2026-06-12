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
import { Switch, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { Container } from '../../../generated/entity/data/container';
import { Include } from '../../../generated/type/include';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { getContainerChildrenByName } from '../../../rest/storageAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getColumnSorter } from '../../../utils/EntitySortUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { descriptionTableObject } from '../../../utils/TableColumn.util';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ContainerChildrenProps } from './ContainerChildren.interface';
import { useContainerChildrenCountSetter } from './ContainerChildrenCountContext';

// Row shape rendered by the children table: every field used by the columns
// (id, name, displayName, fullyQualifiedName, description) is structurally
// satisfied by both the slim Container summaries returned by the /children
// endpoint and the EntityReference[] the customize-page widget preview feeds
// in via the parent Container's `children`. Picking this minimum keeps both
// inputs strongly typed without an unchecked cast and without forcing the
// preview path to mint synthetic Containers (which would need `service`, etc).
type ContainerChildRow = {
  id: string;
  name?: string;
  displayName?: string;
  fullyQualifiedName?: string;
  description?: string;
};

const ContainerChildren: FC<ContainerChildrenProps> = ({ isReadOnly }) => {
  const onChildrenCountChange = useContainerChildrenCountSetter();
  const { t } = useTranslation();
  const {
    paging,
    pageSize,
    currentPage,
    showPagination,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
  } = usePaging();
  const { data: container } = useGenericContext<Container>();
  const { fqn: decodedContainerName } = useFqn();
  const [isChildrenLoading, setIsChildrenLoading] = useState(false);
  const [containerChildrenData, setContainerChildrenData] = useState<
    ContainerChildRow[]
  >([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const columns: ColumnsType<ContainerChildRow> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: 400,
        key: 'name',
        sorter: getColumnSorter<ContainerChildRow, 'name'>('name'),
        render: (_, record) => (
          <div className="d-inline-flex w-max-90">
            <Link
              className="break-word"
              data-testid="container-name"
              to={getEntityDetailsPath(
                EntityType.CONTAINER,
                record.fullyQualifiedName ?? ''
              )}>
              {getEntityName(record)}
            </Link>
          </div>
        ),
      },
      ...descriptionTableObject<ContainerChildRow>(),
    ],
    [t]
  );

  // Stale-response guard: every fetch issued from this component bumps a
  // monotonically-increasing token, and only the response whose token still
  // matches the latest one allowed to write to state. Keying on the parent FQN
  // alone (the previous approach) caught navigation-between-containers but not
  // overlapping fetches against the SAME container — which happen routinely
  // when the user types into the search box (debounced 500ms) or flips the
  // Deleted toggle while a slower request is still in-flight. Without this,
  // an older response can overwrite a newer one's filtered result set.
  const fetchTokenRef = useRef(0);

  const fetchContainerChildren = useCallback(
    async (pagingOffset?: number) => {
      const fetchFqn = decodedContainerName;
      const token = ++fetchTokenRef.current;
      setIsChildrenLoading(true);
      try {
        const trimmedQuery = searchValue.trim();
        const { data, paging } = await getContainerChildrenByName(fetchFqn, {
          limit: pageSize,
          offset: pagingOffset ?? 0,
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
          ...(trimmedQuery ? { q: trimmedQuery } : {}),
        });
        if (fetchTokenRef.current !== token) {
          return;
        }
        setContainerChildrenData(data ?? []);
        handlePagingChange(paging);
        onChildrenCountChange?.(paging.total);
      } catch (error) {
        if (fetchTokenRef.current === token) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (fetchTokenRef.current === token) {
          setIsChildrenLoading(false);
        }
      }
    },
    [
      decodedContainerName,
      pageSize,
      handlePagingChange,
      onChildrenCountChange,
      showDeleted,
      searchValue,
    ]
  );

  const handleChildrenPageChange = (data: PagingHandlerParams) => {
    handlePageChange(data.currentPage);
    fetchContainerChildren((data.currentPage - 1) * pageSize);
  };

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      handlePageChange(INITIAL_PAGING_VALUE);
    },
    [handlePageChange]
  );

  const handleShowDeletedChange = useCallback(
    (checked: boolean) => {
      setShowDeleted(checked);
      handlePageChange(INITIAL_PAGING_VALUE);
    },
    [handlePageChange]
  );

  // Clear filters when navigating between containers. Without this, filters
  // set on the previous container (a search query, a Deleted toggle that was
  // ON) silently carry over to the next container's listing — making the new
  // page look empty even though it has children, and there's no URL state to
  // reflect that a filter is active. Reset before the fetch so the next
  // useEffect sees the cleared values and queries the unfiltered page.
  useEffect(() => {
    setSearchValue('');
    setShowDeleted(false);
  }, [decodedContainerName]);

  useEffect(() => {
    if (isReadOnly) {
      return;
    }
    fetchContainerChildren();
  }, [pageSize, isReadOnly, decodedContainerName, fetchContainerChildren]);

  useEffect(() => {
    if (!isReadOnly) {
      return;
    }
    // Read-only mode is used by the customize-page widget preview, which feeds
    // synthetic data via the parent Container's `children` (an EntityReference[]).
    // Both Container and EntityReference are structurally assignable to
    // ContainerChildRow, so no cast is needed.
    const children = container?.children ?? [];
    setContainerChildrenData(children);
    onChildrenCountChange?.(children.length);
  }, [isReadOnly, container?.children, onChildrenCountChange]);

  const searchProps = useMemo(
    () => ({
      placeholder: t('label.search-for-type', {
        type: t('label.container-plural'),
      }),
      typingInterval: 500,
      searchValue,
      onSearch: handleSearchChange,
    }),
    [handleSearchChange, searchValue, t]
  );

  return (
    <Table
      columns={columns}
      customPaginationProps={{
        currentPage,
        isNumberBased: true,
        isLoading: isChildrenLoading,
        pageSize,
        paging,
        pagingHandler: handleChildrenPageChange,
        onShowSizeChange: handlePageSizeChange,
        showPagination,
      }}
      data-testid="container-list-table"
      dataSource={containerChildrenData}
      extraTableFilters={
        !isReadOnly && (
          <span>
            <Switch
              checked={showDeleted}
              data-testid="show-deleted"
              onClick={handleShowDeletedChange}
            />
            <Typography.Text className="m-l-xs">
              {t('label.deleted')}
            </Typography.Text>
          </span>
        )
      }
      loading={isChildrenLoading}
      locale={{
        emptyText: <ErrorPlaceHolder className="p-y-md" />,
      }}
      pagination={false}
      rowKey="id"
      searchProps={isReadOnly ? undefined : searchProps}
      size="small"
    />
  );
};

export default ContainerChildren;

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
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { Container } from '../../../generated/entity/data/container';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { getContainerChildrenByName } from '../../../rest/storageAPI';
import { getColumnSorter, getEntityName } from '../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { descriptionTableObject } from '../../../utils/TableColumn.util';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ContainerChildrenProps } from './ContainerChildren.interface';
import { useContainerChildrenCountSetter } from './ContainerChildrenCountContext';

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
    Container[]
  >([]);

  const columns: ColumnsType<Container> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: 400,
        key: 'name',
        sorter: getColumnSorter<Container, 'name'>('name'),
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
      ...descriptionTableObject<Container>(),
    ],
    []
  );

  // Track the FQN of the latest in-flight fetch so a slow earlier response for a
  // previous container does not overwrite the newer container's data when the
  // user navigates between containers.
  const latestFetchFqn = useRef<string>('');

  const fetchContainerChildren = useCallback(
    async (pagingOffset?: number) => {
      const fetchFqn = decodedContainerName;
      latestFetchFqn.current = fetchFqn;
      setIsChildrenLoading(true);
      try {
        const { data, paging } = await getContainerChildrenByName(fetchFqn, {
          limit: pageSize,
          offset: pagingOffset ?? 0,
        });
        if (latestFetchFqn.current !== fetchFqn) {
          return;
        }
        setContainerChildrenData(data ?? []);
        handlePagingChange(paging);
        onChildrenCountChange?.(paging.total);
      } catch (error) {
        if (latestFetchFqn.current === fetchFqn) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (latestFetchFqn.current === fetchFqn) {
          setIsChildrenLoading(false);
        }
      }
    },
    [decodedContainerName, pageSize, handlePagingChange, onChildrenCountChange]
  );

  const handleChildrenPageChange = (data: PagingHandlerParams) => {
    handlePageChange(data.currentPage);
    fetchContainerChildren((data.currentPage - 1) * pageSize);
  };

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
    // synthetic data via the parent Container's `children`. Those rows are
    // EntityReferences but the columns only render id/name/displayName/fqn —
    // fields shared with Container — so coerce the shape for the table.
    const children = (container?.children ?? []) as unknown as Container[];
    setContainerChildrenData(children);
    onChildrenCountChange?.(children.length);
  }, [isReadOnly, container?.children, onChildrenCountChange]);

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
      loading={isChildrenLoading}
      locale={{
        emptyText: <ErrorPlaceHolder className="p-y-md" />,
      }}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
};

export default ContainerChildren;

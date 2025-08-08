/*
 *  Copyright 2024 Collate.
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
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { usePaging } from '../../../hooks/paging/usePaging';
import { searchData } from '../../../rest/miscAPI';
import { formatDomainsResponse } from '../../../utils/APIUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { ownerTableObject } from '../../../utils/TableColumn.util';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../common/Table/Table';
import { SubDomainsTableProps } from './SubDomainsTable.interface';

const SubDomainsTable = ({
  domainFqn,
  permissions,
  onAddSubDomain,
}: SubDomainsTableProps) => {
  const [subDomains, setSubDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { t } = useTranslation();
  const encodedFqn = getEncodedFqn(escapeESReservedCharacters(domainFqn));

  const {
    currentPage,
    pageSize,
    paging,
    handlePagingChange,
    handlePageChange,
    showPagination,
  } = usePaging(PAGE_SIZE_LARGE);

  const fetchSubDomains = useCallback(async () => {
    try {
      setIsLoading(true);

      const res = await searchData(
        '',
        currentPage,
        pageSize,
        `(parent.fullyQualifiedName:"${encodedFqn}")`,
        '',
        '',
        SearchIndex.DOMAIN,
        false,
        true
      );

      const data = formatDomainsResponse(res.data.hits.hits);
      const totalCount = res.data.hits.total.value ?? 0;
      setSubDomains(data);

      handlePagingChange({
        total: totalCount,
      });
    } catch (error) {
      setSubDomains([]);
      handlePagingChange({ total: 0 });
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.sub-domain-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [encodedFqn, t, currentPage, pageSize, handlePagingChange]);

  const handlePagingClick = useCallback(
    (params: { currentPage: number }) => {
      handlePageChange(params.currentPage);
    },
    [handlePageChange]
  );

  useEffect(() => {
    if (domainFqn) {
      fetchSubDomains();
    }
  }, [domainFqn, fetchSubDomains]);

  const columns: ColumnsType<Domain> = useMemo(() => {
    const data = [
      {
        title: t('label.sub-domain-plural'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (name: string, record: Domain) => {
          return (
            <Link
              className="cursor-pointer vertical-baseline"
              data-testid={name}
              style={{ color: record.style?.color }}
              to={getDomainDetailsPath(
                record.fullyQualifiedName ?? record.name
              )}>
              {getEntityName(record)}
            </Link>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (description: string) =>
          description.trim() ? (
            <RichTextEditorPreviewerNew
              enableSeeMoreVariant
              markdown={description}
            />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
      ...ownerTableObject<Domain>(),
    ];

    return data;
  }, [subDomains]);

  if (isLoading) {
    return <Loader />;
  }

  if (isEmpty(subDomains) && !isLoading) {
    return (
      <ErrorPlaceHolder
        className="p-md p-b-lg"
        heading={t('label.sub-domain')}
        permission={permissions.Create}
        permissionValue={t('label.create-entity', {
          entity: t('label.sub-domain'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.CREATE}
        onClick={onAddSubDomain}
      />
    );
  }

  return (
    <Table
      columns={columns}
      containerClassName="m-md"
      customPaginationProps={{
        currentPage,
        pageSize,
        paging,
        pagingHandler: handlePagingClick,
        showPagination,
        isNumberBased: true,
        isLoading,
      }}
      dataSource={subDomains}
      pagination={false}
      rowKey="fullyQualifiedName"
      size="small"
    />
  );
};

export default SubDomainsTable;

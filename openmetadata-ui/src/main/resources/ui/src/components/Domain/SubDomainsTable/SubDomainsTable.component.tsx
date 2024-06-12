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
import { Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { SearchIndex } from '../../../enums/search.enum';
import {
  Domain,
  EntityReference,
} from '../../../generated/entity/domains/domain';
import { useFqn } from '../../../hooks/useFqn';
import { searchData } from '../../../rest/miscAPI';
import { formatDomainsResponse } from '../../../utils/APIUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';

const SubDomainsTable = ({ isVersionsView }: { isVersionsView: boolean }) => {
  const { fqn: domainFqn } = useFqn();
  const { t } = useTranslation();
  const [subDomains, setSubDomains] = useState<Domain[]>([]);
  const encodedFqn = getEncodedFqn(escapeESReservedCharacters(domainFqn));
  const [isLoading, setIsLoading] = useState(false);
  const { permissions } = usePermissionProvider();

  const columns: ColumnsType<Domain> = useMemo(() => {
    const data = [
      {
        title: t('label.sub-domain-plural'),
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record: Domain) => {
          return (
            <Link
              className="cursor-pointer vertical-baseline"
              data-testid={name}
              style={{ color: record.style?.color }}
              to={getDomainDetailsPath(
                record.fullyQualifiedName || record.name
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
        render: (description: string) =>
          description.trim() ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant
              markdown={description}
              maxLength={120}
            />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        render: (owner: EntityReference) => <OwnerLabel owner={owner} />,
      },
    ];

    return data;
  }, [subDomains, permissions]);

  const fetchSubDomains = async () => {
    if (!isVersionsView) {
      try {
        setIsLoading(true);
        const res = await searchData(
          '',
          1,
          PAGE_SIZE_LARGE,
          `(parent.fullyQualifiedName:"${encodedFqn}")`,
          '',
          '',
          SearchIndex.DOMAIN
        );

        const data = formatDomainsResponse(res.data.hits.hits);
        setSubDomains(data);
      } catch (error) {
        setSubDomains([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchSubDomains();
  }, [domainFqn]);

  if (subDomains.length === 0) {
    return <ErrorPlaceHolder />;
  }

  return (
    <Table
      bordered
      columns={columns}
      dataSource={subDomains}
      loading={isLoading}
      pagination={false}
      rowKey="fullyQualifiedName"
      size="small"
    />
  );
};

export default SubDomainsTable;

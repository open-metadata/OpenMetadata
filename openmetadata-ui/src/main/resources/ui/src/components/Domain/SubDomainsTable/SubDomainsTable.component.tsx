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
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import { ownerTableObject } from '../../../utils/TableColumn.util';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../common/Table/Table';
import { SubDomainsTableProps } from './SubDomainsTable.interface';

const SubDomainsTable = ({
  subDomains = [],
  isLoading = false,
  permissions,
  onAddSubDomain,
}: SubDomainsTableProps) => {
  const { t } = useTranslation();

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
      dataSource={subDomains}
      pagination={false}
      rowKey="fullyQualifiedName"
      size="small"
    />
  );
};

export default SubDomainsTable;

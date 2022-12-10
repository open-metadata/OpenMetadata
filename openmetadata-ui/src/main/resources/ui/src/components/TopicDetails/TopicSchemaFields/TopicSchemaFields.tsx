/*
 *  Copyright 2021 Collate
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

import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Popover, Space, Typography } from 'antd';
import Table, { ColumnsType, TableProps } from 'antd/lib/table';
import React, { FC, HTMLAttributes, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Field, Topic } from '../../../generated/entity/data/topic';
import { getEntityName } from '../../../utils/CommonUtils';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import TagsViewer from '../../tags-viewer/tags-viewer';
import { nestedField } from './TopicScheamFields.mock';

interface TopicSchemaFieldsProps extends HTMLAttributes<TableProps<Field>> {
  schemaFields: Topic['schemaFields'];
}

const TopicSchemaFields: FC<TopicSchemaFieldsProps> = ({
  schemaFields,
  className,
}) => {
  const { t } = useTranslation();

  const columns: ColumnsType<Field> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        ellipsis: true,
        width: 220,
        render: (_, record: Field) => (
          <Popover
            destroyTooltipOnHide
            content={getEntityName(record)}
            trigger="hover">
            <Typography.Text>{getEntityName(record)}</Typography.Text>
          </Popover>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataType',
        key: 'dataType',
        accessor: 'dataType',
        ellipsis: true,
        width: 220,
        render: (dataType: Field['dataType']) => (
          <Typography.Text>{dataType}</Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        render: (description: Field['description']) => (
          <>
            {description ? (
              <RichTextEditorPreviewer markdown={description} />
            ) : (
              <Typography.Text className="tw-no-description">
                {t('label.no-description')}
              </Typography.Text>
            )}
          </>
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 272,
        render: (tags: Field['tags']) => (
          <Space wrap>
            <TagsViewer sizeCap={-1} tags={tags || []} />
          </Space>
        ),
      },
    ],
    [schemaFields]
  );

  return (
    <Table
      bordered
      className={className}
      columns={columns}
      data-testid="topic-schema-fields-table"
      dataSource={[nestedField, ...(schemaFields ?? [])]}
      expandable={{
        rowExpandable: (record) =>
          Boolean(record.children && record.children.length > 0),

        expandIcon: ({ expanded, onExpand, expandable, record }) =>
          expandable && (
            <span
              className="m-r-xs cursor-pointer"
              onClick={(e) => onExpand(record, e)}>
              <FontAwesomeIcon icon={expanded ? faCaretDown : faCaretRight} />
            </span>
          ),
      }}
      pagination={false}
      size="small"
    />
  );
};

export default TopicSchemaFields;

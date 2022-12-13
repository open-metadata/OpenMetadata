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
import { Button, Popover, Space, Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import { cloneDeep, isUndefined } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Field } from '../../../generated/entity/data/topic';
import { getEntityName } from '../../../utils/CommonUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { updateFieldDescription } from '../../../utils/TopicSchemaFields.utils';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsViewer from '../../tags-viewer/tags-viewer';
import {
  CellRendered,
  TopicSchemaFieldsProps,
} from './TopicSchemaFields.interface';

const TopicSchemaFields: FC<TopicSchemaFieldsProps> = ({
  messageSchema,
  className,
  hasDescriptionEditAccess,
  isReadOnly,
  onUpdate,
}) => {
  const { t } = useTranslation();

  const [editFieldDescription, setEditFieldDescription] = useState<Field>();

  const handleFieldDescriptionChange = async (updatedDescription: string) => {
    if (!isUndefined(editFieldDescription)) {
      const schema = cloneDeep(messageSchema);
      updateFieldDescription(
        schema?.schemaFields,
        editFieldDescription.name,
        updatedDescription
      );
      await onUpdate(schema);
      setEditFieldDescription(undefined);
    } else {
      setEditFieldDescription(undefined);
    }
  };

  const renderDescription: CellRendered<Field, 'description'> = (
    description,
    record,
    index
  ) => {
    return (
      <Space
        className="custom-group w-full"
        data-testid="description"
        id={`field-description-${index}`}
        size={4}>
        <>
          {description ? (
            <RichTextEditorPreviewer markdown={description} />
          ) : (
            <Typography.Text className="tw-no-description">
              {t('label.no-description')}
            </Typography.Text>
          )}
        </>
        {isReadOnly && !hasDescriptionEditAccess ? null : (
          <Button
            className="p-0 opacity-0 group-hover-opacity-100"
            data-testid="edit-button"
            icon={
              <SVGIcons
                alt={t('label.edit')}
                icon="icon-edit"
                title={t('label.edit')}
                width="16px"
              />
            }
            type="text"
            onClick={() => setEditFieldDescription(record)}
          />
        )}
      </Space>
    );
  };

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
        render: renderDescription,
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
    [messageSchema]
  );

  const expandableConfig: ExpandableConfig<Field> = {
    rowExpandable: (record) =>
      Boolean(record.children && record.children.length > 0),

    expandIcon: ({ expanded, onExpand, expandable, record }) =>
      expandable && (
        <Typography.Text
          className="m-r-xs cursor-pointer"
          onClick={(e) => onExpand(record, e)}>
          <FontAwesomeIcon icon={expanded ? faCaretDown : faCaretRight} />
        </Typography.Text>
      ),
  };

  return (
    <>
      <Table
        bordered
        className={className}
        columns={columns}
        data-testid="topic-schema-fields-table"
        dataSource={messageSchema?.schemaFields}
        expandable={expandableConfig}
        pagination={false}
        size="small"
      />
      {editFieldDescription && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.schema-field'),
          })}: "${editFieldDescription.name}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.schema-field'),
          })}
          value={editFieldDescription.description ?? ''}
          onCancel={() => setEditFieldDescription(undefined)}
          onSave={handleFieldDescriptionChange}
        />
      )}
    </>
  );
};

export default TopicSchemaFields;

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

import { Button, Popover } from 'antd';
import classNames from 'classnames';
import TagsContainer from 'components/Tag/TagsContainer/tags-container';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { EntityField } from 'constants/Feeds.constants';
import { EntityType } from 'enums/entity.enum';
import { Column } from 'generated/entity/data/table';
import { ThreadType } from 'generated/entity/feed/thread';
import { TagSource } from 'generated/type/schema';
import { EntityFieldThreads } from 'interface/feed.interface';
import { isEmpty } from 'lodash';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_LINK_SEPARATOR } from 'utils/EntityUtils';
import { getFieldThreadElement } from 'utils/FeedElementUtils';
import { ReactComponent as IconRequest } from '../../assets/svg/request-icon.svg';
import { EntityTableTagsProps } from './EntityTable.interface';

const EntityTableTags = ({
  tags,
  record,
  index,
  isReadOnly,
  isTagLoading,
  hasTagEditAccess,
  onUpdateTagsHandler,
  onRequestTagsHandler,
  getColumnName,
  entityFieldTasks,
  onThreadLinkSelect,
  entityFieldThreads,
  entityFqn,
  allTags,
  handleTagSelection,
  type,
}: EntityTableTagsProps) => {
  console.log({ type, tags });

  const { t } = useTranslation();
  const otherTags =
    type === TagSource.Glossary
      ? tags[TagSource.Classification]
      : tags[TagSource.Glossary];
  const [editColumnTag, setEditColumnTag] = useState<{
    column: Column;
    index: number;
  }>();

  const handleEditColumnTag = (column: Column, index: number): void => {
    setEditColumnTag({ column, index });
  };

  const getRequestTagsElement = (cell: Column) => {
    const hasTags = !isEmpty(cell?.tags || []);
    const text = hasTags
      ? t('label.update-request-tag-plural')
      : t('label.request-tag-plural');

    return (
      <Button
        className="p-0 w-7 h-7 tw-flex-none link-text focus:tw-outline-none tw-align-top hover-cell-icon"
        data-testid="request-tags"
        type="text"
        onClick={() =>
          hasTags ? onUpdateTagsHandler(cell) : onRequestTagsHandler(cell)
        }>
        <Popover
          destroyTooltipOnHide
          content={text}
          overlayClassName="ant-popover-request-description"
          trigger="hover"
          zIndex={9999}>
          <IconRequest
            height={16}
            name={t('label.request-tag-plural')}
            width={16}
          />
        </Popover>
      </Button>
    );
  };

  return (
    <div className="hover-icon-group">
      {isReadOnly ? (
        <TagsViewer sizeCap={-1} tags={tags[type] || []} />
      ) : (
        <div
          className={classNames(
            `tw-flex tw-justify-content`,
            editColumnTag?.index === index || !isEmpty(tags)
              ? 'tw-flex-col tw-items-start'
              : 'tw-items-center'
          )}
          data-testid="tags-wrapper"
          onClick={() => !editColumnTag && handleEditColumnTag(record, index)}>
          <TagsContainer
            className="w-min-15 "
            editable={editColumnTag?.index === index}
            isLoading={isTagLoading && editColumnTag?.index === index}
            selectedTags={tags[type] || []}
            showAddTagButton={hasTagEditAccess}
            size="small"
            tagList={allTags}
            type="label"
            onCancel={async () => {
              await handleTagSelection();
              setEditColumnTag(undefined);
            }}
            onSelectionChange={async (selectedTags) => {
              await handleTagSelection(
                selectedTags,
                record?.fullyQualifiedName,
                editColumnTag,
                otherTags
              );
              setEditColumnTag(undefined);
            }}
          />

          <div className="tw-mt-1 tw-flex">
            {getRequestTagsElement(record)}
            {getFieldThreadElement(
              getColumnName(record),
              'tags',
              entityFieldThreads as EntityFieldThreads[],
              onThreadLinkSelect,
              EntityType.TABLE,
              entityFqn,
              `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                record
              )}${ENTITY_LINK_SEPARATOR}tags`,
              Boolean(record?.name?.length)
            )}
            {getFieldThreadElement(
              getColumnName(record),
              EntityField.TAGS,
              entityFieldTasks as EntityFieldThreads[],
              onThreadLinkSelect,
              EntityType.TABLE,
              entityFqn,
              `${EntityField.COLUMNS}${ENTITY_LINK_SEPARATOR}${getColumnName(
                record
              )}${ENTITY_LINK_SEPARATOR}${EntityField.TAGS}`,
              Boolean(record?.name),
              ThreadType.Task
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityTableTags;

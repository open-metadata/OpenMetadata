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
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import classNames from 'classnames';
import TagsContainer from 'components/Tag/TagsContainer/tags-container';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { EntityField } from 'constants/Feeds.constants';
import { EntityType } from 'enums/entity.enum';
import { ThreadType } from 'generated/entity/feed/thread';
import { TagSource } from 'generated/type/schema';
import { EntityFieldThreads } from 'interface/feed.interface';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFieldThreadElement } from 'utils/FeedElementUtils';
import { ReactComponent as IconRequest } from '../../assets/svg/request-icon.svg';
import { TableTagsComponentProps, TableUnion } from './TableTags.interface';

const TableTags = <T extends TableUnion>({
  tags,
  record,
  index,
  isReadOnly,
  isTagLoading,
  hasTagEditAccess,
  onUpdateTagsHandler,
  onRequestTagsHandler,
  getColumnName,
  getColumnFieldFQN,
  entityFieldTasks,
  onThreadLinkSelect,
  entityFieldThreads,
  entityFqn,
  tagList,
  handleTagSelection,
  type,
  fetchTags,
  tagFetchFailed,
  dataTestId,
}: TableTagsComponentProps<T>) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState<boolean>(false);

  const isGlossaryType = useMemo(() => type === TagSource.Glossary, [type]);

  const otherTags = useMemo(
    () =>
      isGlossaryType
        ? tags[TagSource.Classification]
        : tags[TagSource.Glossary],
    [tags, isGlossaryType]
  );

  const searchPlaceholder = useMemo(
    () =>
      isGlossaryType
        ? t('label.search-entity', {
            entity: t('label.glossary-term-plural'),
          })
        : t('label.search-entity', {
            entity: t('label.tag-plural'),
          }),
    [isGlossaryType]
  );

  const addButtonHandler = useCallback(() => {
    setIsEdit(true);
    // Fetch Classification or Glossary only once
    if (isEmpty(tagList) || tagFetchFailed) {
      fetchTags();
    }
  }, [tagList, tagFetchFailed, fetchTags]);

  const getRequestTagsElement = useMemo(() => {
    const hasTags = !isEmpty(record.tags || []);
    const text = hasTags
      ? t('label.update-request-tag-plural')
      : t('label.request-tag-plural');

    return (
      <Popover
        destroyTooltipOnHide
        content={text}
        overlayClassName="ant-popover-request-description"
        trigger="hover"
        zIndex={9999}>
        <Button
          className="p-0 w-7 h-7 flex-center m-r-xss link-text hover-cell-icon"
          data-testid="request-tags"
          icon={
            <IconRequest
              height={16}
              name={t('label.request-tag-plural')}
              width={16}
            />
          }
          type="text"
          onClick={() =>
            hasTags
              ? onUpdateTagsHandler?.(record)
              : onRequestTagsHandler?.(record)
          }
        />
      </Popover>
    );
  }, [record, onUpdateTagsHandler, onRequestTagsHandler]);

  return (
    <div className="hover-icon-group" data-testid={`${dataTestId}-${index}`}>
      {isReadOnly ? (
        <TagsViewer sizeCap={-1} tags={tags[type] || []} />
      ) : (
        <div
          className={classNames(
            `d-flex justify-content`,
            isEdit || !isEmpty(tags) ? 'flex-col items-start' : 'items-center'
          )}
          data-testid="tags-wrapper">
          <TagsContainer
            className="w-min-13 w-max-13"
            editable={isEdit}
            isLoading={isTagLoading && isEdit}
            placeholder={searchPlaceholder}
            selectedTags={tags[type]}
            showAddTagButton={hasTagEditAccess && isEmpty(tags[type])}
            size="small"
            tagList={tagList}
            type="label"
            onAddButtonClick={addButtonHandler}
            onCancel={() => setIsEdit(false)}
            onSelectionChange={async (selectedTags) => {
              await handleTagSelection(selectedTags, record, otherTags);
              setIsEdit(false);
            }}
          />

          <div className="m-t-xss d-flex items-center">
            {tags[type].length && hasTagEditAccess && !isEdit ? (
              <Button
                className="p-0 w-7 h-7 flex-center text-primary hover-cell-icon"
                data-testid="edit-button"
                icon={
                  <IconEdit height={16} name={t('label.edit')} width={16} />
                }
                size="small"
                type="text"
                onClick={addButtonHandler}
              />
            ) : null}

            {getColumnName &&
              getColumnFieldFQN &&
              onUpdateTagsHandler &&
              onRequestTagsHandler && (
                <>
                  {/*  Request and Update tags */}
                  {getRequestTagsElement}

                  {/*  List Conversation */}
                  {getFieldThreadElement(
                    getColumnName(record),
                    EntityField.TAGS,
                    entityFieldThreads as EntityFieldThreads[],
                    onThreadLinkSelect,
                    EntityType.TABLE,
                    entityFqn,
                    getColumnFieldFQN,
                    Boolean(record?.name?.length)
                  )}

                  {/*  List Task */}
                  {getFieldThreadElement(
                    getColumnName(record),
                    EntityField.TAGS,
                    entityFieldTasks as EntityFieldThreads[],
                    onThreadLinkSelect,
                    EntityType.TABLE,
                    entityFqn,
                    getColumnFieldFQN,
                    Boolean(record?.name),
                    ThreadType.Task
                  )}
                </>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableTags;

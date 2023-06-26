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

import { Button, Tooltip } from 'antd';
import classNames from 'classnames';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { EntityType } from 'enums/entity.enum';
import { ThreadType } from 'generated/entity/feed/thread';
import { TagSource } from 'generated/type/tagLabel';
import { EntityFieldThreads } from 'interface/feed.interface';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFieldThreadElement } from 'utils/FeedElementUtils';
import { ReactComponent as IconRequest } from '../../assets/svg/request-icon.svg';
import { TableTagsComponentProps, TableUnion } from './TableTags.interface';

const TableTags = <T extends TableUnion>({
  tags,
  record,
  index,
  type,
  entityFqn,
  isReadOnly,
  hasTagEditAccess,
  entityFieldThreads,
  getColumnFieldFQN,
  entityFieldTasks,
  showInlineEditTagButton,
  getColumnName,
  onUpdateTagsHandler,
  onRequestTagsHandler,
  onThreadLinkSelect,
  handleTagSelection,
}: TableTagsComponentProps<T>) => {
  const { t } = useTranslation();

  const hasTagOperationAccess = useMemo(
    () =>
      getColumnFieldFQN &&
      getColumnName &&
      onUpdateTagsHandler &&
      onRequestTagsHandler,
    [
      getColumnFieldFQN,
      getColumnName,
      onUpdateTagsHandler,
      onRequestTagsHandler,
    ]
  );

  const getRequestTagsElement = useMemo(() => {
    const hasTags = !isEmpty(record.tags || []);

    return (
      <Tooltip
        destroyTooltipOnHide
        overlayClassName="ant-popover-request-description"
        title={
          hasTags
            ? t('label.update-request-tag-plural')
            : t('label.request-tag-plural')
        }>
        <Button
          className="p-0 w-7 h-7 flex-center m-r-xss link-text hover-cell-icon"
          data-testid="request-tags"
          icon={
            <IconRequest
              height={14}
              name={t('label.request-tag-plural')}
              style={{ color: DE_ACTIVE_COLOR }}
              width={14}
            />
          }
          type="text"
          onClick={() =>
            hasTags
              ? onUpdateTagsHandler?.(record)
              : onRequestTagsHandler?.(record)
          }
        />
      </Tooltip>
    );
  }, [record, onUpdateTagsHandler, onRequestTagsHandler]);

  return (
    <div className="hover-icon-group" data-testid={`${type}-tags-${index}`}>
      <div
        className={classNames('d-flex justify-content flex-col items-start')}
        data-testid="tags-wrapper">
        <TagsContainerV2
          showBottomEditButton
          permission={hasTagEditAccess && !isReadOnly}
          selectedTags={tags}
          showHeader={false}
          showInlineEditButton={showInlineEditTagButton}
          tagType={type}
          onSelectionChange={async (selectedTags) => {
            await handleTagSelection(selectedTags, record);
          }}>
          <>
            {!isReadOnly && (
              <div className="d-flex items-center">
                {hasTagOperationAccess && (
                  <>
                    {/*  Request and Update tags */}
                    {type === TagSource.Classification && getRequestTagsElement}

                    {/*  List Conversation */}
                    {getFieldThreadElement(
                      getColumnName?.(record) ?? '',
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
                      getColumnName?.(record) ?? '',
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
            )}
          </>
        </TagsContainerV2>
      </div>
    </div>
  );
};

export default TableTags;

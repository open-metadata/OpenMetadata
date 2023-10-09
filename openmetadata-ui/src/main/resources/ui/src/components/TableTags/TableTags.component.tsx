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

import classNames from 'classnames';
import { lowerCase } from 'lodash';
import React from 'react';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { EntityField } from '../../constants/Feeds.constants';
import EntityTasks from '../../pages/TasksPage/EntityTasks/EntityTasks.component';
import { TableTagsComponentProps, TableUnion } from './TableTags.interface';

const TableTags = <T extends TableUnion>({
  tags,
  record,
  index,
  type,
  entityFqn,
  isReadOnly,
  hasTagEditAccess,
  showInlineEditTagButton,
  onThreadLinkSelect,
  handleTagSelection,
  entityType,
}: TableTagsComponentProps<T>) => {
  return (
    <div
      className="hover-icon-group"
      data-testid={`${lowerCase(type)}-tags-${index}`}>
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
              <EntityTasks
                data={{
                  fqn: record.fullyQualifiedName ?? '',
                  field: record.tags ?? [],
                }}
                entityFqn={entityFqn}
                entityTaskType={EntityField.TAGS}
                entityType={entityType}
                tagSource={type}
                onThreadLinkSelect={onThreadLinkSelect}
              />
            )}
          </>
        </TagsContainerV2>
      </div>
    </div>
  );
};

export default TableTags;

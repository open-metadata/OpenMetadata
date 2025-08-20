/*
 *  Copyright 2022 Collate.
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

import { Tooltip } from 'antd';
import IconComments from '../assets/svg/comment.svg?react';
import { EntityField } from '../constants/Feeds.constants';
import { EntityType } from '../enums/entity.enum';
import { ThreadType } from '../generated/entity/feed/thread';
import { ENTITY_LINK_SEPARATOR, getEntityFeedLink } from './EntityUtils';
import { t } from './i18next/LocalUtil';

export const getFieldThreadElement = (
  onThreadLinkSelect: (value: string, threadType?: ThreadType) => void,
  entityType: EntityType,
  entityFqn: string,
  columnName: string,
  entityField: string,
  entityTaskType: EntityField.TAGS | EntityField.DESCRIPTION
) => {
  const entityLink = getEntityFeedLink(
    entityType,
    entityFqn,
    `${entityField}${ENTITY_LINK_SEPARATOR}${columnName}${ENTITY_LINK_SEPARATOR}${entityTaskType}`
  );

  return (
    <Tooltip
      destroyTooltipOnHide
      overlayClassName="ant-popover-request-description"
      title={t('label.list-entity', {
        entity: t('label.conversation'),
      })}>
      <IconComments
        className="table-action-icon hover-cell-icon"
        data-testid="field-thread"
        name="comments"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();

          onThreadLinkSelect(entityLink);
        }}
      />
    </Tooltip>
  );
};

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
import { t } from 'i18next';
import React from 'react';
import { ReactComponent as IconComments } from '../assets/svg/comment.svg';
import { DE_ACTIVE_COLOR } from '../constants/constants';
import { ThreadType } from '../generated/entity/feed/thread';
import { getEntityFeedLink } from './EntityUtils';

const iconsProps = {
  height: 14,
  name: 'comments',
  width: 14,
  style: { color: DE_ACTIVE_COLOR },
};

export const getFieldThreadElement = (
  onThreadLinkSelect: (value: string, threadType?: ThreadType) => void,
  entityType?: string,
  entityFqn?: string,
  entityField?: string
) => {
  const entityLink = getEntityFeedLink(entityType, entityFqn, entityField);

  return (
    <Tooltip
      destroyTooltipOnHide
      overlayClassName="ant-popover-request-description"
      title={t('label.list-entity', {
        entity: t('label.conversation'),
      })}>
      <IconComments
        {...iconsProps}
        className="hover-cell-icon cursor-pointer"
        data-testid="field-thread"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();

          onThreadLinkSelect(entityLink);
        }}
      />
    </Tooltip>
  );
};

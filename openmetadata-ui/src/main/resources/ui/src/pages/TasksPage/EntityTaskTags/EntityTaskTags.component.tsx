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

import { Space, Tooltip } from 'antd';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { TagSource } from 'generated/type/tagLabel';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getPartialNameFromTableFQN } from 'utils/CommonUtils';
import { ENTITY_LINK_SEPARATOR } from 'utils/EntityUtils';
import { getFieldThreadElement } from 'utils/FeedElementUtils';
import {
  getEntityTaskDetails,
  getRequestTagsPath,
  getUpdateTagsPath,
} from 'utils/TasksUtils';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import { EntityTaskTagsProps } from './EntityTaskTags.interface';

const EntityTaskTags = ({
  data,
  tagSource,
  entityFqn,
  entityType,
  entityFieldThreads,
  onThreadLinkSelect,
}: EntityTaskTagsProps) => {
  const { t } = useTranslation();
  const history = useHistory();

  const { fqnPart, entityField } = useMemo(
    () => getEntityTaskDetails(entityType),
    [entityType]
  );

  const columnName = useMemo(() => {
    const columnName = getPartialNameFromTableFQN(data.fqn ?? '', fqnPart);

    return columnName.includes(FQN_SEPARATOR_CHAR)
      ? `"${columnName}"`
      : columnName;
  }, [data.fqn]);

  const handleTagTask = (hasTags: boolean) => {
    history.push(
      (hasTags ? getUpdateTagsPath : getRequestTagsPath)(
        entityType,
        entityFqn,
        entityField,
        columnName
      )
    );
  };

  const getRequestTagsElement = useMemo(() => {
    const hasTags = !isEmpty(data.tags);

    return (
      <Tooltip
        destroyTooltipOnHide
        overlayClassName="ant-popover-request-description"
        title={
          hasTags
            ? t('label.update-request-tag-plural')
            : t('label.request-tag-plural')
        }>
        <IconRequest
          className="hover-cell-icon cursor-pointer"
          data-testid="request-tags"
          height={14}
          name={t('label.request-tag-plural')}
          style={{ color: DE_ACTIVE_COLOR }}
          width={14}
          onClick={() => handleTagTask(hasTags)}
        />
      </Tooltip>
    );
  }, [data]);

  return (
    <Space size="middle">
      {/*  Request and Update tags */}
      {tagSource === TagSource.Classification && getRequestTagsElement}

      {/*  List Conversation */}
      {getFieldThreadElement(
        columnName,
        EntityField.TAGS,
        entityFieldThreads,
        onThreadLinkSelect,
        entityType,
        entityFqn,
        `${entityField}${ENTITY_LINK_SEPARATOR}${columnName}${ENTITY_LINK_SEPARATOR}${EntityField.TAGS}`
      )}
    </Space>
  );
};

export default EntityTaskTags;

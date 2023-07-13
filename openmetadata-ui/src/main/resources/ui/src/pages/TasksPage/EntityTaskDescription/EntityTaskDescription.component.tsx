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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getPartialNameFromTableFQN } from 'utils/CommonUtils';
import { ENTITY_LINK_SEPARATOR } from 'utils/EntityUtils';
import { getFieldThreadElement } from 'utils/FeedElementUtils';
import {
  getEntityTaskDetails,
  getRequestDescriptionPath,
  getUpdateDescriptionPath,
} from 'utils/TasksUtils';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import { EntityTaskDescriptionProps } from './entityTaskDescription.interface';

const EntityTaskDescription = ({
  entityFqn,
  entityType,
  data,
  onThreadLinkSelect,
  entityFieldThreads,
}: EntityTaskDescriptionProps) => {
  const history = useHistory();
  const { t } = useTranslation();

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

  const handleDescriptionTask = (hasDescription: boolean) => {
    history.push(
      (hasDescription ? getUpdateDescriptionPath : getRequestDescriptionPath)(
        entityType,
        entityFqn,
        entityField,
        columnName
      )
    );
  };

  const requestDescriptionElement = useMemo(() => {
    const hasDescription = Boolean(data?.description);

    return (
      <Tooltip
        destroyTooltipOnHide
        title={
          hasDescription
            ? t('message.request-update-description')
            : t('message.request-description')
        }>
        <IconRequest
          className="cursor-pointer hover-cell-icon"
          data-testid="request-description"
          height={14}
          name={t('message.request-description')}
          style={{ color: DE_ACTIVE_COLOR }}
          width={14}
          onClick={() => handleDescriptionTask(hasDescription)}
        />
      </Tooltip>
    );
  }, [data]);

  return (
    <Space size="middle">
      {requestDescriptionElement}
      {getFieldThreadElement(
        columnName,
        EntityField.DESCRIPTION,
        entityFieldThreads,
        onThreadLinkSelect,
        entityType,
        entityFqn,
        `${entityField}${ENTITY_LINK_SEPARATOR}${columnName}${ENTITY_LINK_SEPARATOR}${EntityField.DESCRIPTION}`
      )}
    </Space>
  );
};

export default EntityTaskDescription;

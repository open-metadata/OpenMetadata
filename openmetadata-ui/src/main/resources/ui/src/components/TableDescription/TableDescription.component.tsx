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

import { Space } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import { DE_ACTIVE_COLOR } from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import EntityTasks from '../../pages/TasksPage/EntityTasks/EntityTasks.component';
import { TableDescriptionProps } from './TableDescription.interface';

const TableDescription = ({
  index,
  columnData,
  entityFqn,
  isReadOnly,
  onClick,
  entityType,
  hasEditPermission,
  onThreadLinkSelect,
}: TableDescriptionProps) => {
  const { t } = useTranslation();

  return (
    <Space
      className="hover-icon-group"
      data-testid="description"
      direction="vertical"
      id={`field-description-${index}`}>
      {columnData.field ? (
        <RichTextEditorPreviewer markdown={columnData.field} />
      ) : (
        <span className="text-grey-muted">
          {t('label.no-entity', {
            entity: t('label.description'),
          })}
        </span>
      )}
      {!isReadOnly ? (
        <Space align="baseline" size="middle">
          {hasEditPermission && (
            <EditIcon
              className="cursor-pointer hover-cell-icon"
              data-testid="edit-button"
              height={14}
              name={t('label.edit')}
              style={{ color: DE_ACTIVE_COLOR }}
              width={14}
              onClick={onClick}
            />
          )}

          <EntityTasks
            data={columnData}
            entityFqn={entityFqn}
            entityTaskType={EntityField.DESCRIPTION}
            entityType={entityType}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        </Space>
      ) : null}
    </Space>
  );
};

export default TableDescription;

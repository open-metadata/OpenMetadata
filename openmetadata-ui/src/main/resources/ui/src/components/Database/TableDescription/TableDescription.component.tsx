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

import { Button, Space, Tooltip } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import EntityTasks from '../../../pages/TasksPage/EntityTasks/EntityTasks.component';
import EntityLink from '../../../utils/EntityLink';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import SuggestionsAlert from '../../Suggestions/SuggestionsAlert/SuggestionsAlert';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
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
  const { selectedUserSuggestions = [] } = useSuggestionsContext();

  const entityLink = useMemo(
    () =>
      entityType === EntityType.TABLE
        ? EntityLink.getTableEntityLink(
            entityFqn,
            EntityLink.getTableColumnNameFromColumnFqn(columnData.fqn)
          )
        : getEntityFeedLink(entityType, columnData.fqn),
    [entityType, entityFqn]
  );

  const suggestionData = useMemo(() => {
    const activeSuggestion = selectedUserSuggestions.find(
      (suggestion) => suggestion.entityLink === entityLink
    );

    if (activeSuggestion?.entityLink === entityLink) {
      return (
        <SuggestionsAlert
          hasEditAccess={hasEditPermission}
          maxLength={40}
          showSuggestedBy={false}
          suggestion={activeSuggestion}
        />
      );
    }

    return null;
  }, [hasEditPermission, entityLink, selectedUserSuggestions]);

  const descriptionContent = useMemo(() => {
    if (suggestionData) {
      return suggestionData;
    } else if (columnData.field) {
      return <RichTextEditorPreviewerV1 markdown={columnData.field} />;
    } else {
      return (
        <span className="text-grey-muted">
          {t('label.no-entity', {
            entity: t('label.description'),
          })}
        </span>
      );
    }
  }, [columnData, suggestionData]);

  return (
    <Space
      className="hover-icon-group w-full d-flex"
      data-testid="description"
      direction="vertical"
      id={`field-description-${index}`}>
      {descriptionContent}

      {!suggestionData && !isReadOnly ? (
        <Space align="baseline" size="middle">
          {hasEditPermission && (
            <Tooltip
              title={t('label.edit-entity', {
                entity: t('label.description'),
              })}>
              <Button
                className="cursor-pointer hover-cell-icon"
                data-testid="edit-button"
                style={{
                  color: DE_ACTIVE_COLOR,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                }}
                onClick={onClick}>
                <EditIcon
                  style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                />
              </Button>
            </Tooltip>
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

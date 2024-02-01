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

import { Button, Popover, Space } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import { DE_ACTIVE_COLOR } from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { EntityType } from '../../enums/entity.enum';
import EntityTasks from '../../pages/TasksPage/EntityTasks/EntityTasks.component';
import EntityLink from '../../utils/EntityLink';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import MetaPilotPopoverContent from '../MetaPilot/MetaPilotPopoverContent/MetaPilotPopoverContent.component';
import { useMetaPilotContext } from '../MetaPilot/MetaPilotProvider/MetaPilotProvider';
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
  const { activeSuggestion, suggestions, onUpdateActiveSuggestion } =
    useMetaPilotContext();
  const [showSuggestionPopover, setShowSuggestionPopover] = useState(false);

  const entityLink = useMemo(
    () =>
      entityType === EntityType.TABLE
        ? EntityLink.getTableEntityLink(
            entityFqn,
            columnData.record?.name ?? ''
          )
        : getEntityFeedLink(entityType, columnData.fqn),
    [entityType, entityFqn]
  );

  const suggestionForEmptyData = useMemo(() => {
    if (isEmpty(columnData.field ?? ''.trim())) {
      return suggestions.find(
        (suggestion) => suggestion.entityLink === entityLink
      );
    }

    return null;
  }, [suggestions, columnData.field, entityLink]);

  const suggestionData = useMemo(() => {
    if (activeSuggestion?.entityLink === entityLink) {
      return (
        <MetaPilotPopoverContent
          hasEditAccess={hasEditPermission}
          suggestion={activeSuggestion}
        />
      );
    }

    return null;
  }, [hasEditPermission, suggestionForEmptyData, activeSuggestion]);

  useEffect(() => {
    if (activeSuggestion?.entityLink === entityLink) {
      setShowSuggestionPopover(true);
    } else {
      setShowSuggestionPopover(false);
    }
  }, [activeSuggestion, entityLink]);

  const onPopoverOpenChange = useCallback(
    (data: boolean) => {
      setShowSuggestionPopover(data);
      if (!data) {
        onUpdateActiveSuggestion();
      }
    },
    [onUpdateActiveSuggestion]
  );

  return (
    <Popover
      align={{ targetOffset: [0, 40] }}
      content={suggestionData}
      open={showSuggestionPopover}
      overlayClassName="metapilot-popover"
      overlayStyle={{
        bottom: 'auto',
      }}
      placement="bottom"
      trigger="click"
      onOpenChange={onPopoverOpenChange}>
      <Space
        className={classNames('hover-icon-group', {
          'has-suggestion': Boolean(suggestionData),
        })}
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
                <EditIcon />
              </Button>
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
    </Popover>
  );
};

export default TableDescription;

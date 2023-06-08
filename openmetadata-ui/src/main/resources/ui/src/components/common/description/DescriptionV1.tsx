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

import Icon from '@ant-design/icons';
import { Card, Space, Typography } from 'antd';
import { ReactComponent as AddChatIcon } from 'assets/svg/add-chat.svg';
import { ReactComponent as CommentIcon } from 'assets/svg/comment.svg';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as RequestIcon } from 'assets/svg/request-icon.svg';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { t } from 'i18next';
import { isUndefined } from 'lodash';
import React, { Fragment } from 'react';
import { EntityField } from '../../../constants/Feeds.constants';
import { Table } from '../../../generated/entity/data/table';
import { EntityFieldThreads } from '../../../interface/feed.interface';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';
const { Text } = Typography;

interface Props {
  entityName?: string;
  owner?: Table['owner'];
  hasEditAccess?: boolean;
  removeBlur?: boolean;
  description?: string;
  isEdit?: boolean;
  isReadOnly?: boolean;
  entityType?: string;
  entityFqn?: string;
  entityFieldThreads?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string) => void;
  onDescriptionEdit?: () => void;
  onCancel?: () => void;
  onDescriptionUpdate?: (value: string) => Promise<void>;
  onSuggest?: (value: string) => void;
  onEntityFieldSelect?: (value: string) => void;
  wrapInCard?: boolean;
}
const DescriptionV1 = ({
  hasEditAccess,
  onDescriptionEdit,
  description = '',
  isEdit,
  onCancel,
  onDescriptionUpdate,
  isReadOnly = false,
  removeBlur = false,
  entityName,
  entityFieldThreads,
  onThreadLinkSelect,
  onEntityFieldSelect,
  entityType,
  entityFqn,
  wrapInCard = false,
}: Props) => {
  const descriptionThread = entityFieldThreads?.[0];

  const editButton = () => {
    const extraIcons = !isUndefined(descriptionThread) ? (
      <Icon
        component={CommentIcon}
        data-testid="description-thread"
        style={{ color: DE_ACTIVE_COLOR }}
        width={20}
        onClick={() => onThreadLinkSelect?.(descriptionThread.entityLink)}
      />
    ) : (
      <Fragment>
        {description?.trim() && onThreadLinkSelect ? (
          <Icon
            component={AddChatIcon}
            data-testid="start-description-thread"
            style={{ color: DE_ACTIVE_COLOR }}
            onClick={() =>
              onThreadLinkSelect?.(
                getEntityFeedLink(
                  entityType,
                  entityFqn,
                  EntityField.DESCRIPTION
                )
              )
            }
          />
        ) : null}
      </Fragment>
    );

    const requestDescription = (
      <Icon
        component={RequestIcon}
        data-testid="request-description"
        style={{ color: DE_ACTIVE_COLOR }}
        onClick={() => onEntityFieldSelect?.(EntityField.DESCRIPTION)}
      />
    );

    return !isReadOnly && hasEditAccess ? (
      <Space>
        <Icon
          component={EditIcon}
          data-testid="edit-description"
          style={{ color: DE_ACTIVE_COLOR }}
          onClick={onDescriptionEdit}
        />
        {requestDescription}
        {extraIcons}
      </Space>
    ) : (
      <Space>
        {requestDescription} {extraIcons}
      </Space>
    );
  };

  const content = (
    <>
      <Space
        className="schema-description d-flex"
        direction="vertical"
        size={0}>
        <div className="d-flex items-center">
          <Text className="m-b-0 m-r-xss schema-heading">
            {t('label.description')}
          </Text>
          {editButton()}
        </div>
        <div>
          {description?.trim() ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant={!removeBlur}
              markdown={description}
            />
          ) : (
            <span>{t('label.no-description')}</span>
          )}
          <ModalWithMarkdownEditor
            header={t('label.edit-description-for', { entityName })}
            placeholder={t('label.enter-entity', {
              entity: t('label.description'),
            })}
            value={description}
            visible={Boolean(isEdit)}
            onCancel={onCancel}
            onSave={onDescriptionUpdate}
          />
        </div>
      </Space>
    </>
  );

  return wrapInCard ? <Card>{content}</Card> : content;
};

export default DescriptionV1;

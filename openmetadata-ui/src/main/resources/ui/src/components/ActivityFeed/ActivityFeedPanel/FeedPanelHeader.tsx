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

import { PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { Tooltip } from '../../common/AntdCompat';;
import classNames from 'classnames';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import CloseIcon from '../../../components/Modals/CloseIcon.component';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  entityDisplayName,
  getEntityField,
  getEntityFieldDisplay,
  getEntityFQN,
  getEntityType,
  getFeedPanelHeaderText,
} from '../../../utils/FeedUtils';
import { FeedPanelHeaderProp } from './ActivityFeedPanel.interface';

const FeedPanelHeader: FC<FeedPanelHeaderProp> = ({
  className,
  entityLink,
  noun,
  feed,
  onShowNewConversation,
  threadType,
  onCancel,
  hideCloseIcon = false,
}) => {
  const { t } = useTranslation();
  const entityType = getEntityType(entityLink);
  const entityFQN = getEntityFQN(entityLink);
  const entityField = getEntityField(entityLink);

  return (
    <header
      className={classNames(
        'd-flex justify-between items-center p-y-md',
        className
      )}>
      <p data-testid="header-title">
        <span data-testid="header-noun">
          {noun ? noun : getFeedPanelHeaderText(threadType)}{' '}
          {t('label.on-lowercase')}{' '}
        </span>
        <span className="font-medium" data-testid="entity-attribute">
          {entityField ? (
            getEntityFieldDisplay(entityField)
          ) : (
            <Link
              className="break-all"
              data-testid="entitylink"
              to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
              <span>
                {feed?.entityRef
                  ? getEntityName(feed.entityRef)
                  : entityDisplayName(entityType, entityFQN)}
              </span>
            </Link>
          )}
        </span>
      </p>
      <div className="d-flex items-center">
        {onShowNewConversation ? (
          <Tooltip
            placement="bottom"
            title={t('label.start-entity', {
              entity: t('label.conversation-lowercase'),
            })}
            trigger="hover">
            <Button
              data-testid="add-new-conversation"
              icon={<PlusOutlined />}
              size="small"
              type="primary"
              onClick={() => {
                onShowNewConversation(true);
              }}
            />
          </Tooltip>
        ) : null}
        {hideCloseIcon ? null : (
          <CloseIcon dataTestId="closeDrawer" handleCancel={onCancel} />
        )}
      </div>
    </header>
  );
};

export default FeedPanelHeader;

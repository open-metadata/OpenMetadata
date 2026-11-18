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

import { Button, ButtonUtility } from '@openmetadata/ui-core-components';
import { Plus, XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FeedPanelHeaderProp } from './ActivityFeedPanel.interface';
const FeedPanelHeader: FC<FeedPanelHeaderProp> = ({
  className,
  onShowNewConversation,
  onCancel,
  hideCloseIcon = false,
}) => {
  const { t } = useTranslation();

  return (
    <header
      className={classNames(
        'd-flex justify-between items-center p-y-md',
        className
      )}>
      <p data-testid="header-title">{t('label.conversation')}</p>
      <div className="d-flex items-center">
        {onShowNewConversation ? (
          <Button
            color="secondary"
            data-testid="add-new-conversation"
            iconLeading={Plus}
            size="sm"
            onPress={() => {
              onShowNewConversation(true);
            }}>
            {t('label.new-entity', {
              entity: t('label.conversation-lowercase'),
            })}
          </Button>
        ) : null}
        {hideCloseIcon ? null : (
          <ButtonUtility
            data-testid="closeDrawer"
            icon={XClose}
            size="lg"
            tooltip={t('label.close')}
            onClick={onCancel}
          />
        )}
      </div>
    </header>
  );
};

export default FeedPanelHeader;

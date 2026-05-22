/*
 *  Copyright 2024 Collate.
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

import { Input, Typography } from 'antd';
import classNames from 'classnames';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import ActivityFeedCardNew from '../ActivityFeedCardNew/ActivityFeedcardNew.component';
import ActivityFeedEditorNew from '../ActivityFeedEditor/ActivityFeedEditorNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './feed-panel-body-v1.less';

interface ActivityPanelBodyProps {
  activity: ActivityEvent;
  className?: string;
}

const ActivityPanelBody: FC<ActivityPanelBodyProps> = ({
  activity,
  className,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { postActivityComment } = useActivityFeedProvider();
  const [showFeedEditor, setShowFeedEditor] = useState(false);

  const onSave = useCallback(
    async (message: string) => {
      await postActivityComment(message, activity);
      setShowFeedEditor(false);
    },
    [postActivityComment, activity]
  );

  return (
    <div className={classNames('activity-panel-body', className)}>
      <ActivityFeedCardNew
        isForFeedTab
        isOpenInDrawer
        showThread
        activity={activity}
      />

      <div className="activity-feed-comments-container d-flex flex-col m-t-md">
        <Typography.Text className="activity-feed-comments-title m-b-md">
          {t('label.comment-plural')}
        </Typography.Text>

        {showFeedEditor ? (
          <ActivityFeedEditorNew
            className="m-t-md feed-editor activity-feed-editor-container-new m-b-md"
            onSave={onSave}
          />
        ) : (
          <div className="d-flex gap-2">
            <div>
              <UserPopOverCard userName={currentUser?.name ?? ''}>
                <div className="d-flex items-center">
                  <ProfilePicture
                    key={activity.id}
                    name={currentUser?.name ?? ''}
                    width="32"
                  />
                </div>
              </UserPopOverCard>
            </div>

            <Input
              className="comments-input-field"
              data-testid="comments-input-field"
              placeholder={t('message.input-placeholder')}
              onClick={() => setShowFeedEditor(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityPanelBody;

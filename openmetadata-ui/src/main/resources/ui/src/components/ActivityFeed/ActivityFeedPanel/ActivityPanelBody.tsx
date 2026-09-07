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

import classNames from 'classnames';
import { FC, lazy } from 'react';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import './feed-panel-body-v1.less';

const ActivityFeedCardNew = withSuspenseFallback(
  lazy(() => import('../ActivityFeedCardNew/ActivityFeedcardNew.component'))
);

interface ActivityPanelBodyProps {
  activity: ActivityEvent;
  className?: string;
}

const ActivityPanelBody: FC<ActivityPanelBodyProps> = ({
  activity,
  className,
}) => {
  return (
    <div className={classNames('activity-panel-body', className)}>
      <ActivityFeedCardNew
        isForFeedTab
        isOpenInDrawer
        showThread
        activity={activity}
      />
    </div>
  );
};

export default ActivityPanelBody;

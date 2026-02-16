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
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import CloseIcon from '../../../components/Modals/CloseIcon.component';
import { EntityType } from '../../../enums/entity.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  entityDisplayName,
  getActivityEventHeaderText,
  getEntityFQN,
  getEntityType,
} from '../../../utils/FeedUtils';

interface ActivityPanelHeaderProps {
  activity: ActivityEvent;
  className?: string;
  onCancel?: () => void;
  hideCloseIcon?: boolean;
}

const ActivityPanelHeader: FC<ActivityPanelHeaderProps> = ({
  activity,
  className,
  onCancel,
  hideCloseIcon = false,
}) => {
  const { t } = useTranslation();
  const entityType = getEntityType(activity.about ?? '') as EntityType;
  const entityFQN = getEntityFQN(activity.about ?? '');

  const headerText = getActivityEventHeaderText(
    activity.eventType,
    activity.fieldName,
    entityType
  );

  return (
    <header
      className={classNames(
        'd-flex justify-between items-center p-y-md',
        className
      )}>
      <p data-testid="header-title">
        <span data-testid="header-noun">
          {headerText} {t('label.on-lowercase')}{' '}
        </span>
        <span className="font-medium" data-testid="entity-attribute">
          <Link
            className="break-all"
            data-testid="entitylink"
            to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
            <span>
              {activity.entity
                ? getEntityName(activity.entity)
                : entityDisplayName(entityType, entityFQN)}
            </span>
          </Link>
        </span>
      </p>
      <div className="d-flex items-center">
        {hideCloseIcon ? null : (
          <CloseIcon dataTestId="closeDrawer" handleCancel={onCancel} />
        )}
      </div>
    </header>
  );
};

export default ActivityPanelHeader;

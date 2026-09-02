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

import { Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddIcon } from '../../../../../assets/svg/added-icon.svg';
import { ReactComponent as DeletedIcon } from '../../../../../assets/svg/deleted-icon.svg';
import {
  MAX_VISIBLE_OWNERS_FOR_FEED_CARD,
  MAX_VISIBLE_OWNERS_FOR_FEED_TAB,
} from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import { EntityReference } from '../../../../../generated/entity/type';
import { OwnerItem } from '../../../../common/OwnerItem/OwnerItem';
import { OwnerLabel } from '../../../../common/OwnerLabel/OwnerLabel.component';
import UserPopOverCard from '../../../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../../common/ProfilePicture/ProfilePicture';

interface ActivityOwnersFeedProps {
  activity: ActivityEvent;
  isForFeedTab?: boolean;
  showThread?: boolean;
}

function ActivityOwnersFeed({
  activity,
  isForFeedTab,
  showThread,
}: Readonly<ActivityOwnersFeedProps>) {
  const { t } = useTranslation();

  const { previousOwner, updatedOwner } = useMemo(() => {
    let oldOwners: EntityReference[] = [];
    let newOwners: EntityReference[] = [];

    try {
      if (activity.oldValue) {
        const parsed = JSON.parse(activity.oldValue);
        oldOwners = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      }
    } catch {
      oldOwners = [];
    }

    try {
      if (activity.newValue) {
        const parsed = JSON.parse(activity.newValue);
        newOwners = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      }
    } catch {
      newOwners = [];
    }

    const oldOwnerIds = new Set(oldOwners.map((o) => o.id));
    const newOwnerIds = new Set(newOwners.map((o) => o.id));

    const addedOwners = newOwners.filter((o) => !oldOwnerIds.has(o.id));
    const removedOwners = oldOwners.filter((o) => !newOwnerIds.has(o.id));

    return {
      previousOwner: removedOwners,
      updatedOwner: addedOwners,
    };
  }, [activity.oldValue, activity.newValue]);

  const maxVisibleOwners = useMemo(
    () =>
      isForFeedTab
        ? MAX_VISIBLE_OWNERS_FOR_FEED_TAB
        : MAX_VISIBLE_OWNERS_FOR_FEED_CARD,
    [isForFeedTab]
  );

  const getOwnerItems = useCallback(
    (ownerList: EntityReference[]) => {
      return ownerList.length <= maxVisibleOwners ? (
        <Row wrap align="middle">
          {ownerList.map((owner: EntityReference) =>
            owner.type === EntityType.USER ? (
              <UserPopOverCard key={owner.id} userName={owner.name ?? ''}>
                <div
                  className={`owner-chip d-flex items-center ${
                    showThread && 'bg-white'
                  }`}
                  key={owner.id}>
                  <ProfilePicture
                    displayName={owner.displayName}
                    name={owner.name ?? ''}
                    width="24"
                  />
                  <Typography.Text className="owner-chip-text">
                    {owner.displayName}
                  </Typography.Text>
                </div>
              </UserPopOverCard>
            ) : (
              <div
                className={classNames('owner-chip', {
                  'bg-white': showThread,
                })}
                key={owner.id}>
                <OwnerItem
                  isCompactView
                  avatarSize={24}
                  className="owner-chip-text"
                  owner={owner}
                />
              </div>
            )
          )}
        </Row>
      ) : (
        <OwnerLabel
          avatarSize={24}
          isCompactView={false}
          maxVisibleOwners={maxVisibleOwners}
          owners={ownerList}
          showLabel={false}
        />
      );
    },
    [maxVisibleOwners, showThread]
  );

  const renderUpdatedOwner = useMemo(
    () => getOwnerItems(updatedOwner),
    [updatedOwner, getOwnerItems]
  );

  const renderPreviousOwner = useMemo(
    () => getOwnerItems(previousOwner),
    [previousOwner, getOwnerItems]
  );

  return (
    <Row gutter={[8, 8]}>
      {!isEmpty(updatedOwner) && (
        <Col span={24}>
          <Row wrap align="middle">
            <Row align="middle">
              <AddIcon className="text-success-hover" height={16} width={16} />
              <Typography.Text className="owners-label">
                {t('label.owner-plural-with-colon')}
              </Typography.Text>
            </Row>

            <Col>{renderUpdatedOwner}</Col>
          </Row>
        </Col>
      )}
      {!isEmpty(previousOwner) && (
        <Col span={24}>
          <Row wrap align="middle">
            <Col>
              <Row align="middle">
                <DeletedIcon className="text-error" height={14} width={14} />
                <Typography.Text className="owners-label">
                  {t('label.owner-plural-with-colon')}
                </Typography.Text>
              </Row>
            </Col>
            <Col>{renderPreviousOwner}</Col>
          </Row>
        </Col>
      )}
    </Row>
  );
}

export default ActivityOwnersFeed;

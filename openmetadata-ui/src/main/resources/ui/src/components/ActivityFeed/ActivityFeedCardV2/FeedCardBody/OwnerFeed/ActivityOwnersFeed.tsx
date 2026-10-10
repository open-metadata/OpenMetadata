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

import {
  Box,
  Grid,
  Owner,
  OwnerChip,
  Typography,
} from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../../../utils/common/layout.utils';

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
import { toOwnerRef } from '../../../../../utils/Owner/ownerConversionUtils';
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
        if (Array.isArray(parsed)) {
          oldOwners = parsed;
        } else if (parsed) {
          oldOwners = [parsed];
        }
      }
    } catch {
      oldOwners = [];
    }

    try {
      if (activity.newValue) {
        const parsed = JSON.parse(activity.newValue);
        if (Array.isArray(parsed)) {
          newOwners = parsed;
        } else if (parsed) {
          newOwners = [parsed];
        }
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
        <Box align="center" className="layout-row" wrap="wrap">
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
                  <Typography className="owner-chip-text">
                    {owner.displayName}
                  </Typography>
                </div>
              </UserPopOverCard>
            ) : (
              <div
                className={classNames('owner-chip', {
                  'bg-white': showThread,
                })}
                key={owner.id}>
                <OwnerChip
                  avatarSize={24}
                  isCompactView={false}
                  owner={toOwnerRef(owner)}
                />
              </div>
            )
          )}
        </Box>
      ) : (
        <Owner
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
    <Grid
      className="layout-row layout-grid"
      style={{ ...getLayoutGutter(8, 8) }}>
      {!isEmpty(updatedOwner) && (
        <Grid.Item className="layout-column" span={24}>
          <Box align="center" className="layout-row" wrap="wrap">
            <Box align="center" className="layout-row" wrap="wrap">
              <AddIcon className="text-success-hover" height={16} width={16} />
              <Typography className="owners-label">
                {t('label.owner-plural-with-colon')}
              </Typography>
            </Box>

            <Box className="layout-column tw:block">{renderUpdatedOwner}</Box>
          </Box>
        </Grid.Item>
      )}
      {!isEmpty(previousOwner) && (
        <Grid.Item className="layout-column" span={24}>
          <Box align="center" className="layout-row" wrap="wrap">
            <Box className="layout-column tw:block">
              <Box align="center" className="layout-row" wrap="wrap">
                <DeletedIcon className="text-error" height={14} width={14} />
                <Typography className="owners-label">
                  {t('label.owner-plural-with-colon')}
                </Typography>
              </Box>
            </Box>
            <Box className="layout-column tw:block">{renderPreviousOwner}</Box>
          </Box>
        </Grid.Item>
      )}
    </Grid>
  );
}

export default ActivityOwnersFeed;

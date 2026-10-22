/*
 *  Copyright 2026 Collate.
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
import { AxiosError } from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  addServiceFollower,
  removeServiceFollower,
} from '../../../rest/serviceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { FollowStarIcon } from '../../DataAssets/DataAssetsHeader/FollowStarIcon.component';
import { StatItem } from '../../DataAssets/DataAssetsHeader/StatItem.component';

interface ServiceFollowButtonProps {
  serviceId: string;
  serviceName: string;
  followers: EntityReference[];
  onFollowersChange: (followers: EntityReference[]) => void;
}

/**
 * Follow / unfollow the service, as the classic service header does. The followers endpoint
 * exists for database services only, so the page offers this for those alone.
 */
export const ServiceFollowButton = ({
  serviceId,
  serviceName,
  followers,
  onFollowersChange,
}: ServiceFollowButtonProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const userId = currentUser?.id ?? '';
  const [isUpdating, setIsUpdating] = useState(false);

  const isFollowing = useMemo(
    () => followers.some(({ id }) => id === userId),
    [followers, userId]
  );

  const handleFollowClick = useCallback(async () => {
    setIsUpdating(true);
    try {
      if (isFollowing) {
        await removeServiceFollower(serviceId, userId);
        onFollowersChange(followers.filter(({ id }) => id !== userId));
      } else {
        const res = await addServiceFollower(serviceId, userId);
        onFollowersChange([
          ...followers,
          ...res.changeDescription.fieldsAdded[0].newValue,
        ]);
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t(
          isFollowing
            ? 'server.entity-unfollow-error'
            : 'server.entity-follow-error',
          { entity: serviceName }
        )
      );
    } finally {
      setIsUpdating(false);
    }
  }, [
    isFollowing,
    serviceId,
    userId,
    followers,
    onFollowersChange,
    serviceName,
    t,
  ]);

  const followLabel = t(isFollowing ? 'label.un-follow' : 'label.follow');

  return (
    <StatItem
      iconNode={
        <FollowStarIcon className="tw:size-[29px]" selected={isFollowing} />
      }
      loading={isUpdating}
      srLabel={followLabel}
      testId="entity-follow-button"
      tooltip={followLabel}
      onClick={handleFollowClick}
    />
  );
};

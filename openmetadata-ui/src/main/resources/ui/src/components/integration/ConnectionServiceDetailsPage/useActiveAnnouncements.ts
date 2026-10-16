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
import { useCallback, useEffect, useRef, useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import {
  AnnouncementEntity,
  getActiveAnnouncements,
} from '../../../rest/announcementsAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

/**
 * The entity's announcements that are active now, for the banner under its header. `refetch`
 * reloads them, e.g. once the announcement drawer has closed after an edit.
 */
export const useActiveAnnouncements = (entityType: EntityType, fqn: string) => {
  const [announcements, setAnnouncements] = useState<AnnouncementEntity[]>([]);
  // Only the latest request may write: a slower one for the previous service would replace it.
  const latestRequestRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    if (!fqn) {
      setAnnouncements([]);

      return;
    }
    try {
      const response = await getActiveAnnouncements(
        getEntityFeedLink(entityType, fqn)
      );
      if (requestId === latestRequestRef.current) {
        setAnnouncements(response.data ?? []);
      }
    } catch (error) {
      if (requestId === latestRequestRef.current) {
        showErrorToast(error as AxiosError);
      }
    }
  }, [entityType, fqn]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { announcements, refetch };
};

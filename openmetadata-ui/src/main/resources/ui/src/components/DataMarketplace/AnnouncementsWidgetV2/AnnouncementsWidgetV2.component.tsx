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

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import {
  AnnouncementEntity,
  getActiveAnnouncements,
} from '../../../rest/announcementsAPI';
import {
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from '../../../utils/FeedUtils';
import AnnouncementsWidgetV2Body from '../../common/AnnouncementsWidget/AnnouncementsWidgetV2Body.component';

const DUMMY_ANNOUNCEMENTS: AnnouncementEntity[] = [
  {
    id: 'dummy-1',
    name: 'upcoming-customer-insights',
    displayName: "Upcoming changes to the 'Customer Insights' data product",
    description:
      "The 'Customer Insights' data product will be updated to remove the 'Demographics' asset.",
    entityLink: '<#E::dataProduct::customer-insights>',
    startTime: Date.now(),
    endTime: Date.now() + 86400000,
    createdBy: 'governance-bot',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'dummy-2',
    name: 'deprecate-location-field',
    displayName:
      "Deprecation of 'Location' field in the 'Customer Demographics' dataset",
    description:
      "Important: Retirement of 'Customer Location' attribute in the 'Global Customers' dataset",
    entityLink: '<#E::domain::customer-demographics>',
    startTime: Date.now(),
    endTime: Date.now() + 86400000,
    createdBy: 'governance-bot',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const AnnouncementsWidgetV2 = ({ isEditView }: WidgetCommonProps) => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<AnnouncementEntity[]>(
    isEditView ? DUMMY_ANNOUNCEMENTS : []
  );
  const [loading, setLoading] = useState(!isEditView);

  const fetchAnnouncements = useCallback(async () => {
    if (isEditView) {
      return;
    }
    setLoading(true);
    try {
      const res = await getActiveAnnouncements();
      const filtered = (res.data ?? []).filter((announcement) => {
        const type = getEntityType(announcement.entityLink ?? '');

        return type === EntityType.DOMAIN || type === EntityType.DATA_PRODUCT;
      });
      setAnnouncements(filtered);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [isEditView]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleAnnouncementClick = useCallback(
    (announcement: AnnouncementEntity) => {
      if (isEditView) {
        return;
      }
      const entityType = getEntityType(announcement.entityLink ?? '');
      const entityFQN = getEntityFQN(announcement.entityLink ?? '');

      if (entityType && entityFQN) {
        navigate(prepareFeedLink(entityType, entityFQN));
      }
    },
    [navigate, isEditView]
  );

  return (
    <AnnouncementsWidgetV2Body
      announcements={announcements}
      className="tw:mb-5"
      loading={loading}
      onItemClick={handleAnnouncementClick}
    />
  );
};

export default AnnouncementsWidgetV2;

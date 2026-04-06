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

import { Typography } from '@openmetadata/ui-core-components';
import { Announcement02, ChevronDown } from '@untitledui/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { Thread } from '../../../generated/entity/feed/thread';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getActiveAnnouncement } from '../../../rest/feedsAPI';
import {
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from '../../../utils/FeedUtils';
import Loader from '../../common/Loader/Loader';
import AnnouncementItemV2 from './AnnouncementItemV2.component';

const DISPLAY_COUNT = 4;

const DUMMY_ANNOUNCEMENTS: Thread[] = [
  {
    id: 'dummy-1',
    message: "Upcoming changes to the 'Customer Insights' data product",
    announcement: {
      description:
        "The 'Customer Insights' data product will be updated to remove the 'Demographics' asset.",
      startTime: Date.now(),
      endTime: Date.now() + 86400000,
    },
    about: '<#E::dataProduct::customer-insights>',
  } as Thread,
  {
    id: 'dummy-2',
    message:
      "Deprecation of 'Location' field in the 'Customer Demographics' dataset",
    announcement: {
      description:
        "Important: Retirement of 'Customer Location' attribute in the 'Global Customers' dataset",
      startTime: Date.now(),
      endTime: Date.now() + 86400000,
    },
    about: '<#E::domain::customer-demographics>',
  } as Thread,
];

const AnnouncementsWidgetV2 = ({ isEditView }: WidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Thread[]>(
    isEditView ? DUMMY_ANNOUNCEMENTS : []
  );
  const [loading, setLoading] = useState(!isEditView);
  const [showAll, setShowAll] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    if (isEditView) {
      return;
    }
    setLoading(true);
    try {
      const res = await getActiveAnnouncement();
      const filtered = (res.data ?? []).filter((thread: Thread) => {
        const type = getEntityType(thread.about);

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

  const displayedAnnouncements = useMemo(
    () => (showAll ? announcements : announcements.slice(0, DISPLAY_COUNT)),
    [announcements, showAll]
  );

  const handleAnnouncementClick = useCallback(
    (announcement: Thread) => {
      if (isEditView) {
        return;
      }
      const entityType = getEntityType(announcement.about);
      const entityFQN = getEntityFQN(announcement.about);

      if (entityType && entityFQN) {
        navigate(prepareFeedLink(entityType, entityFQN));
      }
    },
    [navigate, isEditView]
  );

  if (loading) {
    return (
      <div
        className="tw:rounded-xl tw:border tw:border-border-primary tw:bg-utility-blue-100 tw:px-1 tw:pt-3 tw:pb-1"
        data-testid="announcements-widget-v2">
        <Loader size="small" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return null;
  }

  return (
    <div
      className="tw:rounded-xl tw:border tw:border-border-primary tw:bg-utility-blue-100 tw:px-1 tw:pt-3 tw:pb-1 tw:mb-5"
      data-testid="announcements-widget-v2">
      <div className="tw:flex tw:items-center tw:justify-between tw:mb-2 tw:px-3">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Announcement02 className="tw:size-5 tw:text-fg-brand-primary" />
          <Typography
            as="span"
            className="tw:text-text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.announcement-plural')}
          </Typography>
          <Typography
            as="span"
            className="tw:rounded-md tw:bg-bg-primary tw:px-2 tw:py-0.5 tw:text-text-tertiary"
            size="text-sm"
            weight="medium">
            {String(announcements.length).padStart(2, '0')}
          </Typography>
        </div>
      </div>

      <div className="tw:rounded-lg tw:bg-bg-primary tw:px-4 tw:py-1">
        <div className="tw:divide-y tw:divide-border-primary">
          {displayedAnnouncements.map((announcement) => (
            <AnnouncementItemV2
              announcement={announcement}
              key={announcement.id}
              onClick={() => handleAnnouncementClick(announcement)}
            />
          ))}
        </div>

        {announcements.length > DISPLAY_COUNT && (
          <button
            className="tw:flex tw:items-center tw:gap-1 tw:py-3 tw:text-sm tw:font-medium tw:text-fg-brand-primary tw:cursor-pointer tw:border-none tw:bg-transparent"
            data-testid="view-all-btn"
            onClick={() => setShowAll((prev) => !prev)}>
            {showAll ? t('label.show-less') : t('label.view-all')}
            <ChevronDown
              className={`tw:size-4 tw:transition-transform ${
                showAll ? 'tw:rotate-180' : ''
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsWidgetV2;

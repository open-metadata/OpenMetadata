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

import {
  Box,
  Button,
  FeaturedIcon,
  SlideoutMenu,
  Tabs,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Announcement02 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementStatus } from '../../../../generated/entity/feed/announcement';
import {
  deleteAnnouncement,
  patchAnnouncement,
} from '../../../../rest/announcementsAPI';
import { ANNOUNCEMENT_STATUS_LABEL_KEYS } from '../../../../utils/AnnouncementsUtils';
import { getEntityFeedLink } from '../../../../utils/EntityPureUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import AnnouncementThreadBody from '../../../Announcement/AnnouncementThreadBody.component';
import AddAnnouncementModal from '../../../Modals/AnnouncementModal/AddAnnouncementModal';

interface Props {
  open: boolean;
  entityType: string;
  entityFQN: string;
  createPermission: boolean;
  onClose: () => void;
}

const ALL_TAB = 'all';

const STATUS_TABS = [
  AnnouncementStatus.Active,
  AnnouncementStatus.Expired,
  AnnouncementStatus.Scheduled,
];

const AnnouncementDrawer: FC<Props> = ({
  open,
  onClose,
  entityFQN,
  entityType,
  createPermission = false,
}) => {
  const { t } = useTranslation();
  const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] =
    useState<boolean>(false);
  const [refetchThread, setRefetchThread] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);

  const statusFilter = useMemo(
    () =>
      activeTab === ALL_TAB ? undefined : (activeTab as AnnouncementStatus),
    [activeTab]
  );

  const deletePostHandler = async (announcementId: string): Promise<void> => {
    try {
      await deleteAnnouncement(announcementId, true);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const updateThreadHandler = async (
    announcementId: string,
    data: Operation[]
  ): Promise<void> => {
    try {
      if (data.length === 0) {
        return;
      }

      await patchAnnouncement(announcementId, data);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const handleCloseAnnouncementModal = useCallback(
    () => setIsAddAnnouncementOpen(false),
    []
  );
  const handleOpenAnnouncementModal = useCallback(
    () => setIsAddAnnouncementOpen(true),
    []
  );

  const handleSaveAnnouncement = useCallback(() => {
    handleCloseAnnouncementModal();
    setRefetchThread((prev) => !prev);
  }, [handleCloseAnnouncementModal]);

  const title = (
    <Box align="start" className="tw:w-full tw:gap-3" data-testid="title">
      {/* The same framed icon the add/edit dialog puts in its header, so the
          two headers read as one component. */}
      <FeaturedIcon
        color="gray"
        icon={Announcement02}
        size="md"
        theme="modern"
      />
      <Box className="tw:min-w-0 tw:flex-1 tw:gap-0.5" direction="col">
        <Typography
          as="span"
          className="tw:text-primary"
          size="text-md"
          weight="semibold">
          {t('label.announcement-plural')}
        </Typography>
        <Typography as="span" className="tw:text-secondary" size="text-xs">
          {t('message.view-edit-and-schedule-announcements')}
        </Typography>
      </Box>

      {/* Suppressed via `isDisabled`, not by blanking the title: an empty
          title still renders the bubble, which shows up as a small black dot
          next to the button. */}
      <Tooltip
        isDisabled={createPermission}
        title={t('message.no-permission-to-view')}>
        <Button
          data-testid="add-announcement"
          isDisabled={!createPermission}
          size="sm"
          onClick={handleOpenAnnouncementModal}>
          {t('label.add-entity', { entity: t('label.announcement') })}
        </Button>
      </Tooltip>
    </Box>
  );

  return (
    <SlideoutMenu
      isDismissable
      data-testid="announcement-drawer"
      isOpen={open}
      width={576}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      {/* The close button is absolutely positioned at `right-3` and is 40px
          wide, so the header has to reserve ~52px. It must be reserved at the
          `md` breakpoint too: core sets `tw:md:px-6`, and a media-query rule
          beats an unprefixed `tw:pr-*` regardless of class order — which is
          why an unprefixed reserve silently collapses to 24px on desktop and
          the close button sits on top of Add Announcement. */}
      <SlideoutMenu.Header
        className="tw:border-b tw:border-subtle tw:pr-16 tw:pb-5 tw:md:pr-16"
        onClose={onClose}>
        {title}
      </SlideoutMenu.Header>

      <SlideoutMenu.Content className="tw:gap-4 tw:pb-6">
        {/* A real tab list, not toggle buttons: these switch which
            announcements the body below shows, which is what `role="tab"`
            means, and core's `Tabs` brings the arrow-key navigation and
            roving tab stop with it. `button-brand` already carries the frame's
            selected colours — brand fill, brand label — so only the pill shape
            and the edge are added per item, with the resting grey fill and the
            darker resting label. The edge is a `border` rather than an
            `outline` because a `Tab` reserves its outline for the focus ring.
            Test ids are keyed on the status value, not the label, since
            `Expired` is shown as "In-Active". */}
        <Tabs
          className="tw:w-auto"
          data-testid="announcement-status-tabs"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(String(key))}>
          <Tabs.List className="tw:flex-wrap tw:gap-2" size="sm">
            {[ALL_TAB, ...STATUS_TABS].map((status) => (
              <Tabs.Item
                className={({ isHovered, isSelected }) =>
                  classNames('tw:rounded-lg tw:border', {
                    'tw:border-brand-subtle': isSelected || isHovered,
                    'tw:border-secondary tw:bg-secondary tw:text-secondary':
                      !isSelected && !isHovered,
                  })
                }
                data-testid={`announcement-status-${status}`}
                id={status}
                key={status}>
                {status === ALL_TAB
                  ? t('label.all')
                  : t(
                      ANNOUNCEMENT_STATUS_LABEL_KEYS[
                        status as AnnouncementStatus
                      ]
                    )}
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>

        <AnnouncementThreadBody
          deleteAnnouncementHandler={deletePostHandler}
          editPermission={createPermission}
          refetchThread={refetchThread}
          statusFilter={statusFilter}
          threadLink={getEntityFeedLink(entityType, entityFQN)}
          updateAnnouncementHandler={updateThreadHandler}
        />

        {isAddAnnouncementOpen && (
          <AddAnnouncementModal
            entityFQN={entityFQN || ''}
            entityType={entityType || ''}
            open={isAddAnnouncementOpen}
            onCancel={handleCloseAnnouncementModal}
            onSave={handleSaveAnnouncement}
          />
        )}
      </SlideoutMenu.Content>
    </SlideoutMenu>
  );
};

export default AnnouncementDrawer;

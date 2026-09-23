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
  ButtonGroup,
  ButtonGroupItem,
  SlideoutMenu,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Announcement02 } from '@untitledui/icons';
import { AxiosError } from 'axios';
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
      <Announcement02 className="tw:mt-0.5 tw:size-5 tw:shrink-0 tw:text-fg-brand-primary" />
      <Box className="tw:min-w-0 tw:flex-1 tw:gap-0.5" direction="col">
        <Typography
          as="span"
          className="tw:text-text-primary"
          size="text-md"
          weight="semibold">
          {t('label.announcement-plural')}
        </Typography>
        <Typography as="span" className="tw:text-text-secondary" size="text-xs">
          {t('message.view-edit-and-schedule-announcements')}
        </Typography>
      </Box>

      <Tooltip
        title={!createPermission ? t('message.no-permission-to-view') : ''}>
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
      <SlideoutMenu.Header className="tw:pr-12" onClose={onClose}>
        {title}
      </SlideoutMenu.Header>

      <SlideoutMenu.Content className="tw:gap-4 tw:pb-6">
        <ButtonGroup
          className="tw:mb-4"
          data-testid="announcement-status-tabs"
          selectedKeys={[activeTab]}
          size="sm"
          onSelectionChange={(keys) => {
            const [selected] = Array.from(keys);
            // react-aria clears the selection when the active item is clicked
            // again; keeping the current tab avoids an unfiltered flash.
            setActiveTab((prev) => (selected as string) ?? prev);
          }}>
          {/* Test ids are keyed on the status value, not the label: `Expired`
              is shown as "In-Active", and react-aria renders these as radios
              rather than buttons, so a role+name lookup is the wrong hook. */}
          <ButtonGroupItem
            data-testid={`announcement-status-${ALL_TAB}`}
            id={ALL_TAB}>
            {t('label.all')}
          </ButtonGroupItem>
          {STATUS_TABS.map((status) => (
            <ButtonGroupItem
              data-testid={`announcement-status-${status}`}
              id={status}
              key={status}>
              {t(ANNOUNCEMENT_STATUS_LABEL_KEYS[status])}
            </ButtonGroupItem>
          ))}
        </ButtonGroup>

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

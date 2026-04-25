/*
 *  Copyright 2022 Collate.
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

import { CloseOutlined } from '@ant-design/icons';
import { Button, Drawer, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deleteAnnouncement,
  patchAnnouncement,
} from '../../../../rest/announcementsAPI';
import { getEntityFeedLink } from '../../../../utils/EntityUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import AnnouncementThreadBody from '../../../Announcement/AnnouncementThreadBody.component';
import AddAnnouncementModal from '../../../Modals/AnnouncementModal/AddAnnouncementModal';

interface Props {
  open: boolean;
  entityType: string;
  entityFQN: string;
  createPermission: boolean;
  onClose: () => void;
  showToastInSnackbar?: boolean;
}

const AnnouncementDrawer: FC<Props> = ({
  open,
  onClose,
  entityFQN,
  entityType,
  createPermission = false,
  showToastInSnackbar = false,
}) => {
  const { t } = useTranslation();
  const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] =
    useState<boolean>(false);
  const [refetchThread, setRefetchThread] = useState<boolean>(false);

  const title = (
    <Space
      align="start"
      className="justify-between"
      data-testid="title"
      style={{ width: '100%' }}>
      <Typography.Text className="font-medium break-all">
        {t('label.announcement-plural')}
      </Typography.Text>
      <CloseOutlined data-testid="announcement-close" onClick={onClose} />
    </Space>
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
  }, []);

  return (
    <Drawer
      closable={false}
      data-testid="announcement-drawer"
      open={open}
      placement="right"
      title={title}
      width={576}
      onClose={onClose}>
      <div className="d-flex justify-end">
        <Tooltip
          title={!createPermission && t('message.no-permission-to-view')}>
          <Button
            data-testid="add-announcement"
            disabled={!createPermission}
            type="primary"
            onClick={handleOpenAnnouncementModal}>
            {t('label.add-entity', { entity: t('label.announcement') })}
          </Button>
        </Tooltip>
      </div>

      <AnnouncementThreadBody
        deleteAnnouncementHandler={deletePostHandler}
        editPermission={createPermission}
        refetchThread={refetchThread}
        threadLink={getEntityFeedLink(entityType, entityFQN)}
        updateAnnouncementHandler={updateThreadHandler}
      />

      {isAddAnnouncementOpen && (
        <AddAnnouncementModal
          entityFQN={entityFQN || ''}
          entityType={entityType || ''}
          open={isAddAnnouncementOpen}
          showToastInSnackbar={showToastInSnackbar}
          onCancel={handleCloseAnnouncementModal}
          onSave={handleSaveAnnouncement}
        />
      )}
    </Drawer>
  );
};

export default AnnouncementDrawer;

/*
 *  Copyright 2021 Collate
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
import { Button, Drawer, Space, Typography } from 'antd';
import React, { FC, useState } from 'react';
import AddAnnouncementModal from '../../../Modals/AddAnnouncementModal/AddAnnouncementModal';

interface Props {
  open: boolean;
  entityType: string;
  entityFQN: string;
  entityName: string;
  onClose: () => void;
}

const AnnouncementDrawer: FC<Props> = ({
  open,
  onClose,
  entityFQN,
  entityType,
  entityName,
}) => {
  const [isAnnouncement, setIsAnnouncement] = useState<boolean>(false);

  const title = (
    <Space className="tw-justify-between" style={{ width: '100%' }}>
      <Typography.Text>Announcement on {entityName}</Typography.Text>
      <CloseOutlined onClick={onClose} />
    </Space>
  );

  return (
    <>
      <Drawer
        closable={false}
        placement="right"
        title={title}
        visible={open}
        width={576}
        onClose={onClose}>
        <div className="tw-flex tw-justify-end">
          <Button type="primary" onClick={() => setIsAnnouncement(true)}>
            Add Announcement
          </Button>
        </div>
      </Drawer>

      {isAnnouncement && (
        <AddAnnouncementModal
          entityFQN={entityFQN || ''}
          entityType={entityType || ''}
          open={isAnnouncement}
          onCancel={() => setIsAnnouncement(false)}
        />
      )}
    </>
  );
};

export default AnnouncementDrawer;

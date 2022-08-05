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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Dropdown, Menu, Space } from 'antd';
import React, { FC, useState } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { ANNOUNCEMENT_ENTITIES } from '../../../../utils/AnnouncementsUtils';
import SVGIcons, { Icons } from '../../../../utils/SvgUtils';
import DeleteWidgetModal from '../../DeleteWidget/DeleteWidgetModal';

interface Props {
  entityName: string;
  entityId?: string;
  entityType?: string;
  entityFQN?: string;
  onAnnouncementClick: () => void;
}

const ManageButton: FC<Props> = ({
  entityName,
  entityType,
  entityId,
  onAnnouncementClick,
}) => {
  const [showActions, setShowActions] = useState<boolean>(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);

  const menu = (
    <Menu
      items={[
        {
          label: (
            <Space
              className="tw-cursor-pointer manage-button"
              size={8}
              onClick={(e) => {
                e.stopPropagation();
                setIsDelete(true);
                setShowActions(false);
              }}>
              <SVGIcons alt="Delete" icon={Icons.DELETE_GRADIANT} />
              <div className="tw-text-left" data-testid="delete-button">
                <p className="tw-font-medium">
                  Delete {entityType} {entityName}
                </p>
                <p className="tw-text-grey-muted tw-text-xs">
                  Deleting this {entityType} will permanently remove its
                  metadata from OpenMetadata.
                </p>
              </div>
            </Space>
          ),
          key: 'delete-button',
        },
        ...(ANNOUNCEMENT_ENTITIES.includes(entityType as EntityType)
          ? [
              {
                label: (
                  <Space
                    className="tw-cursor-pointer manage-button"
                    size={8}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActions(false);
                      onAnnouncementClick();
                    }}>
                    <SVGIcons alt="Delete" icon={Icons.ANNOUNCEMENT} />
                    <div
                      className="tw-text-left"
                      data-testid="announcement-button">
                      <p className="tw-font-medium">Manage Announcement</p>
                      <p className="tw-text-grey-muted tw-text-xs">
                        Set up banners to inform your team of upcoming
                        maintenance, updates, &amp; deletions.
                      </p>
                    </div>
                  </Space>
                ),
                key: 'announcement-button',
              },
            ]
          : []),
      ]}
    />
  );

  return (
    <>
      <Dropdown
        arrow
        align={{ targetOffset: [-12, 8] }}
        overlay={menu}
        overlayStyle={{ width: '400px' }}
        placement="bottomRight"
        trigger={['click']}
        visible={showActions}
        onVisibleChange={setShowActions}>
        <Button
          className="tw-rounded tw-flex tw-border tw-border-primary"
          data-testid="manage-button"
          size="small"
          type="default"
          onClick={() => setShowActions(true)}>
          <FontAwesomeIcon
            className="tw-text-primary tw-self-center"
            icon="ellipsis-vertical"
          />
        </Button>
      </Dropdown>
      {isDelete && (
        <DeleteWidgetModal
          entityId={entityId || ''}
          entityName={entityName || ''}
          entityType={entityType || ''}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
        />
      )}
    </>
  );
};

export default ManageButton;

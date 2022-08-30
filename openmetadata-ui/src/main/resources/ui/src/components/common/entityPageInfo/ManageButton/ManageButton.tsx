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
import classNames from 'classnames';
import React, { FC, useState } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { ANNOUNCEMENT_ENTITIES } from '../../../../utils/AnnouncementsUtils';
import SVGIcons, { Icons } from '../../../../utils/SvgUtils';
import DeleteWidgetModal from '../../DeleteWidget/DeleteWidgetModal';
import './ManageButton.less';

interface Props {
  allowSoftDelete?: boolean;
  afterDeleteAction?: () => void;
  buttonClassName?: string;
  disabled?: boolean;
  entityName: string;
  entityId?: string;
  entityType?: string;
  entityFQN?: string;
  isRecursiveDelete?: boolean;
  deleteMessage?: string;
  title?: string;
  onAnnouncementClick?: () => void;
}

const ManageButton: FC<Props> = ({
  allowSoftDelete,
  afterDeleteAction,
  buttonClassName,
  deleteMessage,
  disabled,
  entityName,
  entityType,
  entityId,
  isRecursiveDelete,
  title,
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
              <SVGIcons alt="Delete" icon={Icons.DELETE} />
              <div className="tw-text-left" data-testid="delete-button">
                <p className="tw-font-medium" data-testid="delete-button-title">
                  Delete
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
                      onAnnouncementClick && onAnnouncementClick();
                    }}>
                    <SVGIcons
                      alt="announcement"
                      icon={Icons.ANNOUNCEMENT_BLACK}
                    />
                    <div
                      className="tw-text-left"
                      data-testid="announcement-button">
                      <p className="tw-font-medium">Announcements</p>
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
        align={{ targetOffset: [-12, 0] }}
        disabled={disabled}
        overlay={menu}
        overlayStyle={{ width: '350px' }}
        placement="bottomRight"
        trigger={['click']}
        visible={showActions}
        onVisibleChange={setShowActions}>
        <Button
          className={classNames(
            'tw-rounded tw-flex tw-justify-center tw-w-6 manage-dropdown-button',
            buttonClassName
          )}
          data-testid="manage-button"
          disabled={disabled}
          size="small"
          title={title ?? 'Manage'}
          type="default"
          onClick={() => setShowActions(true)}>
          <FontAwesomeIcon
            className="tw-text-primary tw-self-center manage-dropdown-icon"
            icon="ellipsis-vertical"
          />
        </Button>
      </Dropdown>
      {isDelete && (
        <DeleteWidgetModal
          afterDeleteAction={afterDeleteAction}
          allowSoftDelete={allowSoftDelete}
          deleteMessage={deleteMessage}
          entityId={entityId || ''}
          entityName={entityName || ''}
          entityType={entityType || ''}
          isRecursiveDelete={isRecursiveDelete}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
        />
      )}
    </>
  );
};

export default ManageButton;

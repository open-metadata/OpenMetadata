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

import { Button, Col, Dropdown, Modal, Row, Tooltip, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconAnnouncementsBlack } from '../../../../assets/svg/announcements-black.svg';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconRestore } from '../../../../assets/svg/ic-restore.svg';
import { ReactComponent as IconSetting } from '../../../../assets/svg/ic-settings-gray.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { DROPDOWN_ICON_SIZE_PROPS } from '../../../../constants/ManageButton.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { ANNOUNCEMENT_ENTITIES } from '../../../../utils/AnnouncementsUtils';
import EntityNameModal from '../../../Modals/EntityNameModal/EntityNameModal.component';
import { EntityName } from '../../../Modals/EntityNameModal/EntityNameModal.interface';
import { DeleteOption } from '../../DeleteWidget/DeleteWidget.interface';
import DeleteWidgetModal from '../../DeleteWidget/DeleteWidgetModal';
import { ManageButtonItemLabel } from '../../ManageButtonContentItem/ManageButtonContentItem.component';
import './ManageButton.less';

interface Props {
  allowSoftDelete?: boolean;
  afterDeleteAction?: (isSoftDelete?: boolean) => void;
  buttonClassName?: string;
  entityName: string;
  entityId?: string;
  entityType: EntityType;
  displayName?: string;
  entityFQN?: string;
  isRecursiveDelete?: boolean;
  deleteMessage?: string;
  softDeleteMessagePostFix?: string;
  hardDeleteMessagePostFix?: string;
  canDelete?: boolean;
  extraDropdownContent?: ItemType[];
  onAnnouncementClick?: () => void;
  onRestoreEntity?: () => Promise<void>;
  deleted?: boolean;
  editDisplayNamePermission?: boolean;
  onEditDisplayName?: (data: EntityName) => Promise<void>;
  allowRename?: boolean;
  prepareType?: boolean;
  successMessage?: string;
  deleteButtonDescription?: string;
  deleteOptions?: DeleteOption[];
  onProfilerSettingUpdate?: () => void;
}

const ManageButton: FC<Props> = ({
  allowSoftDelete,
  afterDeleteAction,
  buttonClassName,
  deleteMessage,
  softDeleteMessagePostFix,
  hardDeleteMessagePostFix,
  entityName,
  displayName,
  entityType,
  canDelete,
  entityId,
  isRecursiveDelete,
  extraDropdownContent,
  onAnnouncementClick,
  onRestoreEntity,
  deleted,
  editDisplayNamePermission,
  onEditDisplayName,
  allowRename,
  prepareType = true,
  successMessage,
  deleteButtonDescription,
  deleteOptions,
  onProfilerSettingUpdate,
}) => {
  const { t } = useTranslation();
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isEntityRestoring, setIsEntityRestoring] = useState<boolean>(false);
  const [showReactiveModal, setShowReactiveModal] = useState(false);
  const [isDisplayNameEditing, setIsDisplayNameEditing] = useState(false);

  const isProfilerSupported = useMemo(
    () =>
      [EntityType.DATABASE, EntityType.DATABASE_SCHEMA].includes(
        entityType as EntityType
      ) && !deleted,
    [entityType, deleted]
  );

  const handleRestore = async () => {
    try {
      setIsEntityRestoring(true);
      onRestoreEntity && (await onRestoreEntity());
      setShowReactiveModal(false);
    } finally {
      setIsEntityRestoring(false);
    }
  };

  const handleDisplayNameUpdate = (data: EntityName) => {
    if (onEditDisplayName) {
      onEditDisplayName(data)
        .then(() => {
          setIsDisplayNameEditing(false);
        })
        .catch(() => {
          // do nothing
        });
    }
  };

  const showAnnouncementOption = useMemo(
    () =>
      onAnnouncementClick &&
      ANNOUNCEMENT_ENTITIES.includes(entityType as EntityType) &&
      !deleted,
    [onAnnouncementClick, entityType, deleted]
  );

  const showRenameOption = useMemo(
    () => editDisplayNamePermission && onEditDisplayName && !deleted,
    [editDisplayNamePermission, onEditDisplayName, deleted]
  );

  const renderDropdownContainer = useCallback((menus) => {
    return <div data-testid="manage-dropdown-list-container">{menus}</div>;
  }, []);

  const items: ItemType[] = [
    ...(deleted
      ? ([
          {
            label: (
              <Tooltip title={canDelete ? '' : NO_PERMISSION_FOR_ACTION}>
                <ManageButtonItemLabel
                  description={t('message.restore-action-description', {
                    entityType,
                  })}
                  icon={
                    <IconRestore
                      className="m-t-xss"
                      name="Restore"
                      {...DROPDOWN_ICON_SIZE_PROPS}
                    />
                  }
                  id="restore-button"
                  name={t('label.restore')}
                />
              </Tooltip>
            ),
            onClick: (e) => {
              if (canDelete) {
                e.domEvent.stopPropagation();
                setShowReactiveModal(true);
              }
            },
            key: 'restore-button',
          },
        ] as ItemType[])
      : []),

    ...(showAnnouncementOption
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.announcement-action-description')}
                icon={
                  <IconAnnouncementsBlack
                    className="m-t-xss"
                    name="announcement"
                    {...DROPDOWN_ICON_SIZE_PROPS}
                  />
                }
                id="announcement-button"
                name={t('label.announcement-plural')}
              />
            ),
            onClick: (e) => {
              e.domEvent.stopPropagation();
              !isUndefined(onAnnouncementClick) && onAnnouncementClick();
            },
            key: 'announcement-button',
          },
        ] as ItemType[])
      : []),

    ...(showRenameOption
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.update-displayName-entity', {
                  entity: entityName,
                })}
                icon={<EditIcon width="18px" />}
                id="rename-button"
                name={t('label.rename')}
              />
            ),
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsDisplayNameEditing(true);
            },
            key: 'rename-button',
          },
        ] as ItemType[])
      : []),
    ...(extraDropdownContent ?? []),
    ...(isProfilerSupported
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={
                  deleteButtonDescription ??
                  t('message.update-profiler-settings')
                }
                icon={
                  <IconSetting
                    className="m-t-xss"
                    {...DROPDOWN_ICON_SIZE_PROPS}
                    name="Profiler Settings"
                  />
                }
                id="profiler-setting-button"
                name={t('label.profiler-setting-plural')}
              />
            ),
            onClick: (e) => {
              e.domEvent.stopPropagation();
              onProfilerSettingUpdate?.();
            },
            key: 'profiler-setting-button',
          },
        ] as ItemType[])
      : []),
    ...(canDelete
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={
                  deleteButtonDescription ??
                  t('message.delete-entity-type-action-description', {
                    entityType,
                  })
                }
                icon={
                  <IconDelete
                    className="m-t-xss"
                    {...DROPDOWN_ICON_SIZE_PROPS}
                    name="Delete"
                  />
                }
                id="delete-button"
                name={t('label.delete')}
              />
            ),
            onClick: (e) => {
              if (canDelete) {
                e.domEvent.stopPropagation();
                setIsDelete(true);
              }
            },
            key: 'delete-button',
          },
        ] as ItemType[])
      : []),
  ];

  return (
    <>
      {items.length ? (
        <Dropdown
          align={{ targetOffset: [-12, 0] }}
          dropdownRender={renderDropdownContainer}
          menu={{ items }}
          overlayClassName="manage-dropdown-list-container"
          overlayStyle={{ width: '350px' }}
          placement="bottomRight"
          trigger={['click']}>
          <Button
            className={classNames('flex-center px-1.5', buttonClassName)}
            data-testid="manage-button"
            title="Manage"
            type="default">
            <IconDropdown className="anticon self-center manage-dropdown-icon" />
          </Button>
        </Dropdown>
      ) : (
        <></>
      )}
      {isDelete && (
        <DeleteWidgetModal
          afterDeleteAction={afterDeleteAction}
          allowSoftDelete={allowSoftDelete}
          deleteMessage={deleteMessage}
          deleteOptions={deleteOptions}
          entityId={entityId ?? ''}
          entityName={entityName ?? ''}
          entityType={entityType}
          hardDeleteMessagePostFix={hardDeleteMessagePostFix}
          isRecursiveDelete={isRecursiveDelete}
          prepareType={prepareType}
          softDeleteMessagePostFix={softDeleteMessagePostFix}
          successMessage={successMessage}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
        />
      )}
      {onEditDisplayName && isDisplayNameEditing && (
        <EntityNameModal
          allowRename={allowRename}
          entity={{
            name: entityName,
            displayName,
          }}
          title={t('label.edit-entity', {
            entity: t('label.display-name'),
          })}
          visible={isDisplayNameEditing}
          onCancel={() => setIsDisplayNameEditing(false)}
          onSave={handleDisplayNameUpdate}
        />
      )}

      <Modal
        centered
        cancelButtonProps={{
          type: 'link',
        }}
        className="reactive-modal"
        closable={false}
        confirmLoading={isEntityRestoring}
        data-testid="restore-asset-modal"
        maskClosable={false}
        okText={t('label.restore')}
        open={showReactiveModal}
        title={t('label.restore-entity', {
          entity: entityType,
        })}
        onCancel={() => {
          setShowReactiveModal(false);
        }}
        onOk={handleRestore}>
        <Typography.Text data-testid="restore-modal-body">
          {t('message.are-you-want-to-restore', {
            entity: entityName,
          })}
        </Typography.Text>
      </Modal>
    </>
  );
};

export default ManageButton;

interface ManageButtonItemProps {
  label: ReactNode;
  icon: ReactNode;
  description: string;
  disabled: boolean;
  onClick: () => void;
}

export const ManageButtonItem = ({
  label,
  icon,
  description,
  disabled,
  onClick,
}: ManageButtonItemProps) => {
  return (
    <Tooltip title={disabled && NO_PERMISSION_FOR_ACTION}>
      <Row
        className={classNames('cursor-pointer manage-button', {
          'cursor-not-allowed opacity-50': disabled,
        })}
        onClick={onClick}>
        <Col className="m-t-xss" span={3}>
          {icon}
        </Col>
        <Col span={21}>
          <Row data-testid="restore-button">
            <Col span={21}>
              <Typography.Text
                className="font-medium"
                data-testid="delete-button-title">
                {label}
              </Typography.Text>
            </Col>
            <Col className="p-t-xss">
              <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                {description}
              </Typography.Paragraph>
            </Col>
          </Row>
        </Col>
      </Row>
    </Tooltip>
  );
};

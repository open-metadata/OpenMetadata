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

import { Button, Dropdown, Modal, Tooltip, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { capitalize } from 'lodash';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconRestore } from '../../../../assets/svg/ic-restore.svg';
import { ReactComponent as IconSetting } from '../../../../assets/svg/ic-settings-primery.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { EntityType } from '../../../../enums/entity.enum';
import { showErrorToast } from '../../../../utils/ToastUtils';
import EntityNameModal from '../../../Modals/EntityNameModal/EntityNameModal.component';
import { EntityName } from '../../../Modals/EntityNameModal/EntityNameModal.interface';
import DeleteWidgetModal from '../../DeleteWidget/DeleteWidgetModal';
import { ManageButtonItemLabel } from '../../ManageButtonContentItem/ManageButtonContentItem.component';
import { ManageButtonProps } from './ManageButton.interface';
import './ManageButton.less';

const ManageButton: FC<ManageButtonProps> = ({
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
  isAsyncDelete = false,
  isRecursiveDelete,
  extraDropdownContent,
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

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!onEditDisplayName) {
      return;
    }
    setIsDisplayNameEditing(true);
    try {
      await onEditDisplayName(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDisplayNameEditing(false);
    }
  };

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
                  icon={IconRestore}
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

    ...(showRenameOption
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.update-displayName-entity', {
                  entity: entityName,
                })}
                icon={EditIcon}
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
                icon={IconSetting}
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
                icon={IconDelete}
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
        // Used Button to stop click propagation event in the
        // TeamDetailsV1 and User.component collapsible panel.
        <Button
          className="remove-button-default-styling p-0"
          onClick={(e) => e.stopPropagation()}>
          <Dropdown
            align={{ targetOffset: [-12, 0] }}
            dropdownRender={renderDropdownContainer}
            menu={{ items }}
            overlayClassName="manage-dropdown-list-container"
            overlayStyle={{ width: '350px' }}
            placement="bottomRight"
            trigger={['click']}>
            <Tooltip
              placement="topRight"
              title={t('label.manage-entity', {
                entity: capitalize(entityType),
              })}>
              <Button
                className={classNames('flex-center px-1.5', buttonClassName)}
                data-testid="manage-button"
                type="default">
                <IconDropdown className="anticon self-center manage-dropdown-icon" />
              </Button>
            </Tooltip>
          </Dropdown>
        </Button>
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
          entityName={displayName ?? entityName}
          entityType={entityType}
          hardDeleteMessagePostFix={hardDeleteMessagePostFix}
          isAsyncDelete={isAsyncDelete}
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

      {showReactiveModal && (
        // Used Button to stop click propagation event in the
        // TeamDetailsV1 and User.component collapsible panel.
        <Button
          className="remove-button-default-styling"
          onClick={(e) => e.stopPropagation()}>
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
        </Button>
      )}
    </>
  );
};

export default ManageButton;

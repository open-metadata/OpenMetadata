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
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconAnnouncementsBlack } from '../../../../assets/svg/announcements-black.svg';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconRestore } from '../../../../assets/svg/ic-restore.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';

import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { EntityType } from '../../../../enums/entity.enum';
import { ANNOUNCEMENT_ENTITIES } from '../../../../utils/AnnouncementsUtils';
import DeleteWidgetModal from '../../DeleteWidget/DeleteWidgetModal';
import './ManageButton.less';

interface Props {
  allowSoftDelete?: boolean;
  afterDeleteAction?: () => void;
  buttonClassName?: string;
  entityName: string;
  entityId?: string;
  entityType?: string;
  entityFQN?: string;
  isRecursiveDelete?: boolean;
  deleteMessage?: string;
  softDeleteMessagePostFix?: string;
  hardDeleteMessagePostFix?: string;
  canDelete?: boolean;
  extraDropdownContent?: ItemType[];
  onAnnouncementClick?: () => void;
  onRestoreEntity?: () => void;
  deleted?: boolean;
}

const ManageButton: FC<Props> = ({
  allowSoftDelete,
  afterDeleteAction,
  buttonClassName,
  deleteMessage,
  softDeleteMessagePostFix,
  hardDeleteMessagePostFix,
  entityName,
  entityType,
  canDelete,
  entityId,
  isRecursiveDelete,
  extraDropdownContent,
  onAnnouncementClick,
  onRestoreEntity,
  deleted,
}) => {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState<boolean>(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [showReactiveModal, setShowReactiveModal] = useState(false);

  const items = [
    {
      label: (
        <Tooltip title={canDelete ? '' : NO_PERMISSION_FOR_ACTION}>
          <Row
            className={classNames('cursor-pointer manage-button', {
              'cursor-not-allowed opacity-50': !canDelete,
            })}
            onClick={(e) => {
              if (canDelete) {
                e.stopPropagation();
                setIsDelete(true);
                setShowActions(false);
              }
            }}>
            <Col span={3}>
              <IconDelete className="m-t-xss" name="Delete" width={20} />
            </Col>
            <Col span={21}>
              <Row data-testid="delete-button">
                <Col span={21}>
                  <Typography.Text
                    className="font-medium"
                    data-testid="delete-button-title">
                    {t('label.delete')}
                  </Typography.Text>
                </Col>
                <Col className="p-t-xss">
                  <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                    {t('message.delete-entity-type-action-description', {
                      entityType,
                    })}
                  </Typography.Paragraph>
                </Col>
              </Row>
            </Col>
          </Row>
        </Tooltip>
      ),
      key: 'delete-button',
    },
    ...(deleted
      ? [
          {
            label: (
              <Tooltip title={canDelete ? '' : NO_PERMISSION_FOR_ACTION}>
                <Row
                  className={classNames('cursor-pointer manage-button', {
                    'cursor-not-allowed opacity-50': !canDelete,
                  })}
                  onClick={(e) => {
                    if (canDelete) {
                      e.stopPropagation();
                      setShowActions(false);
                      setShowReactiveModal(true);
                    }
                  }}>
                  <Col span={3}>
                    <IconRestore
                      className="m-t-xss"
                      name="Restore"
                      width={20}
                    />
                  </Col>
                  <Col span={21}>
                    <Row data-testid="restore-button">
                      <Col span={21}>
                        <Typography.Text
                          className="font-medium"
                          data-testid="delete-button-title">
                          {t('label.restore')}
                        </Typography.Text>
                      </Col>
                      <Col className="p-t-xss">
                        <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                          {t('message.restore-action-description', {
                            entityType,
                          })}
                        </Typography.Paragraph>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </Tooltip>
            ),
            key: 'restore-button',
          },
        ]
      : []),

    ...(ANNOUNCEMENT_ENTITIES.includes(entityType as EntityType)
      ? [
          {
            label: (
              <Row
                className="cursor-pointer manage-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(false);
                  onAnnouncementClick && onAnnouncementClick();
                }}>
                <Col span={3}>
                  <IconAnnouncementsBlack
                    className="m-t-xss"
                    name="announcement"
                    width={20}
                  />
                </Col>
                <Col span={21}>
                  <Row data-testid="announcement-button">
                    <Col span={21}>
                      <Typography.Text className="font-medium">
                        {t('label.announcement-plural')}
                      </Typography.Text>
                    </Col>
                    <Col className="p-t-xss">
                      <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                        {t('message.announcement-action-description')}
                      </Typography.Paragraph>
                    </Col>
                  </Row>
                </Col>
              </Row>
            ),
            key: 'announcement-button',
          },
        ]
      : []),
    ...(extraDropdownContent ? extraDropdownContent : []),
  ];

  return (
    <>
      <Dropdown
        align={{ targetOffset: [-12, 0] }}
        menu={{ items }}
        open={showActions}
        overlayStyle={{ width: '350px' }}
        placement="bottomRight"
        trigger={['click']}
        onOpenChange={setShowActions}>
        <Button
          className={classNames(
            'tw-rounded tw-flex tw-justify-center tw-w-6 manage-dropdown-button',
            buttonClassName
          )}
          data-testid="manage-button"
          size="small"
          title="Manage"
          type="default"
          onClick={() => setShowActions(true)}>
          <IconDropdown className="text-primary self-center manage-dropdown-icon" />
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
          hardDeleteMessagePostFix={hardDeleteMessagePostFix}
          isRecursiveDelete={isRecursiveDelete}
          softDeleteMessagePostFix={softDeleteMessagePostFix}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
        />
      )}

      <Modal
        centered
        cancelButtonProps={{
          type: 'link',
        }}
        className="reactive-modal"
        closable={false}
        okText={t('label.restore')}
        open={showReactiveModal}
        title={t('label.restore-entity', {
          entity: entityType,
        })}
        onCancel={() => {
          setShowReactiveModal(false);
        }}
        onOk={onRestoreEntity}>
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

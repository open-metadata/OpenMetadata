/*
 *  Copyright 2023 Collate.
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

import { Badge, Button, Space, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import React from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as IconDisableTag } from '../assets/svg/disable-tag.svg';
import { ReactComponent as EditIcon } from '../assets/svg/edit-new.svg';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import RichTextEditorPreviewer from '../components/common/RichTextEditor/RichTextEditorPreviewer';
import { OperationPermission } from '../components/PermissionProvider/PermissionProvider.interface';
import { DE_ACTIVE_COLOR, NO_DATA_PLACEHOLDER } from '../constants/constants';
import { ProviderType } from '../generated/entity/bot';
import { Tag } from '../generated/entity/classification/tag';
import { DeleteTagsType } from '../pages/TagsPage/TagsPage.interface';
import { getDeleteIcon, getUsageCountLink } from './TagsUtils';

export const getDeleteButtonData = (
  record: Tag,
  isClassificationDisabled: boolean,
  classificationPermissions: OperationPermission
) => {
  let disabledDeleteMessage: string = t('message.no-permission-for-action');
  const disableDeleteButton =
    record.provider === ProviderType.System ||
    !classificationPermissions.EditAll ||
    isClassificationDisabled;

  if (isClassificationDisabled) {
    disabledDeleteMessage = t(
      'message.disabled-classification-actions-message'
    );
  } else if (record.provider === ProviderType.System) {
    disabledDeleteMessage = t('message.system-tag-delete-disable-message');
  }

  return { disableDeleteButton, disabledDeleteMessage };
};

export const getCommonColumns = (): ColumnsType<Tag> => [
  {
    title: t('label.tag'),
    dataIndex: 'name',
    key: 'name',
    width: 200,
    render: (_, record) => (
      <Space align="center">
        {record.style?.iconURL && (
          <img data-testid="tag-icon" src={record.style.iconURL} width={16} />
        )}
        <Typography.Text
          className="m-b-0"
          style={{ color: record.style?.color }}>
          {record.name}
        </Typography.Text>
        {record.disabled ? (
          <Badge
            className="m-l-xs badge-grey"
            count={t('label.disabled')}
            data-testid="disabled"
          />
        ) : null}
      </Space>
    ),
  },
  {
    title: t('label.display-name'),
    dataIndex: 'displayName',
    key: 'displayName',
    width: 200,
    render: (text) => (
      <Typography.Text>{text || NO_DATA_PLACEHOLDER}</Typography.Text>
    ),
  },
  {
    title: t('label.description'),
    dataIndex: 'description',
    key: 'description',
    render: (text: string, record: Tag) => (
      <>
        <div className="cursor-pointer d-flex">
          <div>
            {text ? (
              <RichTextEditorPreviewer markdown={text} />
            ) : (
              <span className="text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </span>
            )}
          </div>
        </div>
        <Space align="center" data-testid="usage" size={4}>
          <span className="text-grey-muted">{`${t('label.usage')}:`}</span>
          {record.usageCount ? (
            <Link
              className="link-text align-middle"
              data-testid="usage-count"
              to={getUsageCountLink(record.fullyQualifiedName ?? '')}>
              {record.usageCount}
            </Link>
          ) : (
            <span className="text-grey-muted">{t('label.not-used')}</span>
          )}
        </Space>
      </>
    ),
  },
];

export const getTagsTableColumn = ({
  isClassificationDisabled,
  classificationPermissions,
  deleteTags,
  handleEditTagClick,
  handleActionDeleteTag,
  isVersionView,
  disableEditButton,
}: {
  classificationPermissions: OperationPermission;
  isClassificationDisabled: boolean;
  isVersionView: boolean;
  deleteTags?: DeleteTagsType;
  handleEditTagClick?: (selectedTag: Tag) => void;
  handleActionDeleteTag?: (record: Tag) => void;
  disableEditButton?: boolean;
}): ColumnsType<Tag> => {
  const columns: ColumnsType<Tag> = getCommonColumns();

  if (!isVersionView) {
    columns.push({
      title: t('label.action-plural'),
      dataIndex: 'actions',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record: Tag) => {
        const { disableDeleteButton, disabledDeleteMessage } =
          getDeleteButtonData(
            record,
            isClassificationDisabled,
            classificationPermissions
          );

        return (
          <Space align="center" size={8}>
            <Tooltip
              placement="topRight"
              title={
                disableEditButton &&
                (isClassificationDisabled
                  ? t('message.disabled-classification-actions-message')
                  : t('message.no-permission-for-action'))
              }>
              <Button
                className="p-0 flex-center"
                data-testid="edit-button"
                disabled={disableEditButton}
                icon={
                  <EditIcon
                    data-testid="editTagDescription"
                    height={16}
                    name="edit"
                    width={16}
                  />
                }
                size="small"
                type="text"
                onClick={() =>
                  handleEditTagClick ? handleEditTagClick(record) : null
                }
              />
            </Tooltip>

            <Tooltip
              placement="topRight"
              title={disableDeleteButton && disabledDeleteMessage}>
              <Button
                className="p-0 flex-center"
                data-testid="delete-tag"
                disabled={disableDeleteButton}
                icon={getDeleteIcon({
                  deleteTagId: deleteTags?.data?.id,
                  status: deleteTags?.data?.status,
                  id: record.id ?? '',
                })}
                size="small"
                type="text"
                onClick={() =>
                  handleActionDeleteTag ? handleActionDeleteTag(record) : null
                }
              />
            </Tooltip>
          </Space>
        );
      },
    });
  }

  return columns;
};

export const getClassificationExtraDropdownContent = (
  showDisableOption: boolean,
  isClassificationDisabled: boolean,
  handleEnableDisableClassificationClick: () => void
) => [
  ...(showDisableOption
    ? [
        {
          label: (
            <ManageButtonItemLabel
              description={
                isClassificationDisabled
                  ? t('message.enable-classification-description')
                  : t('message.disable-classification-description')
              }
              icon={<IconDisableTag color={DE_ACTIVE_COLOR} width="18px" />}
              id="enable-disable"
              name={
                isClassificationDisabled
                  ? t('label.enable')
                  : t('label.disable')
              }
            />
          ),
          key: 'disable-button',
          onClick: handleEnableDisableClassificationClick,
        },
      ]
    : []),
];

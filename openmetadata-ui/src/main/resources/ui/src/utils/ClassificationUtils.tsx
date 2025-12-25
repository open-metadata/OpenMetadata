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

import { Tooltip as MUITooltip } from '@mui/material';
import { Button, Space, Switch, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { Link } from 'react-router-dom';
import { ReactComponent as IconDisableTag } from '../assets/svg/disable-tag.svg';
import { ReactComponent as EditIcon } from '../assets/svg/edit-new.svg';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { EntityField } from '../constants/Feeds.constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { ProviderType } from '../generated/entity/bot';
import { Classification } from '../generated/entity/classification/classification';
import { Tag } from '../generated/entity/classification/tag';
import { ChangeDescription } from '../generated/entity/type';
import { DeleteTagsType } from '../pages/TagsPage/TagsPage.interface';
import { getEntityVersionByField } from './EntityVersionUtils';
import { t } from './i18next/LocalUtil';
import { renderIcon } from './IconUtils';
import { getClassificationTagPath } from './RouterUtils';
import { descriptionTableObject } from './TableColumn.util';
import { getDeleteIcon } from './TagsUtils';

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

export const getCommonColumns = (options?: {
  handleToggleDisable?: (tag: Tag) => void;
  classificationPermissions?: OperationPermission;
  isClassificationDisabled?: boolean;
}): ColumnsType<Tag> => {
  const columns: ColumnsType<Tag> = [];

  if (options?.handleToggleDisable) {
    const canToggleDisable =
      options.classificationPermissions?.EditAll &&
      !options.isClassificationDisabled;

    columns.push({
      title: t('label.enabled'),
      dataIndex: 'disabled',
      key: 'disabled',
      width: 100,
      render: (_, record) => {
        let tooltipTitle: string;
        if (canToggleDisable) {
          tooltipTitle = record.disabled
            ? t('label.enable')
            : t('label.disable');
        } else {
          tooltipTitle = options.isClassificationDisabled
            ? t('message.disabled-classification-actions-message')
            : t('message.no-permission-for-action');
        }

        return (
          <MUITooltip arrow placement="top" title={tooltipTitle}>
            <Switch
              checked={!record.disabled}
              data-testid={`tag-disable-toggle-${record.name}`}
              disabled={!canToggleDisable}
              size="small"
              onChange={() => options.handleToggleDisable?.(record)}
            />
          </MUITooltip>
        );
      },
    });
  }

  columns.push(
    {
      title: t('label.tag'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (_, record) => (
        <div className="d-flex items-center gap-2">
          {record.style?.iconURL &&
            renderIcon(record.style.iconURL, {
              size: 18,
              className: 'flex-shrink-0',
            })}
          <Link
            className="m-b-0"
            data-testid={record.name}
            style={{ color: record.style?.color }}
            to={getClassificationTagPath(record.fullyQualifiedName ?? '')}>
            {record.name}
          </Link>
        </div>
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
    ...descriptionTableObject<Tag>({ width: 300 })
  );

  return columns;
};

export const getTagsTableColumn = ({
  isClassificationDisabled,
  classificationPermissions,
  deleteTags,
  handleEditTagClick,
  handleActionDeleteTag,
  isVersionView,
  disableEditButton,
  handleToggleDisable,
}: {
  classificationPermissions: OperationPermission;
  isClassificationDisabled: boolean;
  isVersionView: boolean;
  deleteTags?: DeleteTagsType;
  handleEditTagClick?: (selectedTag: Tag) => void;
  handleActionDeleteTag?: (record: Tag) => void;
  disableEditButton?: boolean;
  handleToggleDisable?: (tag: Tag) => void;
}): ColumnsType<Tag> => {
  const columns: ColumnsType<Tag> = getCommonColumns({
    handleToggleDisable,
    classificationPermissions,
    isClassificationDisabled,
  });

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
                    height={14}
                    name="edit"
                    width={14}
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
              icon={IconDisableTag}
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

export const getClassificationInfo = (
  currentClassification?: Classification,
  isVersionView = false
) => {
  return {
    currentVersion: currentClassification?.version ?? '0.1',
    isClassificationDisabled: currentClassification?.disabled ?? false,
    isClassificationDeleted: currentClassification?.deleted ?? false,
    isTier: currentClassification?.name === 'Tier',
    isSystemClassification:
      currentClassification?.provider === ProviderType.System,
    name: isVersionView
      ? getEntityVersionByField(
          currentClassification?.changeDescription ?? ({} as ChangeDescription),
          EntityField.NAME,
          currentClassification?.name
        )
      : currentClassification?.name,
    displayName: isVersionView
      ? getEntityVersionByField(
          currentClassification?.changeDescription ?? ({} as ChangeDescription),
          EntityField.DISPLAYNAME,
          currentClassification?.displayName
        )
      : currentClassification?.displayName,
    description: isVersionView
      ? getEntityVersionByField(
          currentClassification?.changeDescription ?? ({} as ChangeDescription),
          EntityField.DESCRIPTION,
          currentClassification?.description
        )
      : currentClassification?.description,
  };
};

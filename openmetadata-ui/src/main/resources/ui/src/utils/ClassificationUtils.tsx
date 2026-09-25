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

import {
  ButtonUtility,
  Toggle,
  Tooltip as UTTooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Icon } from '@openmetadata/ui-core-components/icon';
import { Link } from 'react-router-dom';
import { ReactComponent as IconDisableTag } from '../assets/svg/disable-tag.svg';
import { ReactComponent as EditIcon } from '../assets/svg/edit-new.svg';
import { TagUsageCount } from '../components/Classifications/TagUsageCount/TagUsageCount.component';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { ColumnsType } from '../components/common/Table/Table.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { Tag } from '../generated/entity/classification/tag';
import { DeleteTagsType } from '../pages/TagsPage/TagsPage.interface';
import { getDeleteButtonData } from './ClassificationPureUtils';
import { t } from './i18next/LocalUtil';
import { getClassificationTagPath } from './RouterUtils';
import { descriptionTableObject } from './TableColumn.util';
import { getDeleteIcon } from './TagsUtils';

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
          <UTTooltip placement="top" title={tooltipTitle}>
            <TooltipTrigger>
              <Toggle
                data-testid={`tag-disable-toggle-${record.name}`}
                isDisabled={!canToggleDisable}
                isSelected={!record.disabled}
                size="sm"
                onChange={() => options.handleToggleDisable?.(record)}
              />
            </TooltipTrigger>
          </UTTooltip>
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
          <Icon
            className="tw:shrink-0"
            iconValue={record.style?.iconURL}
            size={18}
          />
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
        <Typography as="span">{text || NO_DATA_PLACEHOLDER}</Typography>
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
  usageCounts,
  isUsageCountsLoading,
}: {
  classificationPermissions: OperationPermission;
  isClassificationDisabled: boolean;
  isVersionView: boolean;
  deleteTags?: DeleteTagsType;
  handleEditTagClick?: (selectedTag: Tag) => void;
  handleActionDeleteTag?: (record: Tag) => void;
  disableEditButton?: boolean;
  handleToggleDisable?: (tag: Tag) => void;
  usageCounts?: Record<string, number>;
  isUsageCountsLoading?: boolean;
}): ColumnsType<Tag> => {
  const columns: ColumnsType<Tag> = getCommonColumns({
    handleToggleDisable,
    classificationPermissions,
    isClassificationDisabled,
  });

  if (!isVersionView) {
    // Sits right after the display name, ahead of the much wider description
    const displayNameIndex = columns.findIndex(
      ({ key }) => key === 'displayName'
    );
    const usageIndex =
      displayNameIndex === -1 ? columns.length : displayNameIndex + 1;

    columns.splice(usageIndex, 0, {
      title: t('label.usage'),
      key: 'usageCount',
      width: 120,
      align: 'center',
      render: (_, record: Tag) => (
        <TagUsageCount
          isLoading={isUsageCountsLoading}
          record={record}
          usageCounts={usageCounts}
        />
      ),
    });

    columns.push({
      title: t('label.action-plural'),
      dataIndex: 'actions',
      key: 'actions',
      width: 120,
      align: 'center',
      fixed: 'right',
      render: (_, record: Tag) => {
        const { disableDeleteButton, disabledDeleteMessage } =
          getDeleteButtonData(
            record,
            isClassificationDisabled,
            classificationPermissions
          );
        let editDisabledMessage = '';
        if (disableEditButton) {
          editDisabledMessage = isClassificationDisabled
            ? t('message.disabled-classification-actions-message')
            : t('message.no-permission-for-action');
        }

        return (
          <div className="tw:flex tw:items-center tw:justify-center tw:gap-2">
            {/* The Tooltip, not ButtonUtility's own, so the reason still shows while the button is disabled. */}
            <UTTooltip
              isDisabled={!editDisabledMessage}
              placement="top right"
              title={editDisabledMessage}>
              <ButtonUtility
                color="tertiary"
                data-testid="edit-button"
                icon={
                  <EditIcon
                    data-testid="editTagDescription"
                    height={14}
                    name="edit"
                    width={14}
                  />
                }
                isDisabled={disableEditButton}
                size="xs"
                onClick={() => handleEditTagClick?.(record)}
              />
            </UTTooltip>

            <UTTooltip
              isDisabled={!disableDeleteButton}
              placement="top right"
              title={disabledDeleteMessage}>
              <ButtonUtility
                color="tertiary"
                data-testid="delete-tag"
                icon={getDeleteIcon({
                  deleteTagId: deleteTags?.data?.id,
                  status: deleteTags?.data?.status,
                  id: record.id ?? '',
                })}
                isDisabled={disableDeleteButton}
                size="xs"
                onClick={() => handleActionDeleteTag?.(record)}
              />
            </UTTooltip>
          </div>
        );
      },
    });
  }

  return columns;
};

export const getClassificationExtraDropdownContent = (
  showDisableOption: boolean,
  isClassificationDisabled: boolean,
  handleEnableDisableClassificationClick: () => void,
  showEditOption = false,
  handleEditClassificationClick: () => void = () => undefined
) => [
  ...(showEditOption
    ? [
        {
          label: (
            <ManageButtonItemLabel
              description={t('label.update-entity', {
                entity: t('label.classification'),
              })}
              icon={EditIcon}
              id="edit-classification"
              name={t('label.edit')}
            />
          ),
          key: 'edit-classification-button',
          onClick: handleEditClassificationClick,
        },
      ]
    : []),
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

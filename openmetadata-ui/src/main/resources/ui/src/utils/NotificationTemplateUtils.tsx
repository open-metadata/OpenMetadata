/*
 *  Copyright 2025 Collate.
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

import { Chip, IconButton, Skeleton, Tooltip, Typography } from '@mui/material';
import { isUndefined } from 'lodash';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../assets/svg/ic-delete.svg';
import DateTimeDisplay from '../components/common/DateTimeDisplay/DateTimeDisplay';
import { DE_ACTIVE_COLOR, NO_DATA_PLACEHOLDER } from '../constants/constants';
import {
  NotificationTemplate,
  ProviderType,
} from '../generated/entity/events/notificationTemplate';
import { getEntityName } from './EntityUtils';
import { t } from './i18next/LocalUtil';

export interface TemplatePermissionInfo {
  id: string;
  edit: boolean;
  delete: boolean;
}

export const getNotificationTemplateListColumns = (
  templatePermissions: TemplatePermissionInfo[],
  loadingCount: number,
  handleDeleteClick: (record: NotificationTemplate) => void
) => [
  {
    title: t('label.name').toString(),
    dataIndex: 'name',
    key: 'name',
    render: (_: string, record: NotificationTemplate) => {
      return (
        record.fullyQualifiedName && (
          <Link data-testid="template-name" to="">
            {getEntityName(record)}
          </Link>
        )
      );
    },
  },
  {
    title: t('label.trigger').toString(),
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    render: (updatedAt: number) => <DateTimeDisplay timestamp={updatedAt} />,
  },
  {
    title: t('label.entity-type', {
      entity: t('label.template'),
    }),
    dataIndex: 'provider',
    key: 'provider',
    render: (provider: string) => <Chip color="primary" label={provider} />,
  },
  {
    title: t('label.action-plural').toString(),
    dataIndex: 'fullyQualifiedName',
    width: 90,
    key: 'fullyQualifiedName',
    render: (_: string, record: NotificationTemplate) => {
      const templatePermission = templatePermissions?.find(
        (template) => template.id === record.id
      );
      if (loadingCount > 0) {
        return <Skeleton className="p-r-lg" variant="rectangular" />;
      }

      if (
        isUndefined(templatePermission) ||
        (!templatePermission.edit && !templatePermission.delete)
      ) {
        return (
          <Typography className="p-l-xs" variant="body1">
            {NO_DATA_PLACEHOLDER}
          </Typography>
        );
      }

      return (
        <div className="d-flex items-center">
          {templatePermission.edit && (
            <Tooltip placement="bottom" title={t('label.edit')}>
              <Link to="">
                <IconButton
                  className="flex flex-center"
                  data-testid={`template-edit-${record.name}`}>
                  <EditIcon color={DE_ACTIVE_COLOR} width="14px" />
                </IconButton>
              </Link>
            </Tooltip>
          )}
          {templatePermission.delete && (
            <Tooltip placement="bottom" title={t('label.delete')}>
              <IconButton
                className="flex flex-center"
                data-testid={`template-delete-${record.name}`}
                disabled={record.provider === ProviderType.System}
                onClick={() => handleDeleteClick(record)}>
                <DeleteIcon height={16} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      );
    },
  },
];

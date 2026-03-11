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

import {
  Button,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { updateTableColumn } from '../../../rest/tableAPI';
import { getTextFromHtmlString } from '../../../utils/BlockEditorUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { stringToHTML } from '../../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import { EntityTitleSectionProps } from './EntityTitleSection.interface';

export const EntityTitleSection = ({
  entityDetails,
  entityLink,
  entityType,
  tooltipPlacement = 'top left',
  testId = 'entity-link',
  className,
  hasEditPermission = false,
  onDisplayNameUpdate,
  entityDisplayName,
}: EntityTitleSectionProps) => {
  const { t } = useTranslation();
  const entityTypeValue = entityDetails.entityType ?? '';
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const displayName = entityDisplayName ?? entityDetails.displayName;
  const entityName = getEntityName({
    ...entityDetails,
    displayName,
  });
  const linkHref =
    typeof entityLink === 'string' ? entityLink : entityLink.pathname;

  const handleDisplayNameUpdate = useCallback(
    async (data: EntityName) => {
      if (!entityDetails.id || !entityType) {
        setIsEditModalOpen(false);

        return;
      }

      try {
        if (entityType === EntityType.TABLE_COLUMN) {
          const res = await updateTableColumn(
            entityDetails.fullyQualifiedName ?? '',
            {
              displayName: data.displayName,
            }
          );
          onDisplayNameUpdate?.(res.displayName ?? data.displayName ?? '');

          return;
        }

        const jsonPatch = [
          {
            op: entityDisplayName ? 'replace' : 'add',
            path: '/displayName',
            value: data.displayName,
          },
        ];

        const patchAPI = entityUtilClassBase.getEntityPatchAPI(entityType);
        const response = await patchAPI(
          entityDetails.id,
          jsonPatch as Operation[]
        );

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.display-name'),
          })
        );

        if (onDisplayNameUpdate) {
          onDisplayNameUpdate(response.displayName || data.displayName || '');
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.display-name'),
          })
        );
      } finally {
        setIsEditModalOpen(false);
      }
    },
    [
      entityDetails.id,
      entityDetails.fullyQualifiedName,
      entityDisplayName,
      entityType,
      onDisplayNameUpdate,
      t,
    ]
  );

  return (
    <div
      className={classNames(
        'tw:sticky tw:p-1 tw:z-999 tw:top-0 tw:bg-white',
        className
      )}>
      <div className="tw:flex tw:gap-2 tw:items-center tw:rounded-lg tw:px-1 tw:bg-gray-blue-50 tw:py-2">
        <span className="tw:text-blue-700 tw:w-4.5 tw:h-4.5 tw:ml-1 tw:shrink-0">
          {searchClassBase.getEntityIcon(entityTypeValue)}
        </span>
        <Tooltip
          placement={tooltipPlacement}
          title={getTextFromHtmlString(entityName)}
          trigger="hover">
          <TooltipTrigger>
            <Link
              className="tw:min-w-0 tw:overflow-hidden tw:text-sm tw:font-semibold tw:truncate tw:no-underline tw:text-blue-700 tw:block"
              data-testid={testId}
              to={linkHref}>
              {stringToHTML(entityName)}
            </Link>
          </TooltipTrigger>
        </Tooltip>
        {hasEditPermission && entityType && entityDetails.id && (
          <Tooltip placement="top" title={t('label.edit')}>
            <TooltipTrigger>
              <Button
                color="tertiary"
                data-testid="edit-displayName-button"
                iconLeading={
                  <IconEdit color={DE_ACTIVE_COLOR} height={16} width={16} />
                }
                onClick={() => setIsEditModalOpen(true)}
              />
            </TooltipTrigger>
          </Tooltip>
        )}
      </div>
      {isEditModalOpen && (
        <EntityNameModal
          entity={{
            name: entityDetails.name ?? '',
            displayName,
          }}
          title={t('label.edit-entity', {
            entity: t('label.display-name'),
          })}
          visible={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          onSave={handleDisplayNameUpdate}
        />
      )}
    </div>
  );
};

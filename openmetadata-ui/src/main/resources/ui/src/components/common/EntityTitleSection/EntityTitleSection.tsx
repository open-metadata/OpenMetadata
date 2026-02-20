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

import { Box, IconButton, useTheme } from '@mui/material';
import { Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
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
  tooltipPlacement = 'topLeft',
  testId = 'entity-link',
  className = '',
  hasEditPermission = false,
  onDisplayNameUpdate,
  entityDisplayName,
}: EntityTitleSectionProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
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
    [entityDetails.id, entityDisplayName, entityType, onDisplayNameUpdate, t]
  );

  return (
    <Box
      className={className}
      sx={{
        position: 'sticky',
        padding: theme.spacing(1),
        zIndex: 999,
        top: 0,
        flex: 1,
        backgroundColor: theme.palette.background.paper,
        ...(className.includes('drawer-title-section') && {
          backgroundColor: 'transparent',
        }),
      }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: theme.spacing(2),
          height: theme.spacing(11.5),
          px: theme.spacing(1),
          backgroundColor: theme.palette.allShades.blueGray[50],
        }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}>
          <Box
            sx={{
              color: theme.palette.allShades.blue[600],
              width: theme.spacing(4.5),
              height: theme.spacing(4.5),
              ml: theme.spacing(1),
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
              mr: theme.spacing(2),
            }}>
            {searchClassBase.getEntityIcon(entityTypeValue)}
          </Box>
          <Tooltip
            mouseEnterDelay={0.5}
            placement={tooltipPlacement}
            title={getTextFromHtmlString(entityName)}
            trigger="hover">
            <Link
              data-testid={testId}
              style={{
                minWidth: 0,
                overflow: 'hidden',
                fontSize: theme.typography.pxToRem(15),
                cursor: 'pointer',
                fontWeight: 600,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                color: theme.palette.allShades.blue[700],
                display: 'block',
              }}
              to={linkHref}>
              {stringToHTML(entityName)}
            </Link>
          </Tooltip>
          {hasEditPermission && entityType && entityDetails.id && (
            <Tooltip placement="top" title={t('label.edit')}>
              <IconButton
                data-testid="edit-displayName-button"
                size="small"
                sx={{
                  ml: theme.spacing(1),
                  flexShrink: 0,
                }}
                onClick={() => setIsEditModalOpen(true)}>
                <IconEdit color={DE_ACTIVE_COLOR} height={14} width={14} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
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
    </Box>
  );
};

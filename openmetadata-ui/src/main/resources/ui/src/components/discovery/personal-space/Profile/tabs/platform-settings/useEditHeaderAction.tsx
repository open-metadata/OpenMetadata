/*
 *  Copyright 2026 Collate.
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

import { Box, Button } from '@openmetadata/ui-core-components';
import { Edit01 } from '@openmetadata/ui-core-components/icons';
import { ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  PlatformSettingsPageId,
  PlatformSettingsPageProps,
} from './PlatformSettings.types';

/**
 * Puts the "Edit" action in the modal header for a read-only settings view,
 * after any page-specific `extraActions`. Memoize `extraActions`: a new node
 * every render re-runs the effect, which re-renders the panel and the page.
 */
export const useEditHeaderAction = (
  page: PlatformSettingsPageId,
  isLoading: boolean,
  { onNavigate, onSetHeaderActions }: PlatformSettingsPageProps,
  extraActions?: ReactNode
) => {
  const { t } = useTranslation();

  useEffect(() => {
    onSetHeaderActions(
      isLoading ? undefined : (
        <Box direction="row" gap={3}>
          {extraActions}
          <Button
            color="primary"
            data-testid="edit-button"
            iconLeading={Edit01}
            size="sm"
            onPress={() => onNavigate({ type: 'page', page, isEditing: true })}>
            {t('label.edit')}
          </Button>
        </Box>
      )
    );

    return () => onSetHeaderActions(undefined);
  }, [extraActions, isLoading, onNavigate, onSetHeaderActions, page, t]);
};

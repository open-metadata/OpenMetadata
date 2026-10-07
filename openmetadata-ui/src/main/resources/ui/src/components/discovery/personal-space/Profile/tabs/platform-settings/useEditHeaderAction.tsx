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

import { Button } from '@openmetadata/ui-core-components';
import { Edit01 } from '@openmetadata/ui-core-components/icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  PlatformSettingsPageId,
  PlatformSettingsPageProps,
} from './PlatformSettings.types';

/** Puts the "Edit" action in the modal header for a read-only settings view. */
export const useEditHeaderAction = (
  page: PlatformSettingsPageId,
  isLoading: boolean,
  { onNavigate, onSetHeaderActions }: PlatformSettingsPageProps
) => {
  const { t } = useTranslation();

  useEffect(() => {
    onSetHeaderActions(
      isLoading ? undefined : (
        <Button
          color="primary"
          data-testid="edit-button"
          iconLeading={Edit01}
          size="sm"
          onPress={() => onNavigate({ type: 'page', page, isEditing: true })}>
          {t('label.edit')}
        </Button>
      )
    );

    return () => onSetHeaderActions(undefined);
  }, [isLoading, onNavigate, onSetHeaderActions, page, t]);
};

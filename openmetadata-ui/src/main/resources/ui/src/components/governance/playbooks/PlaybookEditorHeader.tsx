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

import { Badge, Button, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface PlaybookEditorHeaderProps {
  title: string;
  subtitle: string;
  /** Unsaved scaffold: nothing is enforced yet, so it cannot claim to be active. */
  isNew: boolean;
  isEnabled: boolean;
  isSaving: boolean;
  onBack: () => void;
  onPreview: () => void;
  onPublish: () => void;
}

const statusFor = (isNew: boolean, isEnabled: boolean) => {
  if (isNew) {
    return { color: 'gray' as const, labelKey: 'label.not-configured' };
  }

  return isEnabled
    ? { color: 'success' as const, labelKey: 'label.active' }
    : { color: 'gray' as const, labelKey: 'label.disabled' };
};

export const PlaybookEditorHeader = ({
  title,
  subtitle,
  isNew,
  isEnabled,
  isSaving,
  onBack,
  onPreview,
  onPublish,
}: PlaybookEditorHeaderProps) => {
  const { t } = useTranslation();
  const status = statusFor(isNew, isEnabled);

  return (
    <header className="tw:flex tw:items-start tw:justify-between tw:gap-4">
      <div className="tw:flex tw:flex-col tw:gap-1">
        <div className="tw:flex tw:items-center tw:gap-3">
          <Button color="link-color" size="sm" onPress={onBack}>
            {t('label.onboarding-playbook-plural')}
          </Button>
          <Typography className="tw:text-tertiary">/</Typography>
          <Typography className="tw:text-xl tw:font-semibold tw:text-primary">
            {title}
          </Typography>
          <Badge color={status.color} size="sm" type="pill-color">
            {t(status.labelKey)}
          </Badge>
        </div>
        <Typography className="tw:text-sm tw:text-tertiary">
          {subtitle}
        </Typography>
      </div>

      <div className="tw:flex tw:items-center tw:gap-3">
        <Button
          color="secondary"
          data-testid="preview-as-producer"
          size="md"
          onPress={onPreview}>
          {t('label.preview-as-producer')}
        </Button>
        <Button
          color="primary"
          data-testid="publish-changes"
          isLoading={isSaving}
          size="md"
          onPress={onPublish}>
          {t('label.publish-changes')}
        </Button>
      </div>
    </header>
  );
};

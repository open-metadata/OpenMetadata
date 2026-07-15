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

import { EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { AlertTriangle } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { SomethingWentWrongPlaceholderProps } from './EmptyPlaceholder.interface';
import { resolveSingleAction } from './EmptyPlaceholder.utils';

/**
 * Prefilled empty state for an unexpected error while loading content.
 * Renders a "Reload" action when `onReload` is provided; pass `actions` to
 * replace it entirely.
 *
 * The underlying `EmptyPlaceholder` is absolutely positioned, so the host
 * container must set `position: relative` for it to be visible.
 */
const SomethingWentWrongPlaceholder = ({
  icon,
  title,
  description,
  actions,
  onReload,
  ...props
}: SomethingWentWrongPlaceholderProps) => {
  const { t } = useTranslation();

  return (
    <EmptyPlaceholder
      actions={resolveSingleAction(
        actions,
        onReload,
        'reload',
        t('label.reload')
      )}
      description={description ?? t('message.temporary-error-try-reloading')}
      icon={icon ?? AlertTriangle}
      title={title ?? t('message.something-went-wrong')}
      variant="blank"
      {...props}
    />
  );
};

export default SomethingWentWrongPlaceholder;

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
import { Database01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { EmptyPlaceholderVariantProps } from './EmptyPlaceholder.interface';

/**
 * Prefilled generic empty state for a resource that currently has no data.
 * Every field (icon, title, description) can be overridden via props.
 *
 * The underlying `EmptyPlaceholder` is absolutely positioned, so the host
 * container must set `position: relative` for it to be visible.
 */
const NoDataPlaceholder = ({
  icon,
  title,
  description,
  ...props
}: EmptyPlaceholderVariantProps) => {
  const { t } = useTranslation();

  return (
    <EmptyPlaceholder
      description={description ?? t('message.no-data-available')}
      icon={icon ?? Database01}
      title={title}
      variant="blank"
      {...props}
    />
  );
};

export default NoDataPlaceholder;

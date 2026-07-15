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
import { Lock01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { PermissionPlaceholderProps } from './EmptyPlaceholder.interface';

/**
 * Prefilled empty state shown when the current user lacks permission to view
 * the content. Pass `permissionValue` to name the missing permission; every
 * field (icon, title, description) can be overridden via props.
 *
 * The underlying `EmptyPlaceholder` is absolutely positioned, so the host
 * container must set `position: relative` for it to be visible.
 */
const PermissionPlaceholder = ({
  icon,
  title,
  description,
  permissionValue,
  ...props
}: PermissionPlaceholderProps) => {
  const { t } = useTranslation();

  return (
    <EmptyPlaceholder
      description={
        description ?? (
          <Transi18next
            i18nKey="message.no-access-placeholder"
            renderElement={<b />}
            values={{ entity: permissionValue ?? t('label.resource') }}
          />
        )
      }
      icon={icon ?? <Lock01 className="tw:text-secondary" />}
      title={title ?? t('label.access-denied')}
      variant="blank"
      {...props}
    />
  );
};

export default PermissionPlaceholder;

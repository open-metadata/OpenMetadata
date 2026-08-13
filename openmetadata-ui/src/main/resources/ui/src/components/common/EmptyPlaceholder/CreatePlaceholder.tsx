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
import { Plus } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { CreatePlaceholderProps } from './EmptyPlaceholder.interface';
import { resolveSingleAction } from './EmptyPlaceholder.utils';
import PermissionPlaceholder from './PermissionPlaceholder';

/**
 * Prefilled empty state prompting the user to create the first entity of a
 * collection. Renders an "Add" action when `onCreate` is provided; pass
 * `actions` to replace it entirely. When `permission` is explicitly `false`
 * it falls back to a `PermissionPlaceholder`.
 *
 * The underlying `EmptyPlaceholder` is absolutely positioned, so the host
 * container must set `position: relative` for it to be visible.
 */
const CreatePlaceholder = ({
  icon,
  title,
  description,
  actions,
  permission,
  heading,
  doc,
  buttonId,
  permissionValue,
  onCreate,
  ...props
}: CreatePlaceholderProps) => {
  const { t } = useTranslation();

  if (permission === false) {
    return (
      <PermissionPlaceholder
        description={description}
        icon={icon}
        permissionValue={permissionValue}
        title={title}
        {...props}
      />
    );
  }

  return (
    <EmptyPlaceholder
      actions={resolveSingleAction(
        actions,
        onCreate,
        'add',
        t('label.add'),
        buttonId
      )}
      description={
        description ?? (
          <>
            {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
              entity: heading ?? t('label.entity'),
            })}
            {doc && (
              <>
                {' '}
                <Transi18next
                  i18nKey="message.refer-to-our-doc"
                  renderElement={
                    <a href={doc} rel="noopener noreferrer" target="_blank" />
                  }
                  values={{ doc: t('label.doc-plural-lowercase') }}
                />
              </>
            )}
          </>
        )
      }
      icon={icon ?? <Plus className="tw:text-secondary" />}
      title={title}
      variant="blank"
      {...props}
    />
  );
};

export default CreatePlaceholder;

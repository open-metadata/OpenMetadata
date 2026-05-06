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

import { Button } from '@openmetadata/ui-core-components';
import { ArrayFieldTemplateProps } from '@rjsf/utils';
import { Plus, Trash01 } from '@untitledui/icons';
import { Fragment, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';

export const CoreArrayFieldTemplate: FunctionComponent<
  ArrayFieldTemplateProps
> = ({ title, canAdd, onAddClick, items, idSchema }) => {
  const { t } = useTranslation();

  return (
    <Fragment>
      <div className="tw:flex tw:items-center tw:justify-between">
        <label className="tw:text-sm tw:font-medium tw:text-[var(--color-text-primary)]">
          {title}
        </label>
        {canAdd && (
          <Button
            aria-label={t('label.add-entity', { entity: title })}
            color="primary"
            data-testid={`add-item-${title}`}
            id={`${idSchema.$id}`}
            size="sm"
            onClick={onAddClick}>
            <Plus data-icon size={14} />
          </Button>
        )}
      </div>
      {items.map((element, index) => (
        <div
          className={`tw:flex tw:w-full tw:items-center${
            index > 0 ? ' tw:mt-2' : ''
          }`}
          key={`${element.key}-${index}`}>
          <div className="tw:flex-1">{element.children}</div>
          {element.hasRemove && (
            <button
              aria-label={t('label.remove')}
              className="tw:ml-2 tw:flex tw:items-center tw:text-[var(--color-text-error-primary)] hover:tw:opacity-80"
              type="button"
              onClick={(event) =>
                element.onDropIndexClick(element.index)(event)
              }>
              <Trash01 size={16} />
            </button>
          )}
        </div>
      ))}
    </Fragment>
  );
};

/*
 *  Copyright 2022 Collate.
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
import { ButtonUtility, Typography } from '@openmetadata/ui-core-components';

import { Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { ArrayFieldTemplateProps } from '@rjsf/utils';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { Fragment, FunctionComponent, MouseEvent } from 'react';
import { t } from '../../../../../utils/i18next/LocalUtil';

export const ArrayFieldTemplate: FunctionComponent<ArrayFieldTemplateProps> = (
  props: ArrayFieldTemplateProps
) => {
  const { formContext, idSchema, title, canAdd, onAddClick, items } = props;

  return (
    <Fragment>
      <div className="d-flex justify-between items-center">
        <Typography className="control-label">{title}</Typography>
        {canAdd && (
          <ButtonUtility
            data-testid={`add-item-${title}`}
            icon={Plus}
            id={`${idSchema.$id}`}
            tooltip={t('label.add')}
            onClick={onAddClick}
            onFocus={() => {
              if (!isUndefined(formContext.handleFocus)) {
                formContext.handleFocus(idSchema.$id);
              }
            }}
          />
        )}
      </div>
      {items.map((element, index) => (
        <div
          className={classNames('d-flex items-center w-full', {
            'm-t-sm': index > 0,
          })}
          key={element.key}>
          <div className="flex-1 array-fields">{element.children}</div>
          {element.hasRemove && (
            <ButtonUtility
              className="tw:ml-3"
              icon={Trash01}
              size="md"
              tooltip={t('label.remove')}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                element.onDropIndexClick(element.index)(event);
              }}
            />
          )}
        </div>
      ))}
    </Fragment>
  );
};

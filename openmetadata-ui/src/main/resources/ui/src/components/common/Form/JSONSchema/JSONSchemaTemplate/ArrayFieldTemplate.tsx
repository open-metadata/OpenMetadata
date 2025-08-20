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

import Icon, { PlusOutlined } from '@ant-design/icons';
import { ArrayFieldTemplateProps } from '@rjsf/utils';
import { Button } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { Fragment, FunctionComponent } from 'react';
import DeleteIcon from '../../../../../assets/svg/ic-delete.svg?react';

export const ArrayFieldTemplate: FunctionComponent<ArrayFieldTemplateProps> = (
  props: ArrayFieldTemplateProps
) => {
  const { formContext, idSchema, title, canAdd, onAddClick, items } = props;

  return (
    <Fragment>
      <div className="d-flex justify-between items-center">
        <label className="control-label">{title}</label>
        {canAdd && (
          <Button
            data-testid={`add-item-${title}`}
            icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
            id={`${idSchema.$id}`}
            size="small"
            type="primary"
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
          key={`${element.key}-${index}`}>
          <div className="flex-1 array-fields">{element.children}</div>
          {element.hasRemove && (
            <Icon
              className="w-7 h-0 m-l-sm"
              component={DeleteIcon}
              onClick={(event) => {
                element.onDropIndexClick(element.index)(event);
              }}
            />
          )}
        </div>
      ))}
    </Fragment>
  );
};

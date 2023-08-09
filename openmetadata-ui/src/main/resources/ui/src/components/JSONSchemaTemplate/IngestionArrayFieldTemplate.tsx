/*
 *  Copyright 2023 Collate.
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
import { PlusOutlined } from '@ant-design/icons';
import { ArrayFieldTemplateProps } from '@rjsf/utils';
import { Button, Space } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { FC, Fragment } from 'react';
import { ReactComponent as DeleteIcon } from '/assets/svg/ic-delete.svg';

const IngestionArrayFieldTemplate: FC<ArrayFieldTemplateProps> = (
  props: ArrayFieldTemplateProps
) => {
  const { formContext, idSchema, title, canAdd, onAddClick, items } = props;

  return (
    <Fragment>
      <Space align="center" className="w-full justify-between">
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
      </Space>
      {items.map((element, index) => (
        <Space
          align="center"
          className={classNames('w-full', {
            'm-t-xs': index > 0,
          })}
          key={`${element.key}-${index}`}>
          <div className="flex-1 array-fields">{element.children}</div>
          {element.hasRemove && (
            <Button
              className="m-t-lg"
              icon={<DeleteIcon width={16} />}
              type="text"
              onClick={(event) => {
                element.onDropIndexClick(element.index)(event);
              }}
            />
          )}
        </Space>
      ))}
    </Fragment>
  );
};

export default IngestionArrayFieldTemplate;

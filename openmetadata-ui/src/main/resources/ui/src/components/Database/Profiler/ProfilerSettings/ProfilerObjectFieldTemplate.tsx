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
import { ObjectFieldTemplateProps } from '@rjsf/utils';
import { Button, Space, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';

export const ProfilerObjectFieldTemplate: FC<ObjectFieldTemplateProps> = (
  props: ObjectFieldTemplateProps
) => {
  const { t } = useTranslation();

  const { idSchema, title, onAddClick, schema, properties } = props;

  return (
    <Fragment>
      <Space className="w-full justify-between">
        <label
          className={classNames('control-label', {
            'font-medium text-base-color text-md': !schema.additionalProperties,
          })}
          id={`${idSchema.$id}__title`}>
          {title}
        </label>

        {schema.additionalProperties && (
          <Button
            data-testid={`add-item-${title}`}
            icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
            id={`${idSchema.$id}`}
            size="small"
            type="primary"
            onClick={() => {
              onAddClick(schema)();
            }}
          />
        )}
      </Space>
      {isEmpty(properties) ? (
        <Typography>{t('message.no-config-plural')}</Typography>
      ) : (
        properties.map((element, index) => (
          <div
            className={classNames('property-wrapper', {
              'additional-fields': schema.additionalProperties,
            })}
            key={`${element.content.key}-${index}`}>
            {element.content}
          </div>
        ))
      )}
    </Fragment>
  );
};

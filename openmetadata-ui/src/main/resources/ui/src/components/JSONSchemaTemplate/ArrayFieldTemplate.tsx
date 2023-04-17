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

import { PlusOutlined } from '@ant-design/icons';
import { ArrayFieldTemplateProps } from '@rjsf/core';
import { Space, Typography } from 'antd';
import classNames from 'classnames';
import InfoPopover from 'components/common/InfoPopover/InfoPopover';
import { t } from 'i18next';
import React, { Fragment, FunctionComponent } from 'react';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';

export const ArrayFieldTemplate: FunctionComponent<ArrayFieldTemplateProps> = (
  props: ArrayFieldTemplateProps
) => {
  return (
    <Fragment>
      <div className="tw-flex tw-justify-between tw-items-center">
        <Space size={0}>
          <label className="control-label">{props.title}</label>
          <p className="field-description">
            <InfoPopover
              content={
                <Typography className="text-grey-muted">
                  {props.schema.description}
                </Typography>
              }
            />
          </p>
        </Space>
        {props.canAdd && (
          <Button
            className="tw-h-7 tw-w-7 tw-px-2"
            data-testid={`add-item-${props.title}`}
            size="small"
            theme="primary"
            variant="contained"
            onClick={props.onAddClick}>
            <PlusOutlined />
          </Button>
        )}
      </div>
      {props.items.map((element, index) => (
        <div
          className={classNames('tw-flex tw-items-center tw-w-full', {
            'tw-mt-2': index > 0,
          })}
          key={`${element.key}-${index}`}>
          <div className="tw-flex-1 array-fields">{element.children}</div>
          {element.hasRemove && (
            <button
              className="focus:tw-outline-none tw-w-7 tw-ml-3"
              type="button"
              onClick={(event) => {
                element.onDropIndexClick(element.index)(event);
              }}>
              <SVGIcons
                alt="delete"
                icon={Icons.DELETE}
                title={t('label.delete')}
                width="16px"
              />
            </button>
          )}
        </div>
      ))}
    </Fragment>
  );
};

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

import { Space, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FilterPlaceHolderIcon } from '../../../assets/svg/no-search-placeholder.svg';
import { Transi18next } from '../../../utils/CommonUtils';
import { FilterPlaceholderProps } from './placeholder.interface';

const FilterErrorPlaceHolder = ({
  className,
  size,
  doc,
}: FilterPlaceholderProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={classNames(className, 'h-full flex-center mt-24')}
      data-testid="search-error-placeholder">
      <Space align="center" direction="vertical" size={10}>
        <FilterPlaceHolderIcon
          data-testid="no-search-image"
          height={size}
          width={size}
        />
        <div className="m-t-xss text-center text-sm font-normal">
          <Typography.Paragraph style={{ marginBottom: '0' }}>
            {t('label.no-result-found')}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: '0' }}>
            {t('message.try-adjusting-filter')}
          </Typography.Paragraph>
          {doc ? (
            <Typography.Paragraph>
              <Transi18next
                i18nKey="message.refer-to-our-doc"
                renderElement={
                  <a
                    href={doc}
                    rel="noreferrer"
                    style={{ color: '#1890ff' }}
                    target="_blank"
                  />
                }
                values={{
                  doc: t('label.doc-plural-lowercase'),
                }}
              />
            </Typography.Paragraph>
          ) : (
            ''
          )}
        </div>
      </Space>
    </div>
  );
};

export default FilterErrorPlaceHolder;

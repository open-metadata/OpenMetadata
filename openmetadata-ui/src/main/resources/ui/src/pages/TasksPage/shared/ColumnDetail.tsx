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

import { Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from '../../../generated/entity/data/table';
import SVGIcons from '../../../utils/SvgUtils';

const ColumnDetail = ({ column }: { column: Column }) => {
  const { t } = useTranslation();

  return !isEmpty(column) && !isUndefined(column) ? (
    <div className="tw-mb-4" data-testid="column-details">
      <div className="tw-flex">
        <span
          className="tw-text-grey-muted tw-flex-none tw-mr-1"
          data-testid="column-type">
          {`${t('label.column-type')}:`}
        </span>
        <Typography.Paragraph
          className="ant-typography-ellipsis-custom"
          ellipsis={{ rows: 1, tooltip: true }}>
          {column.dataTypeDisplay}
        </Typography.Paragraph>
      </div>
      {column.tags && column.tags.length ? (
        <div className="tw-flex tw-mt-4" data-testid="column-tags">
          <SVGIcons
            alt="icon-tag"
            className="tw-mr-1"
            icon="icon-tag-grey"
            width="12"
          />
          <div>{column.tags.map((tag) => `#${tag.tagFQN}`)?.join(' ')}</div>
        </div>
      ) : null}
    </div>
  ) : null;
};

export default ColumnDetail;

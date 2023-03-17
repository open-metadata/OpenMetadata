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

import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Card, Space, Typography } from 'antd';
import classNames from 'classnames';
import { Query } from 'generated/entity/data/query';
import { split } from 'lodash';
import React, { FC, HTMLAttributes, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFormattedDateFromSeconds } from 'utils/TimeUtils';
import { CSMode } from '../../enums/codemirror.enum';
import SchemaEditor from '../schema-editor/SchemaEditor';

import './table-queries.style.less';

interface QueryCardProp extends HTMLAttributes<HTMLDivElement> {
  query: Query;
  onQuerySelection: (query: Query) => void;
}

const QueryCard: FC<QueryCardProp> = ({
  className,
  query,
  onQuerySelection,
}: QueryCardProp) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<boolean>(false);

  const { isAllowExpand, queryDate } = useMemo(() => {
    const queryArr = split(query.query, '\n');
    const queryDate = getFormattedDateFromSeconds(
      query.queryDate || 0,
      "'On' MMMM do 'at' h:mma 'UTC'ZZ" // eg: On March 6th at 6:20pm UTC+1
    );

    return { isAllowExpand: queryArr.length > 6, queryDate };
  }, [query]);

  return (
    <div className={className} onClick={() => onQuerySelection(query)}>
      <Card
        bodyStyle={{ padding: 0, paddingLeft: 8, paddingTop: 1 }}
        className="tw-p-px relative"
        title={
          <Space className="tw-font-normal p-y-xs" size={8}>
            <Typography.Text>{queryDate}</Typography.Text>
            <Typography.Text>{`• ${t('label.by-lowercase')} ${
              query.updatedBy
            }`}</Typography.Text>
          </Space>
        }>
        <Button
          className="expand-collapse-icon"
          data-testid="expand-collapse-button"
          icon={expanded ? <DownOutlined /> : <UpOutlined />}
          size="small"
          type="text"
          onClick={() => {
            setExpanded((pre) => !pre);
            onQuerySelection(query);
          }}
        />

        <div
          className={classNames('tw-overflow-hidden ', {
            'tw-max-h-32': !isAllowExpand,
            'tw-h-32': !expanded,
          })}>
          <SchemaEditor
            editorClass={classNames('custom-code-mirror-theme', {
              'table-query-editor': isAllowExpand,
            })}
            mode={{ name: CSMode.SQL }}
            options={{
              styleActiveLine: false,
            }}
            value={query.query ?? ''}
          />
        </div>
      </Card>
    </div>
  );
};

export default QueryCard;

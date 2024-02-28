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
import { Button, Card, Space, Tag, Tooltip } from 'antd';
import classNames from 'classnames';
import { split } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/icon-copy.svg';
import { CSMode } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import './query-viewer.style.less';

const QueryViewer = ({
  title,
  sqlQuery,
}: {
  title?: React.ReactNode;
  sqlQuery: string;
}) => {
  const { t } = useTranslation();

  const { queryLine, lineCount } = useMemo(() => {
    const lineCount = split(sqlQuery, '\n').length;

    return {
      queryLine: `${lineCount} ${
        lineCount > 1 ? t('label.line-plural') : t('label.line')
      }`,
      lineCount,
    };
  }, [sqlQuery]);

  const { onCopyToClipBoard } = useClipboard(sqlQuery);

  return (
    <Card
      className="m-md w-auto dbt-tab-container"
      extra={
        <Space className="m-y-xs">
          <Tag className="query-lines" data-testid="query-line">
            {queryLine}
          </Tag>
          <Tooltip placement="topRight" title={t('message.copy-to-clipboard')}>
            <Button
              className="flex-center button-size bg-white"
              data-testid="query-entity-copy-button"
              icon={<CopyIcon height={16} width={16} />}
              onClick={onCopyToClipBoard}
            />
          </Tooltip>
        </Space>
      }
      title={title}>
      <SchemaEditor
        className="custom-code-mirror-theme"
        editorClass={classNames(
          lineCount > 4 ? 'table-query-editor' : 'query-editor'
        )}
        mode={{ name: CSMode.SQL }}
        options={{ readOnly: true }}
        value={sqlQuery}
      />
    </Card>
  );
};

export default QueryViewer;

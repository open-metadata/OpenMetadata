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
import { Button, Card, Space, Tag, Typography } from 'antd';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import { CSMode } from 'enums/codemirror.enum';
import { Table } from 'generated/entity/data/table';
import { useClipboard } from 'hooks/useClipBoard';
import { split } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './dbt-tab.style.less';
import { ReactComponent as CopyIcon } from '/assets/svg/icon-copy.svg';

const DbtTab = ({ dataModel }: { dataModel: Table['dataModel'] }) => {
  const { t } = useTranslation();

  const sqlQuery = useMemo(
    () => dataModel?.sql ?? dataModel?.rawSql ?? '',
    [dataModel]
  );
  const queryLine = useMemo(() => {
    const lineCount = split(sqlQuery, '\n').length;

    return `${lineCount} ${
      lineCount > 1 ? t('label.line-plural') : t('label.line')
    }`;
  }, [sqlQuery]);

  const { onCopyToClipBoard } = useClipboard(sqlQuery);

  return (
    <Card
      className="m-y-md dbt-tab-container"
      extra={
        <Space>
          <Tag className="query-lines" data-testid="query-line">
            {queryLine}
          </Tag>
          <Button
            className="flex-center button-size bg-white"
            data-testid="query-entity-copy-button"
            icon={<CopyIcon height={16} width={16} />}
            onClick={onCopyToClipBoard}
          />
        </Space>
      }
      title={
        <Space className="p-y-xss">
          <Typography.Text className="text-grey-muted">
            {`${t('label.path')}:`}
          </Typography.Text>
          <Typography.Text>{dataModel?.path}</Typography.Text>
        </Space>
      }>
      <SchemaEditor
        className="custom-code-mirror-theme"
        editorClass="table-query-editor"
        mode={{ name: CSMode.SQL }}
        value={sqlQuery}
      />
    </Card>
  );
};

export default DbtTab;

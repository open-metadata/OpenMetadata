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
import { Badge, Button, Card, Tooltip } from '@openmetadata/ui-core-components';
import { Copy } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, split } from 'lodash';
import { lazy, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import './query-viewer.style.less';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/SchemaEditor'))
);

const QueryViewer = ({
  title,
  sqlQuery,
  isActive,
}: {
  title?: React.ReactNode;
  sqlQuery: string;
  isActive?: boolean;
}) => {
  const { t } = useTranslation();

  const hasQuery = !isEmpty(sqlQuery);

  const { queryLine, lineCount } = useMemo(() => {
    if (!hasQuery) {
      return { queryLine: '', lineCount: 0 };
    }

    const lineCount = split(sqlQuery, '\n').length;

    return {
      queryLine: `${lineCount} ${
        lineCount > 1 ? t('label.line-plural') : t('label.line')
      }`,
      lineCount,
    };
  }, [sqlQuery, hasQuery]);

  const { onCopyToClipBoard } = useClipboard(hasQuery ? sqlQuery : '');

  return (
    <Card className="w-auto dbt-tab-container">
      {(title || hasQuery) && (
        <Card.Header
          className="tw:min-h-14 tw:items-center"
          extra={
            hasQuery ? (
              <div className="tw:flex tw:items-center tw:gap-2">
                <Badge
                  className="tw:h-6.5 tw:rounded-xl tw:bg-quaternary tw:px-2 tw:text-quaternary tw:outline-secondary"
                  data-testid="query-line"
                  size="sm">
                  {queryLine}
                </Badge>
                <Tooltip
                  placement="top end"
                  title={t('message.copy-to-clipboard')}>
                  <Button
                    aria-label={t('message.copy-to-clipboard')}
                    className="tw:size-8 tw:*:data-icon:size-4"
                    color="secondary"
                    data-testid="query-entity-copy-button"
                    iconLeading={Copy}
                    onPress={() => onCopyToClipBoard()}
                  />
                </Tooltip>
              </div>
            ) : null
          }
          title={
            title && <span className="tw:text-md tw:font-medium">{title}</span>
          }
        />
      )}
      <div className="tw:pt-px tw:pl-2">
        {hasQuery && (
          <SchemaEditor
            className="custom-code-mirror-theme"
            editorClass={classNames(
              lineCount > 4 ? 'table-query-editor' : 'query-editor'
            )}
            mode={{ name: CSMode.SQL }}
            options={{ readOnly: true }}
            refreshEditor={isActive}
            showCopyButton={false}
            value={sqlQuery}
          />
        )}
      </div>
    </Card>
  );
};

export default QueryViewer;

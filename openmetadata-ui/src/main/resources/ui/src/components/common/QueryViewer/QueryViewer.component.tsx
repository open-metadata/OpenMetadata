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
import { Badge, ButtonUtility, Card } from '@openmetadata/ui-core-components';
import { Copy01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, split } from 'lodash';
import { lazy, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { getSchemaEditorValue } from '../../../utils/SchemaEditor.utils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import NoDataPlaceholder from '../EmptyPlaceholder/NoDataPlaceholder';
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

  const { formattedQuery, queryLine, lineCount } = useMemo(() => {
    if (!hasQuery) {
      return { formattedQuery: '', queryLine: '', lineCount: 0 };
    }

    const formattedQuery = getSchemaEditorValue(sqlQuery);
    const lineCount = split(formattedQuery, '\n').length;

    return {
      formattedQuery,
      queryLine: `${lineCount} ${
        lineCount > 1 ? t('label.line-plural') : t('label.line')
      }`,
      lineCount,
    };
  }, [sqlQuery, hasQuery]);

  const { onCopyToClipBoard } = useClipboard(formattedQuery);

  return (
    <Card className="w-auto dbt-tab-container">
      {(title || hasQuery) && (
        <Card.Header
          className={classNames('tw:min-h-14 tw:items-center', {
            'tw:justify-end': !title,
          })}
          extra={
            hasQuery ? (
              <div className="tw:flex tw:items-center tw:gap-2">
                <Badge
                  className={classNames(
                    'tw:h-6.5 tw:rounded-xl tw:bg-[var(--om-legacy-color-eeeeee)] tw:px-2',
                    'tw:text-[var(--om-legacy-color-757575)]',
                    'tw:outline-utility-gray-blue-100 tw:dark:bg-quaternary',
                    'tw:dark:text-quaternary tw:dark:outline-secondary'
                  )}
                  data-testid="query-line"
                  size="sm">
                  {queryLine}
                </Badge>
                <ButtonUtility
                  data-testid="query-entity-copy-button"
                  icon={Copy01}
                  size="lg"
                  tooltip={t('message.copy-to-clipboard')}
                  tooltipPlacement="top end"
                  onClick={() => onCopyToClipBoard()}
                />
              </div>
            ) : null
          }
          title={
            title && <span className="tw:text-md tw:font-medium">{title}</span>
          }
        />
      )}
      {hasQuery ? (
        <div className="tw:pt-px tw:pl-2">
          <SchemaEditor
            autoFormat={false}
            className="custom-code-mirror-theme"
            editorClass={classNames(
              lineCount > 4 ? 'table-query-editor' : 'query-editor'
            )}
            mode={{ name: CSMode.SQL }}
            options={{ readOnly: true }}
            refreshEditor={isActive}
            showCopyButton={false}
            value={formattedQuery}
          />
        </div>
      ) : (
        <div className="tw:relative tw:min-h-60">
          <NoDataPlaceholder data-testid="no-data-placeholder" />
        </div>
      )}
    </Card>
  );
};

export default QueryViewer;

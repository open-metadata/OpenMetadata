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

import { Button, Card, Col, Row, Space, Tooltip, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import classNames from 'classnames';
import { isUndefined, split } from 'lodash';
import { Duration } from 'luxon';
import Qs from 'qs';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { ReactComponent as ExitFullScreen } from '../../../assets/svg/exit-full-screen.svg';
import { ReactComponent as FullScreen } from '../../../assets/svg/full-screen.svg';
import { ReactComponent as CopyIcon } from '../../../assets/svg/icon-copy.svg';
import {
  getTableTabPath,
  ONE_MINUTE_IN_MILLISECOND,
  PIPE_SYMBOL,
} from '../../../constants/constants';
import {
  QUERY_DATE_FORMAT,
  QUERY_LINE_HEIGHT,
} from '../../../constants/Query.constant';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { useFqn } from '../../../hooks/useFqn';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { parseSearchParams } from '../../../utils/Query/QueryUtils';
import { getQueryPath } from '../../../utils/RouterUtils';
import SchemaEditor from '../SchemaEditor/SchemaEditor';
import QueryCardExtraOption from './QueryCardExtraOption/QueryCardExtraOption.component';
import QueryUsedByOtherTable from './QueryUsedByOtherTable/QueryUsedByOtherTable.component';
import './table-queries.style.less';
import { QueryCardProp } from './TableQueries.interface';

const { Text } = Typography;

const QueryCard: FC<QueryCardProp> = ({
  isExpanded = false,
  className,
  query,
  selectedId,
  onQuerySelection,
  onQueryUpdate,
  permission,
  onUpdateVote,
  afterDeleteAction,
}: QueryCardProp) => {
  const { t } = useTranslation();
  const { fqn: datasetFQN } = useFqn();
  const location = useLocation();
  const history = useHistory();
  const { onCopyToClipBoard } = useClipboard(query.query);
  const searchFilter = useMemo(
    () => parseSearchParams(location.search),
    [location.search]
  );

  const [isEditMode, setIsEditMode] = useState(false);
  const [sqlQuery, setSqlQuery] = useState({
    query: query.query,
    isLoading: false,
  });
  const [selectedTables, setSelectedTables] = useState<DefaultOptionType[]>();

  const { isAllowExpand, queryDate } = useMemo(() => {
    const queryArr = split(query.query, '\n');
    const queryDate = customFormatDateTime(
      query.queryDate || 0,
      QUERY_DATE_FORMAT
    );

    return { isAllowExpand: queryArr.length > QUERY_LINE_HEIGHT, queryDate };
  }, [query]);

  const duration = useMemo(() => {
    const durationInMilliSeconds = query.duration;

    if (isUndefined(durationInMilliSeconds)) {
      return undefined;
    }

    if (durationInMilliSeconds < 1) {
      return `${t('label.runs-for')} ${durationInMilliSeconds} ms`;
    }

    const duration = Duration.fromObject({
      milliseconds: durationInMilliSeconds,
    });

    let formatString;
    if (durationInMilliSeconds < ONE_MINUTE_IN_MILLISECOND) {
      formatString = "s.S 'sec'";
    } else {
      formatString = "m 'min' s 'sec'";
    }

    // Format the duration as a string using the chosen format string
    return duration.toFormat(`'${t('label.runs-for')}' ${formatString}`);
  }, [query]);

  const updateSqlQuery = async () => {
    setSqlQuery((pre) => ({ ...pre, isLoading: true }));

    const updatedData = {
      ...query,
      query: query.query !== sqlQuery.query ? sqlQuery.query : query.query,
      queryUsedIn: isUndefined(selectedTables)
        ? query.queryUsedIn
        : selectedTables.map((option) => {
            const existingTable = query.queryUsedIn?.find(
              (table) => table.id === option.value
            );

            return (
              existingTable ?? {
                id: (option.value as string) ?? '',
                displayName: option.label as string,
                type: EntityType.TABLE,
              }
            );
          }),
    };
    if (query.query !== sqlQuery.query || !isUndefined(selectedTables)) {
      await onQueryUpdate(updatedData, 'query');
    }

    setSqlQuery((pre) => ({ ...pre, isLoading: false }));
    setIsEditMode(false);
  };

  const handleQueryChange = (value: string) => {
    setSqlQuery((pre) => ({ ...pre, query: value }));
  };

  const handleExpandClick = () => {
    if (isExpanded) {
      history.push({
        search: Qs.stringify(searchFilter),
        pathname: getTableTabPath(datasetFQN, 'table_queries'),
      });
    } else {
      history.push({
        search: Qs.stringify({ ...searchFilter, query: query.id }),
        pathname: getQueryPath(datasetFQN, query.id ?? ''),
      });
    }
  };

  const handleCardClick = () => {
    onQuerySelection?.(query);
  };

  return (
    <Row gutter={[0, 8]}>
      <Col span={24}>
        <Card
          bordered={false}
          className={classNames(
            'query-card-container',
            { selected: selectedId === query?.id },
            className
          )}
          extra={
            <QueryCardExtraOption
              afterDeleteAction={afterDeleteAction}
              permission={permission}
              query={query}
              onEditClick={setIsEditMode}
              onUpdateVote={onUpdateVote}
            />
          }
          title={
            <Space className="font-normal p-y-xs" size={8}>
              <Text>{queryDate}</Text>
              {duration && (
                <>
                  <Text className="text-gray-400">{PIPE_SYMBOL}</Text>
                  <Text data-testid="query-run-duration">{duration}</Text>
                </>
              )}
            </Space>
          }
          onClick={handleCardClick}>
          <Space className="query-entity-button" size={8}>
            <Button
              className="flex-center bg-white"
              data-testid="query-entity-expand-button"
              icon={
                isExpanded ? (
                  <Tooltip title={t('label.exit-fit-to-screen')}>
                    <ExitFullScreen height={16} width={16} />
                  </Tooltip>
                ) : (
                  <Tooltip title={t('label.fit-to-screen')}>
                    <FullScreen height={16} width={16} />
                  </Tooltip>
                )
              }
              onClick={handleExpandClick}
            />
            <Tooltip title={t('message.copy-to-clipboard')}>
              <Button
                className="flex-center bg-white"
                data-testid="query-entity-copy-button"
                icon={<CopyIcon height={16} width={16} />}
                onClick={onCopyToClipBoard}
              />
            </Tooltip>
          </Space>

          <div
            className={classNames(
              'sql-editor-container',
              !isExpanded && {
                'h-max-24': !isAllowExpand,
                'h-24': !isEditMode,
                'h-max-56': isEditMode && isAllowExpand,
              }
            )}>
            <SchemaEditor
              editorClass={classNames('custom-code-mirror-theme', {
                'full-screen-editor-height': isExpanded,
              })}
              mode={{ name: CSMode.SQL }}
              options={{
                styleActiveLine: isEditMode,
                readOnly: isEditMode ? false : 'nocursor',
              }}
              value={query.query ?? ''}
              onChange={handleQueryChange}
            />
          </div>
          <Row align="middle" className="p-y-xs border-top">
            <Col className="p-y-0.5 p-l-md" span={16}>
              <QueryUsedByOtherTable
                isEditMode={isEditMode}
                query={query}
                onChange={(value) => setSelectedTables(value)}
              />
            </Col>
            <Col span={8}>
              {isEditMode && (
                <Space
                  align="end"
                  className="w-full justify-end p-r-md"
                  size={16}>
                  <Button
                    data-testid="cancel-query-btn"
                    key="cancel"
                    size="small"
                    onClick={() => setIsEditMode(false)}>
                    {t('label.cancel')}
                  </Button>

                  <Button
                    data-testid="save-query-btn"
                    key="save"
                    loading={sqlQuery.isLoading}
                    size="small"
                    type="primary"
                    onClick={updateSqlQuery}>
                    {t('label.save')}
                  </Button>
                </Space>
              )}
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

export default QueryCard;

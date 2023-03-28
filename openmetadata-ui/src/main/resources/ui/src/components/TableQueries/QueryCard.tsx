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

import { Button, Card, Col, Row, Space, Typography } from 'antd';
import classNames from 'classnames';
import { getTableTabPath, SINGLE_DOT } from 'constants/constants';
import { QUERY_DATE_FORMAT, QUERY_LINE_HEIGHT } from 'constants/Query.constant';
import { split } from 'lodash';
import Qs from 'qs';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { parseSearchParams } from 'utils/Query/QueryUtils';
import { getQueryPath } from 'utils/RouterUtils';
import { getFormattedDateFromSeconds } from 'utils/TimeUtils';
import { CSMode } from '../../enums/codemirror.enum';
import SchemaEditor from '../schema-editor/SchemaEditor';
import QueryCardExtraOption from './QueryCardExtraOption/QueryCardExtraOption.component';
import QueryUsedByOtherTable from './QueryUsedByOtherTable/QueryUsedByOtherTable.component';
import { QueryCardProp } from './TableQueries.interface';
import { ReactComponent as ExitFullScreen } from '/assets/svg/exit-full-screen.svg';
import { ReactComponent as FullScreen } from '/assets/svg/full-screen.svg';

// css import
import './table-queries.style.less';

const { Text } = Typography;

const QueryCard: FC<QueryCardProp> = ({
  isExpanded = false,
  className,
  query,
  selectedId,
  tableId,
  onQuerySelection,
  onQueryUpdate,
  permission,
  onUpdateVote,
}: QueryCardProp) => {
  const { t } = useTranslation();
  const { datasetFQN } = useParams<{ datasetFQN: string }>();
  const location = useLocation();
  const history = useHistory();
  const searchFilter = useMemo(
    () => parseSearchParams(location.search),
    [location.search]
  );

  const [isEditMode, setIsEditMode] = useState(false);
  const [sqlQuery, setSqlQuery] = useState({
    query: query.query,
    isLoading: false,
  });

  const { isAllowExpand, queryDate } = useMemo(() => {
    const queryArr = split(query.query, '\n');
    const queryDate = getFormattedDateFromSeconds(
      query.queryDate || 0,
      QUERY_DATE_FORMAT
    );

    return { isAllowExpand: queryArr.length > QUERY_LINE_HEIGHT, queryDate };
  }, [query]);

  const updateSqlQuery = async () => {
    setSqlQuery((pre) => ({ ...pre, isLoading: true }));
    if (query.query !== sqlQuery.query) {
      const updatedData = {
        ...query,
        query: sqlQuery.query,
      };
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
        pathname: getQueryPath(datasetFQN, query.fullyQualifiedName || ''),
      });
    }
  };

  const handleCardClick = () => {
    onQuerySelection && onQuerySelection(query);
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
              permission={permission}
              query={query}
              onEditClick={setIsEditMode}
              onUpdateVote={onUpdateVote}
            />
          }
          title={
            <Space className="font-normal p-y-xs" size={8}>
              <Text>{queryDate}</Text>
              <Text>{SINGLE_DOT}</Text>
              <Text>{`${t('label.by-lowercase')} ${query.updatedBy}`}</Text>
            </Space>
          }
          onClick={handleCardClick}>
          <Button
            className="query-entity-expand-button bg-white"
            data-testid="query-entity-expand-button"
            icon={
              isExpanded ? (
                <ExitFullScreen height={16} width={16} />
              ) : (
                <FullScreen height={16} width={16} />
              )
            }
            size="small"
            onClick={handleExpandClick}
          />

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
              editorClass={classNames(
                'custom-code-mirror-theme',
                isExpanded && {
                  'table-query-editor': isAllowExpand,
                  'h-min-256': !isAllowExpand,
                }
              )}
              mode={{ name: CSMode.SQL }}
              options={{
                styleActiveLine: isEditMode,
                readOnly: isEditMode ? false : 'nocursor',
              }}
              value={query.query ?? ''}
              onChange={handleQueryChange}
            />
          </div>
          <Row align="middle" className="p-y-xs border-t-1">
            <Col className="p-y-xs p-l-md" span={16}>
              <QueryUsedByOtherTable query={query} tableId={tableId} />
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
                    onClick={() => setIsEditMode(false)}>
                    {t('label.cancel')}
                  </Button>

                  <Button
                    data-testid="save-query-btn"
                    key="save"
                    loading={sqlQuery.isLoading}
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

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
import {
  QUERY_DATE_FORMAT,
  QUERY_LINE_HEIGHT,
} from 'constants/entity.constants';
import { split } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

  const [expanded, setExpanded] = useState(false);
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
    setExpanded((pre) => !pre);
    onQuerySelection(query);
  };

  const handleCardClick = () => {
    onQuerySelection(query);
  };

  return (
    <Row gutter={[0, 8]}>
      <Col span={24}>
        <Card
          bodyStyle={{ padding: 0, paddingLeft: 12, paddingTop: 1 }}
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
              <Text>{t('label.single-dots-symbol')}</Text>
              <Text>{`${t('label.by-lowercase')} ${query.updatedBy}`}</Text>
            </Space>
          }
          onClick={handleCardClick}>
          {isAllowExpand && (
            <Button
              className="expand-collapse-icon bg-white"
              data-testid="expand-collapse-button"
              icon={
                expanded ? (
                  <ExitFullScreen height={16} width={16} />
                ) : (
                  <FullScreen height={16} width={16} />
                )
              }
              size="small"
              onClick={handleExpandClick}
            />
          )}

          <div
            className={classNames('sql-editor-container', {
              'h-max-24': !isAllowExpand,
              'h-24': !expanded && !isEditMode,
              'h-max-56': isEditMode && !expanded && isAllowExpand,
            })}>
            <SchemaEditor
              editorClass={classNames('custom-code-mirror-theme', {
                'table-query-editor': expanded,
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
          <Row align="middle" className="p-y-xs">
            <Col className="p-y-xs" span={16}>
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

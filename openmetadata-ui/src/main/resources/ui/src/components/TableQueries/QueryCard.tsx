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

import {
  Button,
  Card,
  Col,
  Form,
  FormProps,
  Row,
  Space,
  Typography,
} from 'antd';
import classNames from 'classnames';
import { getTableTabPath, getUserPath, PIPE_SYMBOL } from 'constants/constants';
import { QUERY_DATE_FORMAT, QUERY_LINE_HEIGHT } from 'constants/Query.constant';
import { useClipboard } from 'hooks/useClipBoard';
import { isUndefined, split } from 'lodash';
import { Duration } from 'luxon';
import Qs from 'qs';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { parseSearchParams, sqlQueryValidator } from 'utils/Query/QueryUtils';
import { getQueryPath } from 'utils/RouterUtils';
import { getFormattedDateFromSeconds } from 'utils/TimeUtils';
import { CSMode } from '../../enums/codemirror.enum';
import SchemaEditor from '../schema-editor/SchemaEditor';
import QueryCardExtraOption from './QueryCardExtraOption/QueryCardExtraOption.component';
import QueryUsedByOtherTable from './QueryUsedByOtherTable/QueryUsedByOtherTable.component';
import './table-queries.style.less';
import { QueryCardProp } from './TableQueries.interface';
import { ReactComponent as ExitFullScreen } from '/assets/svg/exit-full-screen.svg';
import { ReactComponent as FullScreen } from '/assets/svg/full-screen.svg';
import { ReactComponent as CopyIcon } from '/assets/svg/icon-copy.svg';

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
  afterDeleteAction,
}: QueryCardProp) => {
  const { t } = useTranslation();
  const { datasetFQN } = useParams<{ datasetFQN: string }>();
  const location = useLocation();
  const history = useHistory();
  const { onCopyToClipBoard } = useClipboard(query.query);
  const searchFilter = useMemo(
    () => parseSearchParams(location.search),
    [location.search]
  );
  const [form] = Form.useForm();

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

  const duration = useMemo(() => {
    const durationInSeconds = query.duration;

    if (isUndefined(durationInSeconds)) {
      return undefined;
    }

    const duration = Duration.fromObject({ seconds: durationInSeconds });

    let formatString;
    if (durationInSeconds < 1) {
      formatString = "SSS 'milisec'";
    } else if (durationInSeconds < 5) {
      formatString = "s 'sec'";
    } else {
      formatString = "m 'min'";
    }

    // Format the duration as a string using the chosen format string
    return duration.toFormat(`'${t('label.runs-for')}' ${formatString}`);
  }, [query]);

  const updateSqlQuery: FormProps['onFinish'] = async () => {
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
        pathname: getQueryPath(datasetFQN, query.id || ''),
      });
    }
  };

  const handleCardClick = () => {
    onQuerySelection && onQuerySelection(query);
  };

  useEffect(() => {
    form.setFields([
      {
        name: 'query',
        errors: [],
      },
    ]);
  }, [sqlQuery, isEditMode]);

  return (
    <Row className="query-card" gutter={[0, 8]}>
      <Col span={24}>
        <Card
          bordered={false}
          className={classNames(
            'cursor-pointer relative custom-query-editor',
            { selected: selectedId === query?.id },
            className
          )}
          data-testid="query-card-container"
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
              <Text className="text-gray-400">{PIPE_SYMBOL}</Text>
              {duration && (
                <>
                  <Text>{duration}</Text>
                  <Text className="text-gray-400">{PIPE_SYMBOL}</Text>
                </>
              )}
              {query.updatedBy && (
                <Text>
                  {`${t('label.by-lowercase')} `}
                  <Link to={getUserPath(query.updatedBy)}>
                    {query.updatedBy}
                  </Link>
                </Text>
              )}
            </Space>
          }
          onClick={handleCardClick}>
          <Space className="toasts-wrapper top-16" size={7}>
            <Button
              className="flex-center bg-white"
              data-testid="query-entity-expand-button"
              icon={
                isExpanded ? (
                  <ExitFullScreen height={16} width={16} />
                ) : (
                  <FullScreen height={16} width={16} />
                )
              }
              onClick={handleExpandClick}
            />
            <Button
              className="flex-center bg-white"
              data-testid="query-entity-copy-button"
              icon={<CopyIcon height={16} width={16} />}
              onClick={onCopyToClipBoard}
            />
          </Space>

          <Form
            form={form}
            initialValues={{
              query: sqlQuery.query,
            }}
            validateTrigger="onSubmit"
            onFinish={updateSqlQuery}>
            <Form.Item
              className={classNames('m-0', {
                'sql-editor-container': isExpanded,
              })}
              name="query"
              rules={[
                {
                  required: true,
                  message: t('label.field-required', {
                    field: t('label.sql-uppercase-query'),
                  }),
                },
                {
                  validator: (_: Record<string, any>, value: string) => {
                    if (!value) {
                      return Promise.resolve('OK');
                    }

                    return sqlQueryValidator(value);
                  },
                  message: t('message.field-text-is-invalid', {
                    fieldText: t('label.sql-uppercase-query'),
                  }),
                },
              ]}>
              <SchemaEditor
                editorClass={classNames(
                  'custom-code-mirror-theme',
                  isExpanded
                    ? 'full-screen-editor-height'
                    : {
                        'h-max-56': isEditMode && isAllowExpand,
                        'h-24': !isEditMode,
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
            </Form.Item>
            <Form.Item className="m-0">
              <Space className="w-full p-xs justify-between">
                <QueryUsedByOtherTable query={query} tableId={tableId} />
                {isEditMode && (
                  <Space className="w-full justify-end" size={12}>
                    <Button
                      data-testid="cancel-query-btn"
                      key="cancel"
                      size="small"
                      onClick={() => setIsEditMode(false)}>
                      {t('label.cancel')}
                    </Button>
                    <Button
                      data-testid="save-query-btn"
                      htmlType="submit"
                      loading={sqlQuery.isLoading}
                      size="small"
                      type="primary">
                      {t('label.save')}
                    </Button>
                  </Space>
                )}
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default QueryCard;

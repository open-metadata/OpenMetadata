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
import {
  Button,
  Card,
  Col,
  Dropdown,
  MenuProps,
  Popover,
  Row,
  Space,
  Typography,
} from 'antd';
import { ReactComponent as IconDropdown } from 'assets/svg/menu.svg';
import classNames from 'classnames';
import { Query } from 'generated/entity/data/query';
import { slice, split } from 'lodash';
import React, { FC, HTMLAttributes, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFormattedDateFromSeconds } from 'utils/TimeUtils';
import { CSMode } from '../../enums/codemirror.enum';
import SchemaEditor from '../schema-editor/SchemaEditor';
import { ReactComponent as EditIcon } from '/assets/svg/ic-edit.svg';
import { ReactComponent as CopyIcon } from '/assets/svg/icon-copy.svg';

import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { getTableDetailsPath } from 'constants/constants';
import {
  QUERY_DATE_FORMAT,
  QUERY_LINE_HEIGHT,
  QUERY_USED_BY_TABLE_VIEW_CAP,
} from 'constants/entity.constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { EntityReference } from 'generated/type/entityLineage';
import { useClipboard } from 'hooks/useClipBoard';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import './table-queries.style.less';

interface QueryCardProp extends HTMLAttributes<HTMLDivElement> {
  query: Query;
  selectedId?: string;
  tableId: string;
  permission: OperationPermission;
  onQuerySelection: (query: Query) => void;
  onQueryUpdate: (updatedQuery: Query, key: keyof Query) => Promise<void>;
}

type QueryUsedByTable = {
  topThreeTable: EntityReference[];
  remainingTable: EntityReference[];
};

const { Text, Paragraph } = Typography;

const QueryCard: FC<QueryCardProp> = ({
  className,
  query,
  selectedId,
  tableId,
  onQuerySelection,
  onQueryUpdate,
  permission,
}: QueryCardProp) => {
  const { t } = useTranslation();
  const { EditAll, EditQueries } = permission;
  const { onCopyToClipBoard } = useClipboard(query.query);
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

  const { topThreeTable, remainingTable } = useMemo(() => {
    const { queryUsedIn } = query;
    const filterTable =
      queryUsedIn?.filter((table) => table.id !== tableId) || [];
    const data: QueryUsedByTable = {
      topThreeTable: [],
      remainingTable: [],
    };

    if (filterTable.length) {
      // Slice 3 table to display upfront in UI
      data.topThreeTable = slice(filterTable, 0, QUERY_USED_BY_TABLE_VIEW_CAP);
      if (filterTable.length > QUERY_USED_BY_TABLE_VIEW_CAP) {
        // Slice remaining tables to show in "view more"
        data.remainingTable = slice(filterTable, QUERY_USED_BY_TABLE_VIEW_CAP);
      }
    }

    return data;
  }, [query]);

  const dropdownItems = useMemo(() => {
    const items: MenuProps['items'] = [
      {
        key: 'edit-query',
        label: t('label.edit'),
        icon: (
          <EditIcon
            height={16}
            opacity={EditAll || EditQueries ? 1 : 0.5}
            width={16}
          />
        ),
        disabled: !(EditAll || EditQueries),
        onClick: () => setIsEditMode(true),
        title: EditAll || EditQueries ? undefined : NO_PERMISSION_FOR_ACTION,
      },
      {
        key: 'copy-query',
        label: t('label.copy'),
        icon: <CopyIcon height={16} width={16} />,
        onClick: onCopyToClipBoard,
      },
    ];

    return items;
  }, []);

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

  return (
    <Row gutter={[0, 8]}>
      <Col span={24}>
        <Card
          bodyStyle={{ padding: 0, paddingLeft: 8, paddingTop: 1 }}
          bordered={false}
          className={classNames(
            'query-card-container',
            { selected: selectedId === query?.id },
            className
          )}
          extra={
            <Dropdown
              destroyPopupOnHide
              arrow={{ pointAtCenter: true }}
              menu={{ items: dropdownItems }}
              placement="bottom"
              trigger={['click']}>
              <Button
                className="flex-center"
                icon={<IconDropdown />}
                type="text"
              />
            </Dropdown>
          }
          title={
            <Space className="font-normal p-y-xs" size={8}>
              <Text>{queryDate}</Text>
              <Text>{`• ${t('label.by-lowercase')} ${query.updatedBy}`}</Text>
            </Space>
          }
          onClick={() => onQuerySelection(query)}>
          {isAllowExpand && (
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
          )}

          <div
            className={classNames('sql-editor-container', {
              'h-max-32': !isAllowExpand,
              'h-32': !expanded,
            })}>
            <SchemaEditor
              editorClass={classNames('custom-code-mirror-theme', {
                'table-query-editor': isAllowExpand,
              })}
              mode={{ name: CSMode.SQL }}
              options={{
                styleActiveLine: isEditMode,
                readOnly: !isEditMode,
              }}
              value={query.query ?? ''}
              onChange={handleQueryChange}
            />
          </div>
          {isEditMode && (
            <Space
              align="end"
              className="w-full justify-end p-y-xs p-r-md"
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
        </Card>
      </Col>
      <Col span={24}>
        <Paragraph className="m-l-md">
          <Text>{`${t('message.query-used-by-other-tables')}: `} </Text>
          {topThreeTable.length
            ? topThreeTable.map((table, index) => (
                <Text className="m-r-xss" key={table.name}>
                  <Link
                    to={getTableDetailsPath(table.fullyQualifiedName || '')}>
                    {/* Todo: need to remove table.id from below, once backend change for entity ref is merged */}
                    {getEntityName(table) || table.id}
                  </Link>
                  {topThreeTable.length - 1 !== index && ','}
                </Text>
              ))
            : '--'}
          {remainingTable.length ? (
            <>
              <Text className="m-r-xss">{t('label.and-lowercase')}</Text>
              <Popover
                content={
                  <Space direction="vertical">
                    {remainingTable.map((table, index) => (
                      <Text key={table.name}>
                        <Link
                          to={getTableDetailsPath(
                            table.fullyQualifiedName || ''
                          )}>
                          {/* Todo: need to remove table.id from below, once backend change for entity ref is merged */}
                          {getEntityName(table) || table.id}
                        </Link>
                        {remainingTable.length - 1 !== index && ','}
                      </Text>
                    ))}
                  </Space>
                }
                placement="bottom"
                trigger="click">
                <Text className="show-more">
                  {`${remainingTable.length} ${t('label.more-lowercase')}`}
                </Text>
              </Popover>
            </>
          ) : null}
        </Paragraph>
      </Col>
    </Row>
  );
};

export default QueryCard;

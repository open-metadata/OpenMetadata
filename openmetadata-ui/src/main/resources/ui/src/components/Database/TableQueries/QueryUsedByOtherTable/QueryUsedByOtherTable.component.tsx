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
import { Col, Popover, Row, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { isArray, isUndefined, slice, uniqBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { QUERY_USED_BY_TABLE_VIEW_CAP } from '../../../../constants/Query.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { searchData } from '../../../../rest/miscAPI';
import { getEntityLabel, getEntityName } from '../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { AsyncSelect } from '../../../common/AsyncSelect/AsyncSelect';
import Loader from '../../../common/Loader/Loader';
import {
  QueryUsedByOtherTableProps,
  QueryUsedByTable,
} from '../TableQueries.interface';

const { Text } = Typography;

const QueryUsedByOtherTable = ({
  query,
  isEditMode,
  onChange,
}: QueryUsedByOtherTableProps) => {
  const { t } = useTranslation();
  const [initialOptions, setInitialOptions] = useState<DefaultOptionType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { topThreeTable, remainingTable } = useMemo(() => {
    const { queryUsedIn } = query;

    const data: QueryUsedByTable = {
      topThreeTable: [],
      remainingTable: [],
    };

    if (!isUndefined(queryUsedIn)) {
      // Slice 3 table to display upfront in UI
      data.topThreeTable = slice(queryUsedIn, 0, QUERY_USED_BY_TABLE_VIEW_CAP);
      if (queryUsedIn.length > QUERY_USED_BY_TABLE_VIEW_CAP) {
        // Slice remaining tables to show in "view more"
        data.remainingTable = slice(queryUsedIn, QUERY_USED_BY_TABLE_VIEW_CAP);
      }
    }

    return data;
  }, [query]);

  const tableNames = useMemo(
    () => (
      <Text>
        {topThreeTable.length
          ? topThreeTable.map((table, index) => (
              <Text className="m-r-xss" key={table.name}>
                <Link
                  to={getEntityDetailsPath(
                    EntityType.TABLE,
                    table.fullyQualifiedName || ''
                  )}>
                  {getEntityName(table)}
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
                  {remainingTable.map((table) => (
                    <Link
                      key={table.id}
                      to={getEntityDetailsPath(
                        EntityType.TABLE,
                        table.fullyQualifiedName || ''
                      )}>
                      {getEntityName(table)}
                    </Link>
                  ))}
                </Space>
              }
              placement="bottom"
              trigger="click">
              <Text className="show-more" data-testid="show-more">
                {`${remainingTable.length} ${t('label.more-lowercase')}`}
              </Text>
            </Popover>
          </>
        ) : null}
      </Text>
    ),
    [topThreeTable, remainingTable]
  );

  const handleOnChange = (
    _: string[],
    options?: DefaultOptionType | DefaultOptionType[]
  ) => {
    if (isArray(options)) {
      onChange(options);
    }
  };

  const fetchTableEntity = async (
    searchValue = ''
  ): Promise<DefaultOptionType[]> => {
    try {
      const { data } = await searchData(
        searchValue,
        INITIAL_PAGING_VALUE,
        PAGE_SIZE_MEDIUM,
        '',
        '',
        '',
        SearchIndex.TABLE
      );

      return data.hits.hits.map((value) => ({
        label: getEntityLabel(value._source),
        value: value._source.id,
        labelName: getEntityName(value._source),
      }));
    } catch (error) {
      return [];
    }
  };

  const fetchInitialOptions = async () => {
    setIsLoading(true);
    try {
      const options = await fetchTableEntity();
      const { queryUsedIn = [] } = query;
      const selectedValue = queryUsedIn.map((table) => ({
        label: getEntityLabel(table),
        value: table.id,
        labelName: getEntityName(table),
      }));

      setInitialOptions(uniqBy([...selectedValue, ...options], 'labelName'));
    } catch (error) {
      setInitialOptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectList = useMemo(() => {
    const { queryUsedIn = [] } = query;

    const defaultValue = queryUsedIn.map((table) => table.id);

    return isLoading ? (
      <Loader size="small" />
    ) : (
      <AsyncSelect
        api={fetchTableEntity}
        className="w-min-30 w-full"
        data-testid="edit-query-used-in"
        defaultValue={defaultValue}
        mode="multiple"
        optionLabelProp="labelName"
        options={initialOptions}
        placeholder={t('label.please-select-entity', {
          entity: t('label.query-used-in'),
        })}
        size="small"
        onChange={handleOnChange}
      />
    );
  }, [query, initialOptions, isLoading, fetchTableEntity, handleOnChange]);

  useEffect(() => {
    if (isEditMode) {
      fetchInitialOptions();
    }
  }, [isEditMode]);

  return (
    <Row wrap data-testid="para-container">
      <Col flex="200px">
        <Text>{`${t('message.query-used-by-other-tables')}:`}</Text>
      </Col>
      <Col>{isEditMode ? selectList : tableNames}</Col>
    </Row>
  );
};

export default QueryUsedByOtherTable;

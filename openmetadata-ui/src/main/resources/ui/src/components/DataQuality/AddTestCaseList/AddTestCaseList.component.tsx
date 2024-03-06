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
import { Button, Checkbox, Col, List, Row, Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import VirtualList from 'rc-virtual-list';
import React, {
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTableTabPath, PAGE_SIZE } from '../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { TestCase } from '../../../generated/tests/testCase';
import {
  SearchHitBody,
  TestCaseSearchSource,
} from '../../../interface/search.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import {
  getColumnNameFromEntityLink,
  getEntityName,
} from '../../../utils/EntityUtils';
import { getEntityFQN } from '../../../utils/FeedUtils';
import { replacePlus } from '../../../utils/StringsUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import { AddTestCaseModalProps } from './AddTestCaseList.interface';

// Todo: need to help from backend guys for ES query
// export const getQueryFilterToExcludeTest = (testCase: EntityReference[]) => ({
//   query: {
//     bool: {
//       must_not: testCase.map((test) => ({
//         term: {
//           name: test.name,
//         },
//       })),
//     },
//   },
// });

export const AddTestCaseList = ({
  onCancel,
  existingTest,
  onSubmit,
  cancelText,
  submitText,
}: AddTestCaseModalProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [items, setItems] = useState<
    SearchHitBody<SearchIndex.TEST_CASE, TestCase>[]
  >([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, TestCase>>();
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const fetchTestCases = useCallback(
    async ({ searchText = '', page = 1 }) => {
      try {
        setIsLoading(true);
        const res = await searchQuery({
          pageNumber: page,
          pageSize: PAGE_SIZE,
          searchIndex: SearchIndex.TEST_CASE,
          query: searchText,
          // queryFilter: getQueryFilterToExcludeTest(existingTest),
        });
        const hits = res.hits.hits as SearchHitBody<
          SearchIndex.TEST_CASE,
          TestCaseSearchSource
        >[];
        setTotalCount(res.hits.total.value ?? 0);
        setItems(page === 1 ? hits : (prevItems) => [...prevItems, ...hits]);
        setPageNumber(page);
      } catch (_) {
        // Nothing here
      } finally {
        setIsLoading(false);
      }
    },
    [existingTest]
  );

  const handleSubmit = async () => {
    setIsLoading(true);
    const testCaseIds = [...(selectedItems?.values() ?? [])].map(
      (test) => test.id ?? ''
    );
    onSubmit(testCaseIds);
    setIsLoading(false);
  };

  const onScroll: UIEventHandler<HTMLElement> = useCallback(
    (e) => {
      if (
        e.currentTarget.scrollHeight - e.currentTarget.scrollTop === 500 &&
        items.length < totalCount
      ) {
        !isLoading &&
          fetchTestCases({
            searchText: searchTerm,
            page: pageNumber + 1,
          });
      }
    },
    [searchTerm, totalCount, items, isLoading]
  );

  const handleCardClick = (details: TestCase) => {
    const id = details.id;
    if (!id) {
      return;
    }
    if (selectedItems?.has(id ?? '')) {
      setSelectedItems((prevItems) => {
        const selectedItemMap = new Map();

        prevItems?.forEach(
          (item) => item.id !== id && selectedItemMap.set(item.id, item)
        );

        return selectedItemMap;
      });
    } else {
      setSelectedItems((prevItems) => {
        const selectedItemMap = new Map();

        prevItems?.forEach((item) => selectedItemMap.set(item.id, item));

        selectedItemMap.set(
          id,
          items.find(({ _source }) => _source.id === id)?._source
        );

        return selectedItemMap;
      });
    }
  };
  useEffect(() => {
    fetchTestCases({ searchText: searchTerm });
  }, [searchTerm]);

  const renderList = useMemo(() => {
    if (!isLoading && isEmpty(items)) {
      return (
        <Col span={24}>
          <Space align="center" className="w-full" direction="vertical">
            <ErrorPlaceHolder
              className="mt-0-important"
              type={ERROR_PLACEHOLDER_TYPE.FILTER}
            />
          </Space>
        </Col>
      );
    } else {
      return (
        <Col span={24}>
          <List
            loading={{
              spinning: isLoading,
              indicator: <Loader />,
            }}>
            <VirtualList
              data={items}
              height={500}
              itemKey="id"
              onScroll={onScroll}>
              {({ _source: test }) => {
                const tableFqn = getEntityFQN(test.entityLink);
                const tableName = getNameFromFQN(tableFqn);
                const isColumn = test.entityLink.includes('::columns::');

                return (
                  <Space
                    className="m-b-md border rounded-4 p-sm cursor-pointer"
                    direction="vertical"
                    onClick={() => handleCardClick(test)}>
                    <Space className="justify-between w-full">
                      <Typography.Paragraph
                        className="m-0 font-medium text-base w-max-500"
                        data-testid={test.name}
                        ellipsis={{ tooltip: true }}>
                        {getEntityName(test)}
                      </Typography.Paragraph>

                      <Checkbox checked={selectedItems?.has(test.id ?? '')} />
                    </Space>
                    <Typography.Paragraph
                      className="m-0 w-max-500"
                      ellipsis={{ tooltip: true }}>
                      {getEntityName(test.testDefinition)}
                    </Typography.Paragraph>
                    <Typography.Paragraph className="m-0">
                      <Link
                        data-testid="table-link"
                        to={getTableTabPath(tableFqn, 'profiler')}
                        onClick={(e) => e.stopPropagation()}>
                        {tableName}
                      </Link>
                    </Typography.Paragraph>
                    {isColumn && (
                      <Space>
                        <Typography.Text className="font-medium text-xs">{`${t(
                          'label.column'
                        )}:`}</Typography.Text>
                        <Typography.Text className="text-grey-muted text-xs">
                          {replacePlus(
                            getColumnNameFromEntityLink(test.entityLink)
                          ) ?? '--'}
                        </Typography.Text>
                      </Space>
                    )}
                  </Space>
                );
              }}
            </VirtualList>
          </List>
        </Col>
      );
    }
  }, [items, selectedItems, isLoading]);

  return (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <Searchbar
          removeMargin
          showClearSearch
          showLoadingStatus
          placeholder={t('label.search-entity', {
            entity: t('label.test-case-plural'),
          })}
          searchValue={searchTerm}
          onSearch={handleSearch}
        />
      </Col>
      {renderList}
      <Col className="d-flex justify-end items-center p-y-xss" span={24}>
        <Button data-testid="cancel" type="link" onClick={onCancel}>
          {cancelText ?? t('label.cancel')}
        </Button>
        <Button
          data-testid="submit"
          loading={isLoading}
          type="primary"
          onClick={handleSubmit}>
          {submitText ?? t('label.submit')}
        </Button>
      </Col>
    </Row>
  );
};

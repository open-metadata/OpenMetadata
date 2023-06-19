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
import { Checkbox, Col, List, Modal, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import Searchbar from 'components/common/searchbar/Searchbar';
import Loader from 'components/Loader/Loader';
import { getTableTabPath, PAGE_SIZE_MEDIUM } from 'constants/constants';
import { SearchIndex } from 'enums/search.enum';
import { TestCase } from 'generated/tests/testCase';
import { SearchHitBody } from 'interface/search.interface';
import VirtualList from 'rc-virtual-list';
import React, { UIEventHandler, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { searchQuery } from 'rest/searchAPI';
import { addTestCaseToLogicalTestSuite } from 'rest/testAPI';
import { getNameFromFQN } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { getDecodedFqn } from 'utils/StringsUtils';
import { getEntityFqnFromEntityLink } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { AddTestCaseModalProps } from './AddTestCaseModal.interface';

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

export const AddTestCaseModal = ({
  open,
  onCancel,
  existingTest,
  testSuiteId,
  onSubmit,
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
          pageSize: PAGE_SIZE_MEDIUM,
          searchIndex: SearchIndex.TEST_CASE,
          query: searchText,
          // queryFilter: getQueryFilterToExcludeTest(existingTest),
        });
        const hits = res.hits.hits as SearchHitBody<
          SearchIndex.TEST_CASE,
          TestCase
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

    try {
      await addTestCaseToLogicalTestSuite({ testCaseIds, testSuiteId });

      onSubmit();
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
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
    [searchTerm, totalCount, items]
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
    if (open) {
      fetchTestCases({ searchText: searchTerm });
    }
  }, [open, searchTerm]);

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      okButtonProps={{
        loading: isLoading,
      }}
      open={open}
      title={t('label.add-entity', { entity: t('label.test-case-plural') })}
      width={750}
      onCancel={onCancel}
      onOk={handleSubmit}>
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
        <Col span={24}>
          <List loading={{ spinning: false, indicator: <Loader /> }}>
            <VirtualList
              data={items}
              height={500}
              itemKey="id"
              onScroll={onScroll}>
              {({ _source: test }) => {
                const tableFqn = getEntityFqnFromEntityLink(test.entityLink);
                const tableName = getNameFromFQN(tableFqn);
                const isColumn = test.entityLink.includes('::columns::');

                return (
                  <Space
                    className="m-b-md border rounded-4 p-sm cursor-pointer"
                    direction="vertical"
                    onClick={() => handleCardClick(test)}>
                    <Space className="justify-between w-full">
                      <Typography.Paragraph
                        className="m-0 font-medium text-base"
                        data-testid={test.name}>
                        {getEntityName(test)}
                      </Typography.Paragraph>

                      <Checkbox checked={selectedItems?.has(test.id ?? '')} />
                    </Space>
                    <Typography.Paragraph className="m-0">
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
                          {getNameFromFQN(
                            getDecodedFqn(
                              getEntityFqnFromEntityLink(
                                test.entityLink,
                                isColumn
                              ),
                              true
                            )
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
      </Row>
    </Modal>
  );
};

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
import {
  Button,
  Col,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Typography,
} from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import Searchbar from 'components/common/searchbar/Searchbar';
import { TestCaseStatus } from 'generated/tests/testCase';
import QueryString from 'qs';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';

type SearchParams = {
  searchValue: string;
  status: string;
  deleted: string;
};

export const TestSuites = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();

  const params = useMemo(() => {
    const search = location.search;

    const params = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return params as SearchParams;
  }, [location]);

  const { searchValue = '', status = '', deleted } = params;

  const statusOption = useMemo(() => {
    const testCaseStatus: DefaultOptionType[] = Object.values(
      TestCaseStatus
    ).map((value) => ({
      label: value,
      value: value,
    }));
    testCaseStatus.unshift({
      label: t('label.all'),
      value: '',
    });

    return testCaseStatus;
  }, []);

  const handleSearchParam = (
    value: string | boolean,
    key: keyof SearchParams
  ) => {
    history.push({
      search: QueryString.stringify({ ...params, [key]: value }),
    });
  };

  return (
    <Row className="p-x-lg p-t-md" gutter={[16, 16]}>
      <Col span={24}>
        <Row justify="space-between">
          <Col span={8}>
            <Searchbar
              searchValue={searchValue}
              onSearch={(value) => handleSearchParam(value, 'searchValue')}
            />
          </Col>
          <Col>
            <Space size={12}>
              <div>
                <Typography.Text className="text-grey-muted">
                  {t('label.delete')}
                </Typography.Text>{' '}
                <Switch
                  checked={deleted === 'true'}
                  onChange={(value) => handleSearchParam(value, 'deleted')}
                />
              </div>
              <Select
                className="w-32"
                options={statusOption}
                placeholder={t('label.status')}
                value={status}
                onChange={(value) => handleSearchParam(value, 'status')}
              />
              <Button type="primary">
                {t('label.add-entity', { entity: t('label.test-suite') })}
              </Button>
            </Space>
          </Col>
        </Row>
      </Col>

      <Col span={24}>
        <Row gutter={16}>
          <Col span={4}>
            <Statistic title="Success" value={112893} />
          </Col>
          <Col span={4}>
            <Statistic title="Aborted" value={112893} />
          </Col>
          <Col span={4}>
            <Statistic title="Failed" value={112893} />
          </Col>
          <Col span={6}>
            <Statistic title="Success Percentage" value={112893} />
          </Col>
          <Col span={6}>
            <Statistic title="Latest Results" value={112893} />
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        <Table dataSource={[]} />
      </Col>
    </Row>
  );
};

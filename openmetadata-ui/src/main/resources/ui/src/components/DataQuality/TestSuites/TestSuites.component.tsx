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
  Switch,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from 'assets/svg/ic-delete.svg';
import { AxiosError } from 'axios';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import { LastRunGraph } from 'components/common/LastRunGraph/LastRunGraph.component';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Searchbar from 'components/common/searchbar/Searchbar';
import ProfilerProgressWidget from 'components/TableProfiler/Component/ProfilerProgressWidget';
import { ROUTES } from 'constants/constants';
import { PROGRESS_BAR_COLOR } from 'constants/TestSuite.constant';
import { TestCaseStatus } from 'generated/tests/testCase';
import { TestSuite } from 'generated/tests/testSuite';
import { EntityReference } from 'generated/type/entityReference';
import { DataQualityPageTabs } from 'pages/DataQuality/DataQualityPage.interface';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { getListTestSuites } from 'rest/testAPI';
import { getEntityName } from 'utils/EntityUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { SummaryPanel } from '../SummaryPannel/SummaryPanel.component';

type SearchParams = {
  searchValue: string;
  status: string;
  deleted: string;
};

export const TestSuites = () => {
  const { t } = useTranslation();
  const { tabs = DataQualityPageTabs.TEST_SUITES } =
    useParams<{ tabs: DataQualityPageTabs }>();
  const history = useHistory();
  const location = useLocation();

  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);

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

  const columns = useMemo(() => {
    const data: ColumnsType<TestSuite> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        fixed: true,
        width: 250,
        render: (_, record) => (
          <Typography.Paragraph>{getEntityName(record)}</Typography.Paragraph>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (text: string) =>
          text ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <Typography.Text
              className="text-grey-muted"
              data-testid="no-description">
              {t('label.no-description')}
            </Typography.Text>
          ),
      },
      {
        title: t('label.test-plural'),
        dataIndex: 'tests',
        key: 'tests',
        width: 100,
        render: () => 10,
      },
      {
        title: `${t('label.success')} %`,
        dataIndex: 'success',
        key: 'success',
        width: 150,
        render: () => (
          <ProfilerProgressWidget
            strokeColor={PROGRESS_BAR_COLOR}
            value={0.2}
          />
        ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        width: 150,
        render: (owner: EntityReference) => <OwnerLabel owner={owner} />,
      },
      {
        title: t('label.last-run'),
        dataIndex: 'lastRun',
        key: 'lastRun',
        width: 150,
        render: () => `09/may 10.36`,
      },
      {
        title: t('label.result-plural'),
        dataIndex: 'lastResults',
        key: 'lastResults',
        width: 200,
        render: () => (
          <div className="m-t-xss">
            <LastRunGraph />
          </div>
        ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        width: 100,
        key: 'actions',
        fixed: 'right',
        render: (_, record) => {
          return (
            <Row align="middle">
              <Col>
                <Tooltip placement="bottomRight">
                  <Button
                    className="flex-center"
                    data-testid={`edit-${record.name}`}
                    icon={<IconEdit width={16} />}
                    type="text"
                  />
                </Tooltip>
              </Col>
              <Col>
                <Tooltip placement="bottomLeft">
                  <Button
                    className="flex-center"
                    data-testid={`delete-${record.name}`}
                    icon={<IconDelete width={16} />}
                    type="text"
                  />
                </Tooltip>
              </Col>
            </Row>
          );
        },
      },
    ];

    return data;
  }, []);

  const handleSearchParam = (
    value: string | boolean,
    key: keyof SearchParams
  ) => {
    history.push({
      search: QueryString.stringify({ ...params, [key]: value }),
    });
  };

  const fetchTestSuites = async () => {
    try {
      const result = await getListTestSuites({ fields: 'owner,tests' });
      setTestSuites(result.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (tabs === DataQualityPageTabs.TEST_SUITES) {
      fetchTestSuites();
    }
  }, [tabs]);

  return (
    <Row className="p-x-lg p-t-md" gutter={[16, 16]}>
      <Col span={24}>
        <Row justify="space-between">
          <Col span={8}>
            <Searchbar
              removeMargin
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
              <Link to={ROUTES.ADD_TEST_SUITES}>
                <Button type="primary">
                  {t('label.add-entity', { entity: t('label.test-suite') })}
                </Button>
              </Link>
            </Space>
          </Col>
        </Row>
      </Col>

      <Col className="data-quality-summary" span={24}>
        <SummaryPanel />
      </Col>
      <Col span={24}>
        <Table
          bordered
          columns={columns}
          data-testid="test-suite-table"
          dataSource={testSuites}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          scroll={{ x: 1500 }}
          size="middle"
        />
      </Col>
    </Row>
  );
};

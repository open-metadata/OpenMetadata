/*
 *  Copyright 2021 Collate
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

import { Card, Col, Empty, Row, Table, Tabs } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, uniqueId } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPolicyByName } from '../../../axiosAPIs/rolesAPIV1';
import Description from '../../../components/common/description/Description';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import Loader from '../../../components/Loader/Loader';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/globalSettings.constants';
import { Policy } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName } from '../../../utils/CommonUtils';
import { getRoleWithFqnPath, getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './PoliciesDetail.less';

const { TabPane } = Tabs;

const RolesList = ({ roles }: { roles: EntityReference[] }) => {
  const columns: ColumnsType<EntityReference> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getRoleWithFqnPath(record.fullyQualifiedName || '')}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (_, record) => (
          <RichTextEditorPreviewer markdown={record?.description || ''} />
        ),
      },
    ];
  }, []);

  return (
    <Table
      className="roles-list-table"
      columns={columns}
      dataSource={roles}
      pagination={false}
      size="middle"
    />
  );
};

const PoliciesDetailPage = () => {
  const { fqn } = useParams<{ fqn: string }>();

  const [policy, setPolicy] = useState<Policy>({} as Policy);
  const [isLoading, setLoading] = useState<boolean>(false);

  const breadcrumb = useMemo(
    () => [
      {
        name: 'Policies',
        url: getSettingPath(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.POLICIES
        ),
      },
      {
        name: fqn,
        url: '',
      },
    ],
    [fqn]
  );

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const data = await getPolicyByName(fqn, 'owner,location,teams,roles');
      setPolicy(data ?? ({} as Policy));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div data-testid="policy-details-container">
      <TitleBreadcrumb titleLinks={breadcrumb} />
      {isEmpty(policy) ? (
        <Empty description={`No policy found for ${fqn}`} />
      ) : (
        <div className="policies-detail" data-testid="policy-details">
          <div className="tw--ml-5">
            <Description description={policy.description || ''} />
          </div>
          <Tabs defaultActiveKey="roles">
            <TabPane key="roles" tab="Roles">
              <RolesList roles={policy.roles ?? []} />
            </TabPane>
            <TabPane key="teams" tab="Teams">
              {isEmpty(policy.teams) ? (
                <Empty description="No teams found" />
              ) : (
                <Row gutter={[16, 16]}>
                  {policy.teams?.map((team) => (
                    <Col key={uniqueId()} span={6}>
                      <Card title={getEntityName(team)}>
                        <RichTextEditorPreviewer
                          markdown={team.description || ''}
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </TabPane>
            <TabPane key="rules" tab="Rules">
              {isEmpty(policy.rules) ? (
                <Empty description="No rules found" />
              ) : (
                <Row gutter={[16, 16]}>
                  {policy.rules.map((rule) => (
                    <Col key={uniqueId()} span={8}>
                      <Card title={rule.name}>
                        <RichTextEditorPreviewer
                          markdown={rule.description || ''}
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </TabPane>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default PoliciesDetailPage;

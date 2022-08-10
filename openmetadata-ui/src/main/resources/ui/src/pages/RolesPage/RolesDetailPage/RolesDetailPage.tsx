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
import { EntityReference } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRoleByName } from '../../../axiosAPIs/rolesAPIV1';
import Description from '../../../components/common/description/Description';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import Loader from '../../../components/Loader/Loader';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/globalSettings.constants';
import { Role } from '../../../generated/entity/teams/role';
import { getEntityName } from '../../../utils/CommonUtils';
import {
  getPolicyWithFqnPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './RolesDetail.less';

const { TabPane } = Tabs;

const PoliciesList = ({ policies }: { policies: EntityReference[] }) => {
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
            to={getPolicyWithFqnPath(record.fullyQualifiedName || '')}>
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
      className="policies-list-table"
      columns={columns}
      dataSource={policies}
      pagination={false}
      size="middle"
    />
  );
};

const RolesDetailPage = () => {
  const { fqn } = useParams<{ fqn: string }>();

  const [role, setRole] = useState<Role>({} as Role);
  const [isLoading, setLoading] = useState<boolean>(false);

  const breadcrumb = useMemo(
    () => [
      {
        name: 'Roles',
        url: getSettingPath(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.ROLES
        ),
      },
      {
        name: fqn,
        url: '',
      },
    ],
    [fqn]
  );

  const fetchRole = async () => {
    setLoading(true);
    try {
      const data = await getRoleByName(fqn, 'policies,teams,users');
      setRole(data ?? ({} as Role));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRole();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div data-testid="role-details-container">
      <TitleBreadcrumb titleLinks={breadcrumb} />
      {isEmpty(role) ? (
        <Empty description={`No roles found for ${fqn}`} />
      ) : (
        <div className="roles-detail" data-testid="role-details">
          <div className="tw--ml-5">
            <Description description={role.description || ''} />
          </div>
          <Tabs defaultActiveKey="policies">
            <TabPane key="policies" tab="Policies">
              <PoliciesList policies={role.policies ?? []} />
            </TabPane>
            <TabPane key="teams" tab="Teams">
              {isEmpty(role.teams) ? (
                <Empty description="No teams found" />
              ) : (
                <Row gutter={[16, 16]}>
                  {role.teams?.map((team) => (
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
            <TabPane key="users" tab="Users">
              {isEmpty(role.users) ? (
                <Empty description="No users found" />
              ) : (
                <Row gutter={[16, 16]}>
                  {role.users?.map((user) => (
                    <Col key={uniqueId()} span={6}>
                      <Card title={getEntityName(user)}>
                        <RichTextEditorPreviewer
                          markdown={user.description || ''}
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

export default RolesDetailPage;

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

import { Button, Card, Col, Row, Space, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getBots } from '../../axiosAPIs/botsAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../../components/Loader/Loader';
import { getCreateUserPath } from '../../constants/constants';
import { Bot } from '../../generated/entity/bot';
import jsonData from '../../jsons/en';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const BotsListPageV1 = () => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const history = useHistory();

  const fetchBots = () => {
    setIsLoading(true);
    getBots()
      .then((res) => {
        if (res) {
          const { data } = res;

          setBots(data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const handleAddBotClick = () => {
    history.push(getCreateUserPath(true));
  };

  const columns: ColumnsType<Bot> = useMemo(() => {
    return [
      {
        title: 'Username',
        dataIndex: 'username',
        key: 'username',
        // render: (_, record) => (
        //   <Link
        //     className="hover:tw-underline tw-cursor-pointer"
        //     to={getUserPath(record.fullyQualifiedName || record.name)}>
        //     {getEntityName(record)}
        //   </Link>
        // ),
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
      },

      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        width: 90,
        render: () => (
          <Space
            align="center"
            className="tw-w-full tw-justify-center"
            size={8}>
            <Tooltip placement="bottom" title="Delete">
              <Button
                icon={
                  <SVGIcons
                    alt="Delete"
                    className="tw-w-4"
                    icon={Icons.DELETE}
                  />
                }
                type="text"
                onClick={() => {
                  //   setSelectedUser(record);
                  //   setShowDeleteModal(true);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
  }, []);

  return (
    <>
      {/* Breadcrumbs */}
      {/* <TitleBreadcrumb
        className="tw-mb-2"
        titleLinks={[
          {
            name: 'Bots',
            url: '',
            activeTitle: true,
          },
        ]}
      /> */}
      <Row>
        <Col span={12}>
          {/* <Searchbar onSearch={(value) => console.log(value)} /> */}
        </Col>
        <Col offset={9} span={3}>
          <Button type="primary" onClick={handleAddBotClick}>
            Add Bot
          </Button>
        </Col>
        <Col span={24}>
          {bots.length ? (
            // Error placeholder
            <ErrorPlaceHolder>No bots are available</ErrorPlaceHolder>
          ) : (
            // Render Data
            <Card size="small">
              <Table<Bot>
                className="user-list-table"
                columns={columns}
                dataSource={bots}
                loading={{
                  spinning: isLoading,
                  indicator: <Loader size="small" />,
                }}
                pagination={false}
                size="middle"
              />
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
};

export default BotsListPageV1;

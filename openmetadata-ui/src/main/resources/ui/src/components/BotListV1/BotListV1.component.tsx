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

import { Button, Col, Row, Space, Switch, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, lowerCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBots } from '../../axiosAPIs/botsAPI';
import {
  getBotsPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_LARGE,
} from '../../constants/constants';
import { BOTS_DOCS } from '../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { EntityType } from '../../enums/entity.enum';
import { Bot } from '../../generated/entity/bot';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { getEntityName } from '../../utils/CommonUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import DeleteWidgetModal from '../common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import Searchbar from '../common/searchbar/Searchbar';
import Loader from '../Loader/Loader';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import { BotListV1Props } from './BotListV1.interfaces';

const BotListV1 = ({
  showDeleted,
  handleAddBotClick,
  handleShowDeleted,
}: BotListV1Props) => {
  const { permissions } = usePermissionProvider();
  const [botUsers, setBotUsers] = useState<Bot[]>([]);
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [selectedUser, setSelectedUser] = useState<Bot>();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);

  const [handleErrorPlaceholder, setHandleErrorPlaceholder] = useState(false);
  const [searchedData, setSearchedData] = useState<Bot[]>([]);

  const createPermission = checkPermission(
    Operation.Create,
    ResourceEntity.BOT,
    permissions
  );

  const deletePermission = useMemo(
    () => checkPermission(Operation.Delete, ResourceEntity.BOT, permissions),
    [permissions]
  );

  /**
   *
   * @param after - Pagination value if passed data will be fetched post cursor value
   */
  const fetchBots = async (showDeleted?: boolean, after?: string) => {
    try {
      setLoading(true);
      const { data, paging } = await getBots({
        after,
        limit: PAGE_SIZE_LARGE,
        include: showDeleted ? Include.Deleted : Include.NonDeleted,
      });
      setPaging(paging);
      setBotUsers(data);
      setSearchedData(data);
      if (!showDeleted && isEmpty(data)) {
        setHandleErrorPlaceholder(true);
      } else {
        setHandleErrorPlaceholder(false);
      }
    } catch (error) {
      showErrorToast((error as AxiosError).message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * List of columns to be shown in the table
   */
  const columns: ColumnsType<Bot> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'displayName',
        key: 'displayName',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            data-testid={`bot-link-${getEntityName(record?.botUser)}`}
            to={getBotsPath(
              record?.botUser?.fullyQualifiedName || record?.botUser?.name || ''
            )}>
            {getEntityName(record?.botUser)}
          </Link>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (_, record) =>
          record?.botUser?.description ? (
            <RichTextEditorPreviewer
              markdown={record?.botUser?.description || ''}
            />
          ) : (
            <span data-testid="no-description">No Description</span>
          ),
      },
      {
        title: 'Actions',
        dataIndex: 'id',
        key: 'id',
        width: 90,
        render: (_, record) => (
          <Space align="center" size={8}>
            <Tooltip
              placement="bottom"
              title={deletePermission ? 'Delete' : NO_PERMISSION_FOR_ACTION}>
              <Button
                data-testid={`bot-delete-${getEntityName(record?.botUser)}`}
                disabled={!deletePermission}
                icon={
                  <SVGIcons
                    alt="Delete"
                    className="tw-w-4"
                    icon={Icons.DELETE}
                  />
                }
                type="text"
                onClick={() => setSelectedUser(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    []
  );

  /**
   *
   * @param cursorValue - represents pagination value
   */
  const handlePageChange = (cursorValue: string | number) => {
    setCurrentPage(cursorValue as number);
  };

  /**
   * handle after delete bot action
   */
  const handleDeleteAction = useCallback(async () => {
    fetchBots();
  }, [selectedUser]);

  const handleSearch = (text: string) => {
    if (text) {
      const normalizeText = lowerCase(text);
      const matchedData = botUsers.filter(
        (bot) =>
          bot.name.includes(normalizeText) ||
          bot.displayName?.includes(normalizeText) ||
          bot.description?.includes(normalizeText)
      );
      setSearchedData(matchedData);
    } else {
      setSearchedData(botUsers);
    }
  };

  // Fetch initial bot
  useEffect(() => {
    setBotUsers([]);
    setSearchedData([]);
    fetchBots(showDeleted);
  }, [showDeleted]);

  return handleErrorPlaceholder ? (
    <Row>
      <Col className="w-full tw-flex tw-justify-end">
        <Space align="end" size={5}>
          <Switch
            checked={showDeleted}
            id="switch-deleted"
            size="small"
            onClick={handleShowDeleted}
          />
          <label htmlFor="switch-deleted">Show deleted</label>
        </Space>
      </Col>
      <Col className="w-full">
        <ErrorPlaceHolder
          buttons={
            <div className="tw-text-lg tw-text-center">
              <Tooltip
                placement="left"
                title={createPermission ? 'Add Bot' : NO_PERMISSION_FOR_ACTION}>
                <Button
                  ghost
                  data-testid="add-bot"
                  disabled={!createPermission}
                  type="primary"
                  onClick={handleAddBotClick}>
                  Add Bot
                </Button>
              </Tooltip>
            </div>
          }
          doc={BOTS_DOCS}
          heading="Bot"
          type="ADD_DATA"
        />
      </Col>
    </Row>
  ) : (
    <Row gutter={[16, 16]}>
      <Col span={8}>
        <Searchbar
          removeMargin
          placeholder="Search for bots..."
          typingInterval={500}
          onSearch={handleSearch}
        />
      </Col>
      <Col span={16}>
        <Space align="center" className="tw-w-full tw-justify-end" size={16}>
          <Space align="end" size={5}>
            <Switch
              checked={showDeleted}
              id="switch-deleted"
              onClick={handleShowDeleted}
            />
            <label htmlFor="switch-deleted">Show deleted</label>
          </Space>

          <Tooltip
            title={createPermission ? 'Add Bot' : NO_PERMISSION_FOR_ACTION}>
            <Button
              data-testid="add-bot"
              disabled={!createPermission}
              type="primary"
              onClick={handleAddBotClick}>
              Add Bot
            </Button>
          </Tooltip>
        </Space>
      </Col>
      <Col span={24}>
        <Row>
          <Col span={24}>
            <Table
              columns={columns}
              dataSource={searchedData}
              loading={{
                spinning: loading,
                indicator: <Loader size="small" />,
              }}
              pagination={false}
              size="small"
            />
          </Col>
          <Col span={24}>
            {paging.total > PAGE_SIZE_LARGE && (
              <NextPrevious
                currentPage={currentPage}
                pageSize={PAGE_SIZE_LARGE}
                paging={paging}
                pagingHandler={handlePageChange}
                totalCount={paging.total}
              />
            )}
          </Col>
        </Row>

        <DeleteWidgetModal
          afterDeleteAction={handleDeleteAction}
          entityId={selectedUser?.id || ''}
          entityName={selectedUser?.displayName || ''}
          entityType={EntityType.BOT}
          visible={Boolean(selectedUser)}
          onCancel={() => {
            setSelectedUser(undefined);
          }}
        />
      </Col>
    </Row>
  );
};

export default BotListV1;

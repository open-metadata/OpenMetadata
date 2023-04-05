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

import { Button, Col, Row, Space, Switch, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { isEmpty, lowerCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getBots } from 'rest/botsAPI';
import { getEntityName } from 'utils/EntityUtils';
import {
  getBotsPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_LARGE,
} from '../../constants/constants';
import { BOTS_DOCS } from '../../constants/docs.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { EntityType } from '../../enums/entity.enum';
import { Bot, ProviderType } from '../../generated/entity/bot';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import DeleteWidgetModal from '../common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import Searchbar from '../common/searchbar/Searchbar';
import PageHeader from '../header/PageHeader.component';
import Loader from '../Loader/Loader';
import { BotListV1Props } from './BotListV1.interfaces';

const BotListV1 = ({
  showDeleted,
  handleAddBotClick,
  handleShowDeleted,
}: BotListV1Props) => {
  const { isAdminUser } = useAuth();
  const { t } = useTranslation();
  const [botUsers, setBotUsers] = useState<Bot[]>([]);
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [selectedUser, setSelectedUser] = useState<Bot>();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);

  const [handleErrorPlaceholder, setHandleErrorPlaceholder] = useState(false);
  const [searchedData, setSearchedData] = useState<Bot[]>([]);

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
        title: t('label.name'),
        dataIndex: 'displayName',
        key: 'displayName',
        width: 200,
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            data-testid={`bot-link-${getEntityName(record)}`}
            to={getBotsPath(record?.fullyQualifiedName || record?.name || '')}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (_, record) =>
          record?.description ? (
            <RichTextEditorPreviewer markdown={record?.description || ''} />
          ) : (
            <span data-testid="no-description">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'id',
        key: 'id',
        width: 90,
        render: (_, record) => {
          const isSystemBot = record.provider === ProviderType.System;
          const title = isSystemBot
            ? t('message.ingestion-bot-cant-be-deleted')
            : isAdminUser
            ? t('label.delete')
            : t('message.admin-only-action');
          const isDisabled = !isAdminUser || isSystemBot;

          return (
            <Space align="center" size={8}>
              <Tooltip placement="bottom" title={title}>
                <Button
                  data-testid={`bot-delete-${getEntityName(record)}`}
                  disabled={isDisabled}
                  icon={
                    <SVGIcons
                      alt={t('label.delete')}
                      className="tw-w-4"
                      icon={Icons.DELETE}
                    />
                  }
                  type="text"
                  onClick={() => setSelectedUser(record)}
                />
              </Tooltip>
            </Space>
          );
        },
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
    fetchBots(showDeleted);
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

  const addBotLabel = t('label.add-entity', { entity: t('label.bot') });

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
          <label htmlFor="switch-deleted">{t('label.show-deleted')}</label>
        </Space>
      </Col>
      <Col className="w-full">
        <ErrorPlaceHolder
          buttons={
            <div className="tw-text-lg tw-text-center">
              <Tooltip
                placement="left"
                title={
                  isAdminUser ? addBotLabel : t('message.admin-only-action')
                }>
                <Button
                  ghost
                  data-testid="add-bot"
                  disabled={!isAdminUser}
                  type="primary"
                  onClick={handleAddBotClick}>
                  {addBotLabel}
                </Button>
              </Tooltip>
            </div>
          }
          classes="mt-24"
          doc={BOTS_DOCS}
          heading={t('label.bot')}
          type={ERROR_PLACEHOLDER_TYPE.ADD}
        />
      </Col>
    </Row>
  ) : (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <PageHeader data={PAGE_HEADERS.BOTS} />
      </Col>

      <Col span={12}>
        <Space align="center" className="tw-w-full tw-justify-end" size={16}>
          <Space align="end" size={5}>
            <Switch
              checked={showDeleted}
              id="switch-deleted"
              onClick={handleShowDeleted}
            />
            <label htmlFor="switch-deleted">{t('label.show-deleted')}</label>
          </Space>

          <Tooltip
            placement="topLeft"
            title={!isAdminUser && t('message.admin-only-action')}>
            <Button
              data-testid="add-bot"
              disabled={!isAdminUser}
              type="primary"
              onClick={handleAddBotClick}>
              {addBotLabel}
            </Button>
          </Tooltip>
        </Space>
      </Col>
      <Col span={8}>
        <Searchbar
          removeMargin
          placeholder={`${t('label.search-for-type', {
            type: t('label.bot-plural'),
          })}...`}
          typingInterval={500}
          onSearch={handleSearch}
        />
      </Col>
      <Col span={24}>
        <Row>
          <Col span={24}>
            <Table
              bordered
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
          allowSoftDelete={!showDeleted}
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

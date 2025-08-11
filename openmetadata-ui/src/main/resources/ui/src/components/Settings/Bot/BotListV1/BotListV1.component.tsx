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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Col, Row, Space, Switch, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, lowerCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { BOTS_DOCS } from '../../../../constants/docs.constants';
import { GlobalSettingsMenuCategory } from '../../../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../../../constants/PageHeaders.constant';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { Bot, ProviderType } from '../../../../generated/entity/bot';
import { Include } from '../../../../generated/type/include';
import { Paging } from '../../../../generated/type/paging';
import LimitWrapper from '../../../../hoc/LimitWrapper';
import { useAuth } from '../../../../hooks/authHooks';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { getBots } from '../../../../rest/botsAPI';
import {
  getEntityName,
  highlightSearchText,
} from '../../../../utils/EntityUtils';
import { getSettingPageEntityBreadCrumb } from '../../../../utils/GlobalSettingsUtils';
import { getBotsPath } from '../../../../utils/RouterUtils';
import { stringToHTML } from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DeleteWidgetModal from '../../../common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import Table from '../../../common/Table/Table';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../../PageHeader/PageHeader.component';
import './bot-list-v1.less';
import { BotListV1Props } from './BotListV1.interfaces';
const BotListV1 = ({
  showDeleted,
  handleAddBotClick,
  handleShowDeleted,
}: BotListV1Props) => {
  const { isAdminUser } = useAuth();
  const { t } = useTranslation();
  const [botUsers, setBotUsers] = useState<Bot[]>([]);
  const [selectedUser, setSelectedUser] = useState<Bot>();
  const [loading, setLoading] = useState(true);
  const { getResourceLimit } = useLimitStore();
  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
  } = usePaging();

  const [handleErrorPlaceholder, setHandleErrorPlaceholder] = useState(false);
  const [searchedData, setSearchedData] = useState<Bot[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () => getSettingPageEntityBreadCrumb(GlobalSettingsMenuCategory.BOTS),
    []
  );

  /**
   *
   * @param after - Pagination value if passed data will be fetched post cursor value
   */
  const fetchBots = async (showDeleted?: boolean, pagingOffset?: Paging) => {
    try {
      setLoading(true);
      const { data, paging } = await getBots({
        after: pagingOffset?.after,
        before: pagingOffset?.before,
        limit: pageSize,
        include: showDeleted ? Include.Deleted : Include.NonDeleted,
      });
      handlePagingChange(paging);
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
        render: (_, record) => {
          const name = getEntityName(record);
          const fqn = record.fullyQualifiedName || record.name || '';

          return (
            <Link data-testid={`bot-link-${name}`} to={getBotsPath(fqn)}>
              <Typography.Text
                className="text-ellipsis bot-link"
                ellipsis={{ tooltip: true }}>
                {stringToHTML(highlightSearchText(name, searchTerm))}
              </Typography.Text>
            </Link>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (_, record) =>
          record?.description ? (
            <RichTextEditorPreviewerNew
              markdown={highlightSearchText(
                record?.description || '',
                searchTerm
              )}
            />
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
            <Tooltip placement="topRight" title={title}>
              <Button
                data-testid={`bot-delete-${record.name}`}
                disabled={isDisabled}
                icon={
                  <Icon
                    className="align-middle"
                    component={IconDelete}
                    style={{ fontSize: '16px' }}
                  />
                }
                type="text"
                onClick={() => setSelectedUser(record)}
              />
            </Tooltip>
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
  const handleBotPageChange = ({
    currentPage,
    cursorType,
  }: PagingHandlerParams) => {
    handlePageChange(currentPage);
    cursorType &&
      fetchBots(false, {
        [cursorType]: paging[cursorType],
        total: paging.total,
      } as Paging);
  };

  /**
   * handle after delete bot action
   */
  const handleDeleteAction = useCallback(async () => {
    await getResourceLimit('bot', true, true);
    fetchBots(showDeleted);
  }, [selectedUser]);

  const handleSearch = (text: string) => {
    setSearchTerm(text);
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
  }, [showDeleted, pageSize]);

  const addBotLabel = t('label.add-entity', { entity: t('label.bot') });

  return handleErrorPlaceholder ? (
    <Row>
      <Col className="w-full d-flex justify-end">
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
          className="mt-24"
          doc={BOTS_DOCS}
          heading={t('label.bot')}
          permission={isAdminUser}
          permissionValue={t('label.create-entity', {
            entity: t('label.bot'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={handleAddBotClick}
        />
      </Col>
    </Row>
  ) : (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </Col>

      <Col span={12}>
        <PageHeader data={PAGE_HEADERS.BOTS} />
      </Col>

      <Col span={12}>
        <Space align="center" className="w-full justify-end" size={16}>
          <Space align="end" size={5}>
            <Switch
              checked={showDeleted}
              data-testid="switch-deleted"
              id="switch-deleted"
              onClick={handleShowDeleted}
            />
            <label htmlFor="switch-deleted">{t('label.show-deleted')}</label>
          </Space>

          <Tooltip
            placement="topLeft"
            title={!isAdminUser && t('message.admin-only-action')}>
            <LimitWrapper resource="bot">
              <Button
                data-testid="add-bot"
                disabled={!isAdminUser}
                type="primary"
                onClick={handleAddBotClick}>
                {addBotLabel}
              </Button>
            </LimitWrapper>
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
      <Col className="bot-list-v1-container" span={24}>
        <Table
          columns={columns}
          customPaginationProps={{
            currentPage,
            isLoading: loading,
            pageSize,
            paging,
            pagingHandler: handleBotPageChange,
            onShowSizeChange: handlePageSizeChange,
            showPagination,
          }}
          dataSource={searchedData}
          loading={loading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowKey="name"
          size="small"
        />
      </Col>

      <DeleteWidgetModal
        afterDeleteAction={handleDeleteAction}
        allowSoftDelete={!showDeleted}
        entityId={selectedUser?.id || ''}
        entityName={getEntityName(selectedUser)}
        entityType={EntityType.BOT}
        visible={Boolean(selectedUser)}
        onCancel={() => {
          setSelectedUser(undefined);
        }}
      />
    </Row>
  );
};

export default BotListV1;

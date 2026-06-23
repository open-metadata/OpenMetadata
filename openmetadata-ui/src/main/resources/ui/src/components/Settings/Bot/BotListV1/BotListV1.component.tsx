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
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { INITIAL_PAGING_VALUE } from '../../../../constants/constants';
import { BOTS_DOCS } from '../../../../constants/docs.constants';
import { GlobalSettingsMenuCategory } from '../../../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../../../constants/PageHeaders.constant';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Bot, ProviderType } from '../../../../generated/entity/bot';
import { User } from '../../../../generated/entity/teams/user';
import { Include } from '../../../../generated/type/include';
import { Paging } from '../../../../generated/type/paging';
import LimitWrapper from '../../../../hoc/LimitWrapper';
import { useAuth } from '../../../../hooks/authHooks';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { getBots } from '../../../../rest/botsAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { formatUsersResponse } from '../../../../utils/APIUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { highlightSearchText } from '../../../../utils/EntitySearchUtils';
import { getSettingPageEntityBreadCrumb } from '../../../../utils/GlobalSettingsUtils';
import { getBotsPath } from '../../../../utils/RouterUtils';
import {
  escapeESReservedCharacters,
  stringToHTML,
} from '../../../../utils/StringUtils';
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

const BOT_SEARCH_PAGE_SIZE = 100;
const MAX_BOT_SEARCH_LENGTH = 128;

const getBotUserFromUser = (
  botUser: User,
  existingBotUser?: Bot['botUser']
): Bot['botUser'] => ({
  ...existingBotUser,
  id: botUser.id,
  name: botUser.name,
  displayName: botUser.displayName,
  fullyQualifiedName: botUser.fullyQualifiedName,
  type: existingBotUser?.type ?? EntityType.USER,
});

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
    pagingCursor,
  } = usePaging();

  const [handleErrorPlaceholder, setHandleErrorPlaceholder] = useState(false);
  const [searchedData, setSearchedData] = useState<Bot[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const latestSearchRequest = useRef(0);
  const botsByUserNameRef = useRef<Map<string, Bot>>(new Map());
  const botMapLoadPromiseRef = useRef<Promise<void> | null>(null);

  const loadBotsByUserNameMap = useCallback(async () => {
    const { data } = await getBots({
      limit: BOT_SEARCH_PAGE_SIZE,
      include: showDeleted ? Include.Deleted : Include.NonDeleted,
    });
    const map = new Map<string, Bot>();
    data.forEach((bot) => {
      if (bot.name) {
        map.set(bot.name.toLowerCase(), bot);
      }
    });
    botsByUserNameRef.current = map;
  }, [showDeleted]);

  const ensureBotMapLoaded = useCallback(() => {
    if (!botMapLoadPromiseRef.current) {
      botMapLoadPromiseRef.current = loadBotsByUserNameMap().catch((error) => {
        botMapLoadPromiseRef.current = null;
        showErrorToast((error as AxiosError).message);
      });
    }

    return botMapLoadPromiseRef.current;
  }, [loadBotsByUserNameMap]);

  const reloadBotMap = useCallback(() => {
    botMapLoadPromiseRef.current = null;
    botsByUserNameRef.current = new Map();

    return ensureBotMapLoaded();
  }, [ensureBotMapLoaded]);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () => getSettingPageEntityBreadCrumb(GlobalSettingsMenuCategory.BOTS),
    []
  );

  const enrichBotWithMatchedUser = useCallback((bot: Bot, botUser?: User) => {
    if (!botUser) {
      return bot;
    }

    return {
      ...bot,
      botUser: getBotUserFromUser(botUser, bot.botUser),
    };
  }, []);

  const searchBots = async (text: string): Promise<Bot[]> => {
    const term = text.trim();

    if (!term) {
      return [];
    }

    const wildcardPattern = `*${escapeESReservedCharacters(term)}*`;

    const response = await searchQuery({
      query: '',
      pageNumber: 1,
      pageSize: BOT_SEARCH_PAGE_SIZE,
      includeDeleted: showDeleted,
      searchIndex: SearchIndex.USER,
      queryFilter: {
        query: {
          bool: {
            must: [{ term: { isBot: true } }],
            should: [
              'name.keyword',
              'displayName.keyword',
              'fullyQualifiedName.keyword',
              'email.keyword',
            ].map((field) => ({
              wildcard: {
                [field]: { value: wildcardPattern, case_insensitive: true },
              },
            })),
            minimum_should_match: 1,
          },
        },
      },
    });
    const matchedUsers = formatUsersResponse(response.hits.hits);
    await ensureBotMapLoaded();
    const botsByUserName = botsByUserNameRef.current;
    const usersByBotName = new Map<string, User>(
      matchedUsers
        .filter((user): user is User & { name: string } => Boolean(user.name))
        .map((user) => [user.name.toLowerCase(), user])
    );

    const lowerTerm = term.toLowerCase();
    const matchedById = new Map<string, Bot>();

    botsByUserName.forEach((bot, key) => {
      if (!bot.id) {
        return;
      }

      const user = usersByBotName.get(key);
      const matchesBot =
        key.includes(lowerTerm) ||
        bot.displayName?.toLowerCase().includes(lowerTerm) ||
        bot.description?.toLowerCase().includes(lowerTerm);

      if (user || matchesBot) {
        matchedById.set(bot.id, enrichBotWithMatchedUser(bot, user));
      }
    });

    return Array.from(matchedById.values());
  };

  const runActiveSearch = async (activeSearchTerm: string) => {
    const searchRequestId = ++latestSearchRequest.current;

    try {
      const matchedBots = await searchBots(activeSearchTerm);

      if (searchRequestId === latestSearchRequest.current) {
        setSearchedData(matchedBots);
      }
    } catch (error) {
      if (searchRequestId === latestSearchRequest.current) {
        showErrorToast((error as AxiosError).message);
        setSearchedData([]);
      }
    }
  };

  /**
   *
   * @param after - Pagination value if passed data will be fetched post cursor value
   */
  const fetchBots = async (
    showDeleted?: boolean,
    pagingOffset?: Partial<Paging>
  ) => {
    try {
      setLoading(true);
      const { data, paging } = await getBots({
        after: pagingOffset?.after,
        before: pagingOffset?.before,
        limit: pageSize,
        include: showDeleted ? Include.Deleted : Include.NonDeleted,
      });
      const activeSearchTerm = searchTerm.trim();

      handlePagingChange(paging);
      setBotUsers(data);
      if (activeSearchTerm) {
        await runActiveSearch(activeSearchTerm);
      } else {
        setSearchedData(data);
      }
      setHandleErrorPlaceholder(!showDeleted && isEmpty(data));
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
        render: (_, record) => (
          <RichTextEditorPreviewerNew
            markdown={highlightSearchText(
              record?.description || '',
              searchTerm
            )}
          />
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
    [t, searchTerm, isAdminUser]
  );

  /**
   *
   * @param cursorValue - represents pagination value
   */
  const handleBotPageChange = ({
    currentPage,
    cursorType,
  }: PagingHandlerParams) => {
    if (cursorType) {
      fetchBots(false, {
        [cursorType]: paging[cursorType],
        total: paging.total,
      } as Paging);
      handlePageChange(
        currentPage,
        { cursorType, cursorValue: paging[cursorType] },
        pageSize
      );
    }
  };

  /**
   * handle after delete bot action
   */
  const handleDeleteAction = useCallback(async () => {
    await getResourceLimit('bot', true, true);
    await reloadBotMap();
    fetchBots(showDeleted);
  }, [selectedUser, reloadBotMap]);

  const handleSearch = async (text: string) => {
    const cappedText = text.slice(0, MAX_BOT_SEARCH_LENGTH);
    setSearchTerm(cappedText);
    const normalizedSearchTerm = cappedText.trim();

    if (!normalizedSearchTerm) {
      latestSearchRequest.current += 1;
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
      setSearchedData(botUsers);
      setLoading(false);

      return;
    }

    const currentSearchRequestId = latestSearchRequest.current + 1;
    setLoading(true);

    try {
      await runActiveSearch(normalizedSearchTerm);
    } finally {
      if (latestSearchRequest.current === currentSearchRequestId) {
        setLoading(false);
      }
    }
  };

  const handleShowDeletedBots = (checked: boolean) => {
    handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
    handleShowDeleted(checked);
  };
  // Fetch initial bot
  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    setBotUsers([]);
    setSearchedData([]);
    if (cursorType && cursorValue) {
      fetchBots(showDeleted, { [cursorType]: cursorValue });
    } else {
      fetchBots(showDeleted);
    }
  }, [pageSize, showDeleted, pagingCursor]);

  // Build bot-user → bot map once for search resolution.
  // Re-runs when showDeleted toggles (loadBotsByUserNameMap dep changes).
  useEffect(() => {
    botMapLoadPromiseRef.current = null;
    botsByUserNameRef.current = new Map();
    ensureBotMapLoaded();
  }, [ensureBotMapLoaded]);

  const addBotLabel = t('label.add-entity', { entity: t('label.bot') });

  return handleErrorPlaceholder ? (
    <Row>
      <Col className="w-full d-flex justify-end">
        <Space align="end" size={5}>
          <Switch
            checked={showDeleted}
            id="switch-deleted"
            size="small"
            onClick={handleShowDeletedBots}
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
        <PageHeader
          data={{
            header: t(PAGE_HEADERS.BOTS.header),
            subHeader: t(PAGE_HEADERS.BOTS.subHeader),
          }}
        />
      </Col>

      <Col span={12}>
        <Space align="center" className="w-full justify-end" size={16}>
          <Space align="end" size={5}>
            <Switch
              checked={showDeleted}
              data-testid="switch-deleted"
              id="switch-deleted"
              onClick={handleShowDeletedBots}
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
            showPagination: showPagination && !searchTerm.trim(),
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

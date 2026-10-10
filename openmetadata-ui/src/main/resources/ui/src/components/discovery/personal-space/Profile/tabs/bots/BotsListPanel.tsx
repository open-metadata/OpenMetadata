/*
 *  Copyright 2026 Collate.
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
  Box,
  Button,
  ButtonUtility,
  EmptyPlaceholder,
  Input,
  PaginationCardWithControls,
  Skeleton,
  Table,
  TableCard,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  NoSearch,
  Search,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../../../constants/constants';
import { useLimitStore } from '../../../../../../context/LimitsProvider/useLimitsStore';
import { EntityType } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { Bot, ProviderType } from '../../../../../../generated/entity/bot';
import { User } from '../../../../../../generated/entity/teams/user';
import { Include } from '../../../../../../generated/type/include';
import { Paging } from '../../../../../../generated/type/paging';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { getBots } from '../../../../../../rest/botsAPI';
import { searchQuery } from '../../../../../../rest/searchAPI';
import { formatUsersResponse } from '../../../../../../utils/APIUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { escapeESReservedCharacters } from '../../../../../../utils/StringUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import DeleteEntityModal from '../../../../../common/DeleteWidget/DeleteEntityModal';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { BotsView } from './BotsPanel.types';

const BOT_SEARCH_PAGE_SIZE = 100;

type BotColumnId = 'name' | 'description' | 'actions';
type BotColumn = { id: BotColumnId; label: string; className?: string };

interface BotsListPanelProps {
  refreshKey?: number;
  onNavigate: (view: BotsView) => void;
}

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

const BotsListPanel: React.FC<BotsListPanelProps> = ({
  refreshKey,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { getResourceLimit } = useLimitStore();
  const { state: hashState, updateParams } = useSettingsHash();

  const [bots, setBots] = useState<Bot[]>([]);
  const [searchedData, setSearchedData] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<Bot>();
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const [currentPage, setCurrentPage] = useState(
    Number(hashState.params.page) || 1
  );
  const [pageSize, setPageSize] = useState(
    Number(hashState.params.pageSize) || PAGE_SIZE_BASE
  );
  const [reloadKey, setReloadKey] = useState(0);
  const fetchRequestIdRef = useRef(0);
  const latestSearchRequest = useRef(0);
  const botsByUserNameRef = useRef<Map<string, Bot>>(new Map());
  const botMapLoadPromiseRef = useRef<Promise<void> | null>(null);
  const searchTermRef = useRef(searchTerm);
  searchTermRef.current = searchTerm;

  const showPagination = useMemo(
    () => Boolean(paging.before || paging.after) || paging.total > pageSize,
    [paging, pageSize]
  );

  const columns: BotColumn[] = useMemo(
    () => [
      { id: 'name', label: t('label.name') },
      { id: 'description', label: t('label.description') },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-20' },
    ],
    [t]
  );

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
    botMapLoadPromiseRef.current ??= loadBotsByUserNameMap().catch((error) => {
      botMapLoadPromiseRef.current = null;
      showErrorToast((error as AxiosError).message);
    });

    return botMapLoadPromiseRef.current;
  }, [loadBotsByUserNameMap]);

  const searchBots = useCallback(
    async (text: string): Promise<Bot[]> => {
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
                  [field]: {
                    value: wildcardPattern,
                    case_insensitive: true,
                  },
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
          matchedById.set(
            bot.id,
            user
              ? { ...bot, botUser: getBotUserFromUser(user, bot.botUser) }
              : bot
          );
        }
      });

      return Array.from(matchedById.values());
    },
    [showDeleted, ensureBotMapLoaded]
  );

  const fetchBots = useCallback(
    async (pagingOffset?: Partial<Paging>) => {
      const requestId = ++fetchRequestIdRef.current;
      setIsLoading(true);

      try {
        const { data, paging: newPaging } = await getBots({
          after: pagingOffset?.after,
          before: pagingOffset?.before,
          limit: pageSize,
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
        });

        if (requestId !== fetchRequestIdRef.current) {
          return;
        }

        setPaging(newPaging);
        setBots(data);

        const activeTerm = searchTermRef.current.trim();

        if (activeTerm) {
          const searchRequestId = ++latestSearchRequest.current;

          try {
            const results = await searchBots(activeTerm);

            if (searchRequestId === latestSearchRequest.current) {
              setSearchedData(results);
            }
          } catch (error) {
            if (searchRequestId === latestSearchRequest.current) {
              showErrorToast(error as AxiosError);
              setSearchedData([]);
            }
          }
        } else {
          setSearchedData(data);
        }
      } catch (error) {
        if (requestId === fetchRequestIdRef.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [pageSize, showDeleted, searchBots]
  );

  const handleSearch = useCallback(
    async (value: string) => {
      setSearchTerm(value);
      const term = value.trim();

      if (!term) {
        latestSearchRequest.current += 1;
        setSearchedData(bots);
        setIsLoading(false);

        return;
      }

      const searchRequestId = ++latestSearchRequest.current;
      setIsLoading(true);

      try {
        const results = await searchBots(term);

        if (searchRequestId === latestSearchRequest.current) {
          setSearchedData(results);
        }
      } catch (error) {
        if (searchRequestId === latestSearchRequest.current) {
          showErrorToast(error as AxiosError);
          setSearchedData([]);
        }
      } finally {
        if (searchRequestId === latestSearchRequest.current) {
          setIsLoading(false);
        }
      }
    },
    [bots, searchBots]
  );

  const handleDeleteAction = useCallback(() => {
    getResourceLimit('bot', true, true);
    setSelectedBot(undefined);
    botMapLoadPromiseRef.current = null;
    botsByUserNameRef.current = new Map();
    setReloadKey((k) => k + 1);
  }, [getResourceLimit]);

  const handlePageChange = useCallback(
    (page: number) => {
      const cursorType = page > currentPage ? 'after' : 'before';
      const cursor = cursorType === 'after' ? paging.after : paging.before;

      setCurrentPage(page);
      updateParams({
        page: String(page),
        cursorType,
        cursor,
        pageSize: String(pageSize),
      });
      fetchBots(cursor ? { [cursorType]: cursor } : undefined);
    },
    [paging, currentPage, pageSize, updateParams, fetchBots]
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize);
      setCurrentPage(1);
      updateParams({
        page: '1',
        cursorType: undefined,
        cursor: undefined,
        pageSize: String(newSize),
      });
    },
    [updateParams]
  );

  const handleShowDeletedToggle = useCallback(
    (checked: boolean) => {
      setShowDeleted(checked);
      setCurrentPage(1);
      updateParams({
        page: '1',
        cursorType: undefined,
        cursor: undefined,
      });
    },
    [updateParams]
  );

  const initialFetchRef = useRef(true);
  const initialParamsRef = useRef(hashState.params);

  useEffect(() => {
    if (initialFetchRef.current) {
      initialFetchRef.current = false;
      const { cursor, cursorType } = initialParamsRef.current;
      fetchBots(cursor && cursorType ? { [cursorType]: cursor } : undefined);
    } else {
      fetchBots();
    }
  }, [fetchBots, reloadKey, refreshKey]);

  // Bot map loads lazily on first search; clear it when the showDeleted-dependent
  // loader changes so search never filters against a stale-include map.
  useEffect(() => {
    botMapLoadPromiseRef.current = null;
    botsByUserNameRef.current = new Map();
  }, [loadBotsByUserNameMap]);

  const renderCell = useCallback(
    (bot: Bot, columnId: BotColumnId) => {
      if (columnId === 'name') {
        const name = getEntityName(bot);

        return (
          <Button
            color="link-color"
            data-testid={`bot-link-${name}`}
            size="sm"
            onPress={() =>
              onNavigate({
                type: 'detail',
                fqn: bot.fullyQualifiedName ?? bot.name ?? '',
                name,
              })
            }>
            {name}
          </Button>
        );
      }

      if (columnId === 'description') {
        return bot.description ? (
          <RichTextEditorPreviewerV1 markdown={bot.description} />
        ) : (
          <Typography className="tw:text-tertiary">--</Typography>
        );
      }

      if (columnId === 'actions') {
        const isSystemBot = bot.provider === ProviderType.System;
        const isDisabled = !isAdminUser || isSystemBot;
        let tooltipContent = t('label.delete');

        if (isSystemBot) {
          tooltipContent = t('message.ingestion-bot-cant-be-deleted');
        } else if (!isAdminUser) {
          tooltipContent = t('message.admin-only-action');
        }

        return (
          <ButtonUtility
            color="tertiary"
            data-testid={`bot-delete-${bot.name}`}
            icon={Trash01}
            isDisabled={isDisabled}
            size="xs"
            tooltip={tooltipContent}
            onPress={() => setSelectedBot(bot)}
          />
        );
      }

      return null;
    },
    [isAdminUser, onNavigate, t]
  );

  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <Box className="tw:p-3" direction="col" gap={2}>
          {Array.from({ length: pageSize }, (_, i) => (
            <Skeleton height={28} key={i} variant="rounded" />
          ))}
        </Box>
      );
    }

    if (searchTerm.trim()) {
      return (
        <div className="tw:relative tw:min-h-60">
          <EmptyPlaceholder
            data-testid="search-error-placeholder"
            description={t('message.check-spelling-or-try-different-term')}
            icon={<NoSearch className="tw:text-quaternary" />}
            title={t('label.no-matching-results')}
          />
        </div>
      );
    }

    return (
      <div className="tw:relative tw:min-h-60">
        <EmptyPlaceholder
          actions={
            isAdminUser && !showDeleted
              ? [
                  {
                    color: 'primary' as const,
                    key: 'add-bot',
                    label: t('label.add-entity', {
                      entity: t('label.bot'),
                    }),
                    onPress: () => onNavigate({ type: 'add' }),
                  },
                ]
              : undefined
          }
          title={t('label.no-entity-found', {
            entity: t('label.bot-plural'),
          })}
        />
      </div>
    );
  }, [
    isAdminUser,
    isLoading,
    onNavigate,
    pageSize,
    searchTerm,
    showDeleted,
    t,
  ]);

  return (
    <Box
      className="tw:pt-1 tw:h-full tw:px-8 tw:pb-8"
      data-testid="bots-list-panel"
      direction="col"
      gap={4}>
      <TableCard.Root className="tw:flex tw:flex-col" size="compact">
        <Box
          align="center"
          className="tw:border-b tw:border-subtle tw:px-4 tw:py-3"
          direction="row"
          justify="between">
          <Input
            className="tw:max-w-xs"
            data-testid="searchbar"
            icon={Search}
            placeholder={`${t('label.search-for-type', {
              type: t('label.bot-plural'),
            })}...`}
            value={searchTerm}
            onChange={(val) => handleSearch(val)}
          />
          <Box align="center" direction="row" gap={2}>
            <Toggle
              data-testid="switch-deleted"
              isSelected={showDeleted}
              size="sm"
              onChange={handleShowDeletedToggle}
            />
            <Typography size="text-sm">{t('label.show-deleted')}</Typography>
          </Box>
        </Box>
        <div className="tw:overflow-y-auto">
          <Table
            aria-label={t('label.bot-plural')}
            className="tw:table-fixed"
            data-testid="bots-list-table"
            size="compact">
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Head
                  className={col.className}
                  id={col.id}
                  isRowHeader={col.id === 'name'}
                  key={col.id}
                  label={col.label}
                />
              )}
            </Table.Header>
            <Table.Body
              items={isLoading ? [] : searchedData}
              renderEmptyState={renderEmptyState}>
              {(bot) => (
                <Table.Row
                  columns={columns}
                  data-testid={`bot-row-${bot.name}`}
                  id={bot.id ?? bot.name ?? ''}
                  key={bot.id ?? bot.name}>
                  {(col) => (
                    <Table.Cell className={col.className} key={col.id}>
                      {renderCell(bot, col.id)}
                    </Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
        {showPagination && !searchTerm.trim() && (
          <PaginationCardWithControls
            page={currentPage}
            pageSize={pageSize}
            pageSizeOptions={[
              PAGE_SIZE_BASE,
              PAGE_SIZE_MEDIUM,
              PAGE_SIZE_LARGE,
            ]}
            total={Math.ceil((paging.total ?? 0) / pageSize)}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </TableCard.Root>

      <DeleteEntityModal
        afterDeleteAction={handleDeleteAction}
        allowSoftDelete={!showDeleted}
        entityId={selectedBot?.id ?? ''}
        entityName={getEntityName(selectedBot)}
        entityType={EntityType.BOT}
        visible={Boolean(selectedBot)}
        onCancel={() => setSelectedBot(undefined)}
      />
    </Box>
  );
};

export default BotsListPanel;

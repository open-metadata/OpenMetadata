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
import { Button, Modal, Radio, Space, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { ReactComponent as IconRemove } from '../../../assets/svg/ic-remove.svg';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/domains/domain';
import { usePaging } from '../../../hooks/paging/usePaging';
import {
  addMembersToDomain,
  removeMembersFromDomain,
} from '../../../rest/domainAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import { UserTag } from '../../common/UserTag/UserTag.component';
import { UserTagSize } from '../../common/UserTag/UserTag.interface';
import {
  DomainMember,
  DomainMemberSearchSource,
  DomainMembersTabProps,
} from './DomainMembersTab.interface';

const UserTeamSelectableList = withSuspenseFallback(
  lazy(() =>
    import(
      '../../common/UserTeamSelectableList/UserTeamSelectableList.component'
    ).then((m) => ({ default: m.UserTeamSelectableList }))
  ),
  null
);

// stable reference: an inline [] would reset the picker's selection on every
// parent re-render (UserTeamSelectableList syncs its state from `owner`)
const EMPTY_SELECTION: EntityReference[] = [];

export const DomainMembersTab = ({
  domainFqn,
  permissions,
}: DomainMembersTabProps) => {
  const { t } = useTranslation();
  const [memberType, setMemberType] = useState<
    EntityType.USER | EntityType.TEAM
  >(EntityType.USER);
  const [members, setMembers] = useState<DomainMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [removingMember, setRemovingMember] = useState<DomainMember>();
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const hasEditPermission = Boolean(permissions?.EditAll);

  const toDomainMembers = useCallback(
    (sources: DomainMemberSearchSource[], type: EntityType): DomainMember[] =>
      sources.map((source) => ({
        reference: {
          id: source.id,
          type,
          name: source.name,
          displayName: source.displayName,
          fullyQualifiedName: source.fullyQualifiedName,
        },
        inherited: (source.domains ?? []).some(
          (memberDomain) =>
            memberDomain.fullyQualifiedName === domainFqn &&
            Boolean(memberDomain.inherited)
        ),
      })),
    [domainFqn]
  );

  const fetchMembers = useCallback(
    async (
      type: EntityType.USER | EntityType.TEAM,
      pageNumber: number,
      search: string
    ) => {
      setIsLoading(true);
      try {
        const res = await searchQuery({
          query: search || '',
          pageNumber,
          pageSize,
          queryFilter: getTermQuery({
            'domains.fullyQualifiedName': domainFqn,
            ...(type === EntityType.USER ? { isBot: 'false' } : {}),
          }),
          sortField: 'displayName.keyword',
          sortOrder: 'asc',
          searchIndex:
            type === EntityType.USER ? SearchIndex.USER : SearchIndex.TEAM,
        });

        setMembers(
          toDomainMembers(
            res.hits.hits.map((hit) => hit._source as DomainMemberSearchSource),
            type
          )
        );
        handlePagingChange({ total: res.hits.total.value });
      } catch (error) {
        setMembers([]);
        handlePagingChange({ total: 0 });
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.user-and-team-plural'),
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    [domainFqn, pageSize, toDomainMembers, handlePagingChange, t]
  );

  useEffect(() => {
    if (domainFqn) {
      fetchMembers(memberType, currentPage, searchText);
    }
  }, [domainFqn, memberType, pageSize]);

  const handleMemberTypeChange = (type: EntityType.USER | EntityType.TEAM) => {
    setMemberType(type);
    setSearchText('');
    handlePageChange(INITIAL_PAGING_VALUE);
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    handlePageChange(INITIAL_PAGING_VALUE);
    fetchMembers(memberType, INITIAL_PAGING_VALUE, text);
  };

  const handlePaging = ({ currentPage: page }: PagingHandlerParams) => {
    handlePageChange(page);
    fetchMembers(memberType, page, searchText);
  };

  const handleAddMembers = async (selected: EntityReference[] = []) => {
    if (isEmpty(selected)) {
      return;
    }

    try {
      await addMembersToDomain(domainFqn, selected);
      const addedOfCurrentType = selected.filter(
        (item) =>
          item.type === memberType &&
          !members.some((member) => member.reference.id === item.id)
      );
      setMembers((prev) => [
        ...addedOfCurrentType.map((reference) => ({
          reference,
          inherited: false,
        })),
        ...prev,
      ]);
      handlePagingChange({
        total: (paging.total ?? 0) + addedOfCurrentType.length,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) {
      return;
    }

    try {
      await removeMembersFromDomain(domainFqn, [removingMember.reference]);
      setMembers((prev) =>
        prev.filter(
          (member) => member.reference.id !== removingMember.reference.id
        )
      );
      handlePagingChange({ total: Math.max((paging.total ?? 1) - 1, 0) });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setRemovingMember(undefined);
    }
  };

  const columns: ColumnsType<DomainMember> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'reference',
        key: 'name',
        render: (reference: EntityReference, record: DomainMember) => (
          <div className="d-flex items-center gap-1">
            <UserTag
              avatarType="outlined"
              id={reference.name ?? ''}
              isTeam={reference.type === EntityType.TEAM}
              name={getEntityName(reference)}
              size={UserTagSize.small}
            />
            {record.inherited && (
              <Tooltip
                title={t('label.inherited-entity', {
                  entity: t('label.user-and-team-plural'),
                })}>
                <InheritIcon
                  className="inherit-icon cursor-pointer"
                  width={14}
                />
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 90,
        render: (_: unknown, record: DomainMember) => {
          let removeTooltip = t('label.remove');
          if (!hasEditPermission) {
            removeTooltip = t('message.no-permission-for-action');
          } else if (record.inherited) {
            removeTooltip = t('label.inherited-entity', {
              entity: t('label.user-and-team-plural'),
            });
          }

          return (
            <Tooltip placement="left" title={removeTooltip}>
              <Button
                data-testid={`remove-domain-member-${record.reference.name}`}
                disabled={!hasEditPermission || record.inherited}
                icon={
                  <IconRemove height={16} name={t('label.remove')} width={16} />
                }
                type="text"
                onClick={() => setRemovingMember(record)}
              />
            </Tooltip>
          );
        },
      },
    ],
    [hasEditPermission, t]
  );

  const addMemberButton = hasEditPermission && (
    <UserTeamSelectableList
      hasPermission
      includeAllTeamTypes
      previewSelected
      label={t('label.user-and-team-plural')}
      listHeight={200}
      multiple={{ user: true, team: true }}
      owner={EMPTY_SELECTION}
      onUpdate={handleAddMembers}>
      <Button data-testid="add-domain-member-button" type="primary">
        {t('label.add-entity', {
          entity: t('label.user-and-team-plural'),
        })}
      </Button>
    </UserTeamSelectableList>
  );

  return (
    <div className="p-md" data-testid="domain-members-tab">
      <Table
        columns={columns}
        customPaginationProps={{
          currentPage,
          isLoading,
          isNumberBased: true,
          pageSize,
          paging,
          showPagination,
          pagingHandler: handlePaging,
          onShowSizeChange: handlePageSizeChange,
        }}
        dataSource={members}
        extraTableFilters={
          <Space>
            <Radio.Group
              data-testid="member-type-toggle"
              value={memberType}
              onChange={(e) => handleMemberTypeChange(e.target.value)}>
              <Radio.Button
                data-testid="member-type-user"
                value={EntityType.USER}>
                {t('label.user-plural')}
              </Radio.Button>
              <Radio.Button
                data-testid="member-type-team"
                value={EntityType.TEAM}>
                {t('label.team-plural')}
              </Radio.Button>
            </Radio.Group>
            {addMemberButton}
          </Space>
        }
        loading={isLoading}
        locale={{
          emptyText: <FilterTablePlaceHolder />,
        }}
        pagination={false}
        rowKey={(record) => record.reference.id}
        searchProps={{
          placeholder: t('label.search-for-type', {
            type: t('label.user-and-team-plural'),
          }),
          searchValue: searchText,
          typingInterval: 500,
          onSearch: handleSearch,
        }}
        size="small"
      />
      <Modal
        cancelText={t('label.cancel')}
        data-testid="remove-member-confirmation-modal"
        okText={t('label.confirm')}
        open={Boolean(removingMember)}
        title={t('label.remove-entity', {
          entity: getEntityName(removingMember?.reference),
        })}
        onCancel={() => setRemovingMember(undefined)}
        onOk={handleRemoveMember}>
        {t('message.are-you-sure-want-to-text', {
          text: t('label.remove-entity-lowercase', {
            entity: getEntityName(removingMember?.reference),
          }),
        })}
      </Modal>
    </div>
  );
};

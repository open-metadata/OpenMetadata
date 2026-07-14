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
import { Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import type {
  Domain,
  EntityReference,
} from '../../../generated/entity/domains/domain';
import {
  addMembersToDomain,
  removeMembersFromDomain,
} from '../../../rest/domainAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import Loader from '../../common/Loader/Loader';
import { UserTag } from '../../common/UserTag/UserTag.component';
import { UserTagSize } from '../../common/UserTag/UserTag.interface';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import {
  DomainMember,
  DomainMemberSearchSource,
} from './DomainMembersWidget.interface';

const UserTeamSelectableList = withSuspenseFallback(
  lazy(() =>
    import(
      '../../common/UserTeamSelectableList/UserTeamSelectableList.component'
    ).then((m) => ({ default: m.UserTeamSelectableList }))
  ),
  null
);

const MAX_VISIBLE_MEMBERS = 8;
const MEMBER_FETCH_SIZE = 50;

export const DomainMembersWidget = () => {
  const {
    data: domain,
    permissions,
    isVersionView,
  } = useGenericContext<Domain>();
  const { t } = useTranslation();
  const [members, setMembers] = useState<DomainMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllMembers, setShowAllMembers] = useState(false);

  const domainFqn = domain.fullyQualifiedName ?? '';
  const hasEditPermission = Boolean(permissions?.EditAll) && !isVersionView;

  const directMembers = useMemo(
    () =>
      members
        .filter((member) => !member.inherited)
        .map((member) => member.reference),
    [members]
  );

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

  const fetchMembers = useCallback(async () => {
    if (!domainFqn) {
      setIsLoading(false);

      return;
    }

    setIsLoading(true);
    const [teamsResult, usersResult] = await Promise.allSettled([
      searchQuery({
        query: '',
        pageNumber: 1,
        pageSize: MEMBER_FETCH_SIZE,
        queryFilter: getTermQuery({
          'domains.fullyQualifiedName': domainFqn,
        }),
        sortField: 'displayName.keyword',
        sortOrder: 'asc',
        searchIndex: SearchIndex.TEAM,
      }),
      searchQuery({
        query: '',
        pageNumber: 1,
        pageSize: MEMBER_FETCH_SIZE,
        queryFilter: getTermQuery({
          'domains.fullyQualifiedName': domainFqn,
          isBot: 'false',
        }),
        sortField: 'displayName.keyword',
        sortOrder: 'asc',
        searchIndex: SearchIndex.USER,
      }),
    ]);

    const teamMembers =
      teamsResult.status === 'fulfilled'
        ? toDomainMembers(
            teamsResult.value.hits.hits.map(
              (hit) => hit._source as DomainMemberSearchSource
            ),
            EntityType.TEAM
          )
        : [];
    const userMembers =
      usersResult.status === 'fulfilled'
        ? toDomainMembers(
            usersResult.value.hits.hits.map(
              (hit) => hit._source as DomainMemberSearchSource
            ),
            EntityType.USER
          )
        : [];

    setMembers([...teamMembers, ...userMembers]);
    setIsLoading(false);
  }, [domainFqn, toDomainMembers]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleMembersUpdate = async (selected: EntityReference[] = []) => {
    const added = selected.filter(
      (item) => !directMembers.some((member) => member.id === item.id)
    );
    const removed = directMembers.filter(
      (member) => !selected.some((item) => item.id === member.id)
    );

    if (!isEmpty(added)) {
      try {
        await addMembersToDomain(domainFqn, added);
        setMembers((prev) => [
          ...prev,
          ...added.map((reference) => ({ reference, inherited: false })),
        ]);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }

    if (!isEmpty(removed)) {
      try {
        await removeMembersFromDomain(domainFqn, removed);
        setMembers((prev) =>
          prev.filter(
            (member) =>
              member.inherited ||
              !removed.some((item) => item.id === member.reference.id)
          )
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const headerExtra = hasEditPermission ? (
    <UserTeamSelectableList
      hasPermission
      includeAllTeamTypes
      previewSelected
      label={t('label.user-and-team-plural')}
      listHeight={200}
      multiple={{ user: true, team: true }}
      owner={directMembers}
      popoverProps={{ placement: 'topLeft' }}
      onUpdate={handleMembersUpdate}>
      {isEmpty(directMembers) ? (
        <WidgetPlusButton
          data-testid="add-domain-member-button"
          title={t('label.add-entity', {
            entity: t('label.user-and-team-plural'),
          })}
        />
      ) : (
        <WidgetEditButton
          data-testid="edit-domain-member-button"
          title={t('label.edit-entity', {
            entity: t('label.user-and-team-plural'),
          })}
        />
      )}
    </UserTeamSelectableList>
  ) : null;

  const visibleMembers = showAllMembers
    ? members
    : members.slice(0, MAX_VISIBLE_MEMBERS);

  const memberList = isEmpty(members) ? null : (
    <div className="d-flex flex-column gap-2" data-testid="domain-member-list">
      {visibleMembers.map((member) => (
        <div
          className="d-flex items-center gap-1"
          data-testid={`domain-member-${member.reference.name}`}
          key={member.reference.id}>
          <UserTag
            avatarType="outlined"
            id={member.reference.name ?? ''}
            isTeam={member.reference.type === EntityType.TEAM}
            name={getEntityName(member.reference)}
            size={UserTagSize.small}
          />
          {member.inherited && (
            <Tooltip
              title={t('label.inherited-entity', {
                entity: t('label.user-and-team-plural'),
              })}>
              <InheritIcon className="inherit-icon cursor-pointer" width={14} />
            </Tooltip>
          )}
        </div>
      ))}
      {members.length > MAX_VISIBLE_MEMBERS && (
        <Typography.Link
          data-testid="domain-member-show-more"
          onClick={() => setShowAllMembers((prev) => !prev)}>
          {showAllMembers
            ? t('label.show-less')
            : t('label.plus-count-more', {
                count: members.length - MAX_VISIBLE_MEMBERS,
              })}
        </Typography.Link>
      )}
    </div>
  );

  return (
    <WidgetCard
      dataTestId="domain-members-widget"
      headerExtra={headerExtra}
      isExpandDisabled={isEmpty(members)}
      title={t('label.user-and-team-plural')}>
      {isLoading ? <Loader size="small" /> : memberList}
    </WidgetCard>
  );
};

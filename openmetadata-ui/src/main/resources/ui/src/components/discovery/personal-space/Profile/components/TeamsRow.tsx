/*
 *  Copyright 2025 Collate.
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

import { Autocomplete } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { uniqBy } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamHierarchy } from '../../../../../generated/entity/teams/teamHierarchy';
import { User } from '../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../hooks/authHooks';
import { getTeamsHierarchy } from '../../../../../rest/teamsAPI';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getNonDeletedTeams } from '../../../../../utils/TeamUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import ChipBadgeList from './ChipBadgeList';
import InlineEditCard from './InlineEditCard';
import RemovableChip from './RemovableChip';

interface TeamOption {
  id: string;
  label: string;
}

// getTeamsHierarchy returns a nested tree; the selector needs a flat option list.
const flattenTeams = (nodes: TeamHierarchy[]): TeamOption[] =>
  nodes.flatMap((node) => [
    { id: node.id, label: getEntityName(node) },
    ...flattenTeams(node.children ?? []),
  ]);

interface TeamsRowProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

const TeamsRow: React.FC<TeamsRowProps> = ({ userData, updateUserDetails }) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const canEdit = Boolean(isAdminUser) && !userData.deleted;

  const initialTeams = useMemo(
    () => getNonDeletedTeams(userData.teams ?? []),
    [userData.teams]
  );
  const initialTeamIds = useMemo(
    () => initialTeams.map((tm) => tm.id),
    [initialTeams]
  );
  const [draftTeamIds, setDraftTeamIds] = useState<string[]>(initialTeamIds);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);

  // The joinable-teams list only feeds the edit dropdown; fetch it lazily when
  // the row enters edit mode rather than on every Permissions page load.
  const loadTeams = useCallback(() => {
    getTeamsHierarchy(true)
      .then((res) => setTeamOptions(flattenTeams(res.data ?? [])))
      .catch((err) => showErrorToast(err as AxiosError));
  }, []);

  // Merge fetched joinable teams with the user's current teams so a team not in
  // the joinable list is still shown and not silently dropped on save.
  const options = useMemo(
    () =>
      uniqBy(
        [
          ...initialTeams.map((tm) => ({
            id: tm.id,
            label: getEntityName(tm),
          })),
          ...teamOptions,
        ],
        'id'
      ),
    [initialTeams, teamOptions]
  );

  const selectedItems = useMemo(
    () => options.filter((o) => draftTeamIds.includes(o.id)),
    [options, draftTeamIds]
  );

  const handleItemCleared = useCallback((key: React.Key) => {
    setDraftTeamIds((prev) => prev.filter((id) => id !== key));
  }, []);

  const handleItemInserted = useCallback((key: React.Key) => {
    setDraftTeamIds((prev) =>
      prev.includes(key as string) ? prev : [...prev, key as string]
    );
  }, []);

  const handleSave = async () => {
    // Keep existing teams in their original order/refs and append only new ones:
    // the positional PATCH diff otherwise re-adds a current member ("already
    // part of the team").
    const currentTeams = userData.teams ?? [];
    const draftTeamIdSet = new Set(draftTeamIds);
    const currentTeamIdSet = new Set(currentTeams.map((team) => team.id));
    const retainedTeams = currentTeams.filter((team) =>
      draftTeamIdSet.has(team.id)
    );
    const newlyAddedTeams = draftTeamIds
      .filter((teamId) => !currentTeamIdSet.has(teamId))
      .map((teamId) => ({ id: teamId, type: 'team' }));
    await updateUserDetails(
      { teams: [...retainedTeams, ...newlyAddedTeams] },
      'teams'
    );
  };

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={t('message.team-member-description')}
      lockedLabel={t('label.admin-managed')}
      renderEdit={() => (
        <Autocomplete
          multiple
          aria-label={t('label.team-plural')}
          data-testid="teams-multiselect"
          items={options}
          placeholder={t('label.select-entity', {
            entity: t('label.team-plural'),
          })}
          renderTag={(item, onRemove) => (
            <RemovableChip
              key={item.id}
              label={item.label ?? ''}
              testId={`teams-remove-${item.label ?? ''}`}
              onRemove={onRemove}
            />
          )}
          selectedItems={selectedItems}
          onItemCleared={handleItemCleared}
          onItemInserted={handleItemInserted}>
          {(item) => (
            <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
          )}
        </Autocomplete>
      )}
      testId="teams"
      title={t('label.team-plural')}
      view={
        <ChipBadgeList
          color="blue"
          noDataPlaceholder={t('message.no-teams-assigned')}
          values={initialTeams}
        />
      }
      onCancel={() => setDraftTeamIds(initialTeamIds)}
      onEnterEdit={() => {
        setDraftTeamIds(initialTeamIds);
        loadTeams();
      }}
      onSave={handleSave}
    />
  );
};

export default TeamsRow;

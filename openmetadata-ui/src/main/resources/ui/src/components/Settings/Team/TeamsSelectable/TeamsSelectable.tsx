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

import {
  Alert,
  TreeSelect,
  TreeSelectNode,
} from '@openmetadata/ui-core-components';

import { AxiosError } from 'axios';

import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamHierarchy } from '../../../../generated/entity/teams/teamHierarchy';
import { EntityReference } from '../../../../generated/entity/type';
import { getTeamsHierarchy } from '../../../../rest/teamsAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import i18n from '../../../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { TeamsSelectableProps } from './TeamsSelectable.interface';
import { buildTeamsSelectableTree } from './TeamsSelectable.utils';

const TeamsSelectable = ({
  showTeamsAlert,
  onSelectionChange,
  filterJoinable,
  placeholder = i18n.t('label.search-for-type', {
    type: i18n.t('label.team-plural-lowercase'),
  }),
  selectedTeams,
  maxValueCount,
}: TeamsSelectableProps) => {
  const [noTeam, setNoTeam] = useState<boolean>(false);
  const [teams, setTeams] = useState<Array<TeamHierarchy>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { t } = useTranslation();
  const onChange = (value: TreeSelectNode | TreeSelectNode[] | null) => {
    const newValue: TreeSelectNode[] = [];
    if (Array.isArray(value)) {
      newValue.push(...value);
    } else if (value) {
      newValue.push(value);
    }
    onSelectionChange &&
      onSelectionChange(
        newValue.map(
          (val) =>
            ({
              id: val.value,
              displayName: val.label,
              type: 'team',
            } as EntityReference)
        )
      );
  };

  const loadOptions = async () => {
    try {
      setIsLoading(true);
      const { data } = await getTeamsHierarchy(filterJoinable);
      const sortedData = [...data].sort((a, b) => {
        const nameA = a.fullyQualifiedName ?? '';
        const nameB = b.fullyQualifiedName ?? '';

        return nameA.localeCompare(nameB);
      });
      setTeams(sortedData);
      showTeamsAlert && setNoTeam(isEmpty(data));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const teamsTree = useMemo(
    () => buildTeamsSelectableTree(teams, filterJoinable),
    [teams, filterJoinable]
  );

  const fetchData = useCallback(
    async () => ({ nodes: teamsTree }),
    [teamsTree]
  );

  const selectedTeamsInternal = useMemo(() => {
    return selectedTeams?.map((selectedTeam) => ({
      id: selectedTeam.id,
      label: getEntityName(selectedTeam),
      value: selectedTeam.id,
    }));
  }, [selectedTeams]);

  return (
    <>
      <TreeSelect
        multiple
        searchable
        data-testid="team-select"
        fetchData={fetchData}
        isLoading={isLoading}
        maxVisibleItems={maxValueCount}
        placeholder={placeholder}
        showCheckbox={false}
        showIcon={false}
        value={selectedTeamsInternal}
        onChange={onChange}
      />
      {noTeam && (
        <Alert
          showIcon
          className="m-t-md"
          title={t('message.no-entity-data-available', {
            entity: t('label.team-plural'),
          })}
          variant="brand"
        />
      )}
    </>
  );
};

export default TeamsSelectable;

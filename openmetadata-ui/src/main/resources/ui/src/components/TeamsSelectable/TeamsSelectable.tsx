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

import { Alert, TreeSelect } from 'antd';
import { BaseOptionType } from 'antd/lib/select';
import { t } from 'i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { TeamHierarchy } from '../../generated/entity/teams/teamHierarchy';
import { getTeamsHierarchy } from '../../rest/teamsAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { TeamsSelectableProps } from './TeamsSelectable.interface';

const TeamsSelectable = ({
  showTeamsAlert,
  onSelectionChange,
  filterJoinable,
  placeholder = t('label.search-for-type', {
    type: t('label.team-plural-lowercase'),
  }),
  selectedTeams,
  maxValueCount,
}: TeamsSelectableProps) => {
  const [value, setValue] = useState<Array<string>>();
  const [noTeam, setNoTeam] = useState<boolean>(false);
  const [teams, setTeams] = useState<Array<TeamHierarchy>>([]);

  const onChange = (newValue: string[]) => {
    onSelectionChange && onSelectionChange(newValue);
    setValue(newValue);
  };

  useEffect(() => {
    setValue(selectedTeams ?? []);
  }, [selectedTeams]);

  const loadOptions = () => {
    getTeamsHierarchy(filterJoinable)
      .then((res) => {
        const teams: TeamHierarchy[] = res.data;
        setTeams(teams);
        showTeamsAlert && setNoTeam(teams.length === 0);
      })
      .catch((error) => {
        showErrorToast(error);
      });
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const showLeafIcon = false;

  const getTreeNodeData = (team: TeamHierarchy): BaseOptionType => {
    const teamName = getEntityName(team);
    const value = team.id;
    const disabled = filterJoinable ? !team.isJoinable : false;

    return {
      title: teamName,
      value,
      selectable: !team.children?.length,
      disabled,
      children:
        team.children &&
        team.children.map((n: TeamHierarchy) => getTreeNodeData(n)),
    };
  };

  const teamsTree = useMemo(() => {
    return teams.map((team) => {
      return getTreeNodeData(team);
    });
  }, [teams]);

  return (
    <>
      <TreeSelect
        allowClear
        multiple
        showSearch
        treeDefaultExpandAll
        data-testid="team-select"
        dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
        maxTagCount={maxValueCount}
        placeholder={placeholder}
        showCheckedStrategy={TreeSelect.SHOW_CHILD}
        style={{ width: '100%' }}
        treeData={teamsTree}
        treeLine={{ showLeafIcon }}
        treeNodeFilterProp="title"
        value={value}
        onChange={onChange}
      />
      {noTeam && (
        <Alert
          showIcon
          className="m-t-md"
          message={t('message.no-entity-data-available', {
            entity: t('label.team-plural'),
          })}
          type="info"
        />
      )}
    </>
  );
};

export default TeamsSelectable;

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

import { TreeSelect } from 'antd';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { getTeamsHierarchy } from 'rest/teamsAPI';
import { TeamHierarchy } from '../../generated/entity/teams/teamHierarchy';
import { getEntityName } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';

interface Props {
  showTeamsAlert?: boolean;
  onSelectionChange: (teams: string[]) => void;
  filterJoinable?: boolean;
  placeholder?: string;
}

const { TreeNode } = TreeSelect;

const TeamsSelectable = ({
  showTeamsAlert,
  onSelectionChange,
  filterJoinable,
  placeholder = 'Search for teams',
}: Props) => {
  const [value, setValue] = useState<Array<string>>();
  const [noTeam, setNoTeam] = useState<boolean>(false);
  const [teams, setTeams] = useState<Array<TeamHierarchy>>([]);

  const onChange = (newValue: string[]) => {
    onSelectionChange(newValue);
    setValue(newValue);
  };

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

  const getTreeNodes = (team: TeamHierarchy) => {
    const teamName = getEntityName(team);
    const value = team.id;
    const disabled = filterJoinable ? !team.isJoinable : false;

    return (
      <TreeNode disabled={disabled} key={value} title={teamName} value={value}>
        {team.children &&
          team.children.map((n: TeamHierarchy) => getTreeNodes(n))}
      </TreeNode>
    );
  };
  const showLeafIcon = false;

  return (
    <>
      <TreeSelect
        allowClear
        multiple
        showSearch
        treeDefaultExpandAll
        dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
        placeholder={placeholder}
        showCheckedStrategy={TreeSelect.SHOW_ALL}
        style={{ width: '100%' }}
        treeLine={{ showLeafIcon }}
        treeNodeFilterProp="title"
        value={value}
        onChange={onChange}>
        {teams.map((team) => {
          return getTreeNodes(team);
        })}
      </TreeSelect>
      {noTeam && (
        <div
          className="tw-notification tw-bg-info tw-mt-2 tw-justify-start tw-w-full tw-p-2"
          data-testid="toast">
          <div className="tw-font-semibold tw-flex-shrink-0">
            <SVGIcons alt="info" icon="info" title="Info" width="16px" />
          </div>
          <div className="tw-font-semibold tw-px-1">
            {t('message.no-data-available')}
          </div>
        </div>
      )}
    </>
  );
};

export default TeamsSelectable;

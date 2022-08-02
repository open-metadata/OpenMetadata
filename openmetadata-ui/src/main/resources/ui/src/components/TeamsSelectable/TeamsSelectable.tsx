/*
 *  Copyright 2021 Collate
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

import { SelectableOption } from 'Models';
import React, { useState } from 'react';
import AsyncSelect from 'react-select/async';
import { getTeamsByQuery } from '../../axiosAPIs/miscAPI';
import { Team } from '../../generated/entity/teams/team';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';

interface CustomOption extends SelectableOption {
  isDisabled: boolean;
}

interface Props {
  showTeamsAlert?: boolean;
  onSelectionChange: (teams: string[]) => void;
  filterJoinable?: boolean;
  placeholder?: string;
}

const TEAM_OPTION_PAGE_LIMIT = 100;

const TeamsSelectable = ({
  showTeamsAlert,
  onSelectionChange,
  filterJoinable,
  placeholder = 'Search for teams',
}: Props) => {
  const [teamSearchText, setTeamSearchText] = useState<string>('');
  const [noTeam, setNoTeam] = useState<boolean>(false);

  const handleSelectionChange = (selectedOptions: SelectableOption[]) => {
    onSelectionChange(selectedOptions.map((option) => option.value));
  };

  const getOptions = (teams: Team[]) => {
    return teams.map((team) => ({
      label: getEntityName(team as EntityReference),
      value: team.id,
    }));
  };

  const loadOptions = (text: string) => {
    return new Promise<SelectableOption[]>((resolve) => {
      const trimmedText = text.trim();
      getTeamsByQuery({
        q:
          (trimmedText ? `*${trimmedText}*` : '*') +
          (filterJoinable ? ` AND isJoinable:true` : ''),
        from: 0,
        size: TEAM_OPTION_PAGE_LIMIT,
      }).then((res) => {
        const teams: Team[] =
          res.hits.hits.map((t: { _source: Team }) => t._source) || [];
        showTeamsAlert && setNoTeam(teams.length === 0);
        resolve(getOptions(teams));
      });
    });
  };

  return (
    <>
      <AsyncSelect
        cacheOptions
        defaultOptions
        isClearable
        isMulti
        aria-label="Select teams"
        components={{
          DropdownIndicator: null,
        }}
        inputValue={teamSearchText}
        isOptionDisabled={(option) => !!(option as CustomOption).isDisabled}
        loadOptions={loadOptions}
        maxMenuHeight={200}
        placeholder={placeholder}
        styles={reactSingleSelectCustomStyle}
        onChange={(value) => handleSelectionChange(value as SelectableOption[])}
        onInputChange={(newText) => {
          setTeamSearchText(newText);
        }}
      />
      {noTeam && (
        <div
          className="tw-notification tw-bg-info tw-mt-2 tw-justify-start tw-w-full tw-p-2"
          data-testid="toast">
          <div className="tw-font-semibold tw-flex-shrink-0">
            <SVGIcons alt="info" icon="info" title="Info" width="16px" />
          </div>
          <div className="tw-font-semibold tw-px-1">
            There is no team available.
          </div>
        </div>
      )}
    </>
  );
};

export default TeamsSelectable;

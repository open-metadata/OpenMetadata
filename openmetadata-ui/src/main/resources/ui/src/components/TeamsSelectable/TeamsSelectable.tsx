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
import { getSuggestedTeams } from '../../axiosAPIs/miscAPI';
import { getTeams } from '../../axiosAPIs/teamsAPI';
import { PAGE_SIZE } from '../../constants/constants';
import { EntityReference as UserTeams } from '../../generated/entity/teams/user';
import { formatTeamsResponse } from '../../utils/APIUtils';
import { getEntityName } from '../../utils/CommonUtils';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';

interface CustomOption extends SelectableOption {
  isDisabled: boolean;
}

interface Props {
  onSelectionChange: (teams: string[]) => void;
}

const TeamsSelectable = ({ onSelectionChange }: Props) => {
  const [teamSearchText, setTeamSearchText] = useState<string>('');

  const handleSelectionChange = (selectedOptions: SelectableOption[]) => {
    onSelectionChange(selectedOptions.map((option) => option.value));
  };

  const loadOptions = (text: string) => {
    return new Promise<SelectableOption[]>((resolve) => {
      if (text) {
        getSuggestedTeams(text).then((res) => {
          const teams: UserTeams[] = formatTeamsResponse(
            res.data.suggest['table-suggest'][0].options
          );
          const options = teams.map((team) => ({
            label: getEntityName(team),
            value: team.id,
          }));
          resolve(options);
        });
      } else {
        getTeams('', PAGE_SIZE).then((res) => {
          const teams: UserTeams[] = res.data.data || [];
          const options = teams.map((team) => ({
            label: getEntityName(team),
            value: team.id,
          }));
          resolve(options);
        });
      }
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
        placeholder="Teams..."
        styles={reactSingleSelectCustomStyle}
        onChange={(value) => handleSelectionChange(value as SelectableOption[])}
        onInputChange={(newText) => {
          setTeamSearchText(newText);
        }}
      />
    </>
  );
};

export default TeamsSelectable;

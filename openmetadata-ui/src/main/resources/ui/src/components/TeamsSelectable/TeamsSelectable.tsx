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

import { FormattedTeamsData, SelectableOption } from 'Models';
import React, { useState } from 'react';
import AsyncSelect from 'react-select/async';
import { PAGE_SIZE } from '../../constants/constants';
import { EntityReference } from '../../generated/type/entityReference';
import { formatTeamsResponse } from '../../utils/APIUtils';
import { getEntityName } from '../../utils/CommonUtils';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';
import { getSearchedTeams, getSuggestedTeams } from '../../axiosAPIs/searchAPI';
import { WILD_CARD_CHAR } from '../../constants/char.constants';

interface CustomOption extends SelectableOption {
  isDisabled: boolean;
}

interface Props {
  onSelectionChange: (teams: string[]) => void;
  filterJoinable?: boolean;
  placeholder?: string;
}

const TeamsSelectable = ({
  onSelectionChange,
  filterJoinable,
  placeholder = 'Start typing the name of team...',
}: Props) => {
  const [teamSearchText, setTeamSearchText] = useState<string>('');

  const handleSelectionChange = (selectedOptions: SelectableOption[]) => {
    onSelectionChange(selectedOptions.map((option) => option.value));
  };

  const getOptions = (teams: FormattedTeamsData[]) => {
    const filteredTeams = filterJoinable
      ? teams.filter((team) => team.isJoinable)
      : teams;

    return filteredTeams.map((team) => ({
      label: getEntityName(team as EntityReference),
      value: team.id,
    }));
  };

  const loadOptions = (text: string) => {
    return new Promise<SelectableOption[]>((resolve) => {
      if (text) {
        getSuggestedTeams(text).then((res) => {
          const teams = formatTeamsResponse(
            res.data.suggest['metadata-suggest'][0].options
          );
          resolve(getOptions(teams));
        });
      } else {
        getSearchedTeams(WILD_CARD_CHAR, 0, PAGE_SIZE).then((res) => {
          const teams = res.hits.hits.map((t) => t._source) || [];
          resolve(getOptions(teams));
        });
      }
    });
  };

  return (
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
  );
};

export default TeamsSelectable;

/*
 *  Copyright 2024 Collate.
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

import { Autocomplete, Box, Chip, TextField, useTheme } from '@mui/material';
import { XClose } from '@untitledui/icons';
import { debounce } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTeams } from '../../../assets/svg/teams-grey.svg';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { searchData } from '../../../rest/miscAPI';
import {
  formatTeamsResponse,
  formatUsersResponse,
} from '../../../utils/APIUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import { ProfilePicture } from '../atoms/ProfilePicture';

export interface MUIUserTeamSelectProps {
  // Entity type restrictions
  userOnly?: boolean;
  teamOnly?: boolean;

  // Multiple selection control
  multipleUser?: boolean;
  multipleTeam?: boolean;

  // Common props
  placeholder?: string;
  value?: EntityReference[];
  onChange?: (selected: EntityReference[]) => void;
  autoFocus?: boolean;
  label?: React.ReactNode;
  required?: boolean;
}

interface OptionType {
  label: string;
  value: string;
  entity: EntityReference;
  isTeam: boolean;
}

const MUIUserTeamSelect: FC<MUIUserTeamSelectProps> = ({
  userOnly = false,
  teamOnly = false,
  multipleUser = false,
  multipleTeam = false,
  placeholder,
  value = [],
  onChange,
  autoFocus,
  label,
  required,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [userOptions, setUserOptions] = useState<OptionType[]>([]);
  const [teamOptions, setTeamOptions] = useState<OptionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);

  const selectedOptions = useMemo(() => {
    return value.map((entity) => ({
      label: getEntityName(entity),
      value: entity.id || '',
      entity,
      isTeam: entity.type === EntityType.TEAM,
    }));
  }, [value]);

  const fetchUsers = async (searchText: string) => {
    if (teamOnly) {
      setUserOptions([]);

      return;
    }

    const res = await searchData(
      searchText,
      1,
      PAGE_SIZE_MEDIUM,
      'isBot:false',
      '',
      '',
      SearchIndex.USER,
      false,
      false,
      true
    );

    const users = formatUsersResponse(res.data.hits.hits);

    setUserOptions(
      users.map((user) => ({
        label: getEntityName(user),
        value: user.id,
        entity: user,
        isTeam: false,
      }))
    );
  };

  const fetchTeams = async (searchText: string) => {
    if (userOnly) {
      setTeamOptions([]);

      return;
    }

    const res = await searchData(
      searchText,
      1,
      PAGE_SIZE_MEDIUM,
      '',
      '',
      '',
      SearchIndex.TEAM,
      false,
      false,
      true
    );

    const teams = formatTeamsResponse(res.data.hits.hits);

    setTeamOptions(
      teams.map((team) => ({
        label: getEntityName(team),
        value: team.id,
        entity: team,
        isTeam: true,
      }))
    );
  };

  const handleSearch = useCallback(
    debounce(async (searchText: string) => {
      setLoading(true);

      try {
        await Promise.all([fetchUsers(searchText), fetchTeams(searchText)]);
      } catch (error) {
        setUserOptions([]);
        setTeamOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [userOnly, teamOnly]
  );

  useEffect(() => {
    if (inputValue) {
      handleSearch(inputValue);
    } else {
      setLoading(true);
      setUserOptions([]);
      setTeamOptions([]);
      handleSearch('');
    }
  }, [inputValue]);

  // Fetch initial options when dropdown opens
  useEffect(() => {
    if (
      open &&
      userOptions.length === 0 &&
      teamOptions.length === 0 &&
      !inputValue
    ) {
      handleSearch('');
    }
  }, [open]);

  const handleChange = (
    _event: any,
    newValue: string | OptionType | (string | OptionType)[] | null
  ) => {
    if (!onChange) {
      return;
    }

    // Filter out string values from freeSolo
    if (typeof newValue === 'string') {
      return;
    }

    if (Array.isArray(newValue)) {
      // Multiple selection mode - handle team/user exclusivity
      // Filter out any string values
      const optionValues = newValue.filter(
        (v): v is OptionType => typeof v !== 'string'
      );
      let finalSelection = [...optionValues];

      // Check if a new team was just added (comparing with previous selection)
      const newTeams = optionValues.filter((opt) => opt.isTeam);
      const oldTeams = selectedOptions.filter((opt) => opt.isTeam);
      const teamWasAdded = newTeams.length > oldTeams.length;

      // Check if a new user was just added
      const newUsers = optionValues.filter((opt) => !opt.isTeam);
      const oldUsers = selectedOptions.filter((opt) => !opt.isTeam);
      const userWasAdded = newUsers.length > oldUsers.length;

      if (teamWasAdded) {
        // When a team is selected, remove all users and keep only the latest team
        finalSelection = finalSelection.filter((opt) => opt.isTeam);
        if (!multipleTeam && finalSelection.length > 1) {
          // Keep only the most recent team
          finalSelection = [newTeams[newTeams.length - 1]];
        }
      } else if (userWasAdded) {
        // When a user is selected, remove all teams
        finalSelection = finalSelection.filter((opt) => !opt.isTeam);
        if (!multipleUser && finalSelection.length > 1) {
          // Keep only the most recent user
          finalSelection = [newUsers[newUsers.length - 1]];
        }
      }

      // Clean entities to valid EntityReference format
      const entities = finalSelection.map((opt) =>
        getEntityReferenceFromEntity(
          opt.entity,
          opt.isTeam ? EntityType.TEAM : EntityType.USER
        )
      );
      onChange(entities);
    } else if (newValue) {
      // Single selection mode - clean entity
      const cleanEntity = getEntityReferenceFromEntity(
        newValue.entity,
        newValue.isTeam ? EntityType.TEAM : EntityType.USER
      );
      onChange([cleanEntity]);
    } else {
      onChange([]);
    }
  };

  const isMultiple = useMemo(() => {
    // If both user and team can be selected
    if (!userOnly && !teamOnly) {
      return multipleUser || multipleTeam;
    }
    // If only users
    if (userOnly) {
      return multipleUser;
    }
    // If only teams
    if (teamOnly) {
      return multipleTeam;
    }

    return false;
  }, [userOnly, teamOnly, multipleUser, multipleTeam]);

  const isOptionEqualToValue = (option: OptionType, val: OptionType) => {
    return option.value === val.value;
  };

  const filterOptions = (opts: OptionType[]) => {
    // No filtering - all options are always available for selection
    // The handleChange function will handle the replacement logic
    return opts;
  };

  const renderOption = (props: any, option: OptionType) => {
    const { entity, isTeam } = option;

    return (
      <Box
        component="li"
        {...props}
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isTeam ? (
          <IconTeams style={{ width: 18, height: 18, marginRight: 2 }} />
        ) : (
          <ProfilePicture
            avatarType="solid"
            displayName={entity.displayName}
            name={entity.name ?? ''}
            size={18}
            sx={{ marginRight: '4px' }}
          />
        )}
        <span>{getEntityName(entity)}</span>
      </Box>
    );
  };

  const renderTags = (value: OptionType[], getTagProps: any) => {
    return value.map((option, index) => {
      const { entity, isTeam } = option;
      const tagProps = getTagProps({ index });

      return (
        <Chip
          {...tagProps}
          avatar={
            isTeam ? (
              <IconTeams style={{ width: 14, height: 14, marginRight: 2 }} />
            ) : (
              <ProfilePicture
                avatarType="solid"
                displayName={entity.displayName}
                name={entity.name ?? ''}
                size={14}
                sx={{ marginRight: '4px' }}
              />
            )
          }
          color="secondary"
          deleteIcon={<XClose size={12} />}
          key={entity.id}
          label={getEntityName(entity)}
          size="small"
          sx={{
            borderRadius: '8px',
            backgroundColor: 'transparent',
            borderColor: theme.palette.grey[300],
          }}
          variant="outlined"
        />
      );
    });
  };

  const getPlaceholderText = () => {
    if (placeholder) {
      return placeholder;
    }
    if (userOnly) {
      return t('label.select-field', { field: t('label.user-plural') });
    }
    if (teamOnly) {
      return t('label.select-field', { field: t('label.team-plural') });
    }

    return t('label.select-users-or-team');
  };

  const allOptions = useMemo(
    () => [...userOptions, ...teamOptions],
    [userOptions, teamOptions]
  );

  return (
    <Autocomplete
      disableCloseOnSelect
      freeSolo
      // Force listbox to remount when options change to fix async search not updating dropdown
      // Using 'as any' because key is not in MUI's ListboxProps type definition
      ListboxProps={
        {
          key: `listbox-${allOptions.length}`,
        } as any
      }
      autoFocus={autoFocus}
      filterOptions={filterOptions}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.label
      }
      inputValue={inputValue}
      isOptionEqualToValue={isOptionEqualToValue}
      loading={loading}
      multiple={isMultiple}
      open={open && (allOptions.length > 0 || loading)}
      options={allOptions}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={getPlaceholderText()}
          required={required}
          size="small"
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
          variant="outlined"
        />
      )}
      renderOption={renderOption}
      renderTags={renderTags}
      sx={{ width: '100%' }}
      value={isMultiple ? selectedOptions : selectedOptions[0] || null}
      onChange={handleChange}
      onClose={() => setOpen(false)}
      onInputChange={(_, newValue) => setInputValue(newValue)}
      onOpen={() => setOpen(true)}
    />
  );
};

export default MUIUserTeamSelect;

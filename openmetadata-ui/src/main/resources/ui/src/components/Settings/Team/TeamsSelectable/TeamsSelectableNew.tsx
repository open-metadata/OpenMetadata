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
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TeamHierarchy } from '../../../../generated/entity/teams/teamHierarchy';
import { getTeamsHierarchy } from '../../../../rest/teamsAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import i18n from '../../../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { TeamsSelectableProps } from './TeamsSelectable.interface';
import { buildTeamsSelectableTree } from './TeamsSelectable.utils';

const TeamsSelectableNew = forwardRef<HTMLDivElement, TeamsSelectableProps>(
  (
    {
      showTeamsAlert,
      onSelectionChange,
      filterJoinable,
      placeholder = i18n.t('label.search-for-type', {
        type: i18n.t('label.team-plural-lowercase'),
      }),
      selectedTeams,
      maxValueCount,
      handleDropdownChange,
      open,
    },
    ref
  ) => {
    const [noTeam, setNoTeam] = useState<boolean>(false);
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
          newValue.map((val) => ({
            id: val.value,
            displayName: val.label,
            type: 'team',
          }))
        );
    };

    // TreeSelect fetches once when it first opens; awaiting the shared request
    // keeps an early open (e.g. a popover opened straight away) from caching an empty tree.
    const teamsRequest = useRef<Promise<TeamHierarchy[]>>();
    const loadTeams = useCallback(() => {
      teamsRequest.current ??= getTeamsHierarchy(filterJoinable).then(
        ({ data }) => data
      );

      return teamsRequest.current;
    }, [filterJoinable]);

    useEffect(() => {
      setIsLoading(true);
      loadTeams()
        .then((data) => showTeamsAlert && setNoTeam(isEmpty(data)))
        .catch((error: AxiosError) => showErrorToast(error))
        .finally(() => setIsLoading(false));
    }, [loadTeams, showTeamsAlert]);

    const fetchData = useCallback(
      async () => ({
        nodes: buildTeamsSelectableTree(await loadTeams(), filterJoinable),
      }),
      [loadTeams, filterJoinable]
    );

    const selectedTeamsInternal = useMemo(() => {
      return selectedTeams?.map((selectedTeam) => ({
        id: selectedTeam.id,
        label: getEntityName(selectedTeam),
        value: selectedTeam.id,
      }));
    }, [selectedTeams]);

    return (
      <div ref={ref}>
        <TreeSelect
          multiple
          searchable
          data-testid="team-select"
          fetchData={fetchData}
          isLoading={isLoading}
          isOpen={open}
          maxVisibleItems={maxValueCount}
          placeholder={placeholder}
          showCheckbox={false}
          showIcon={false}
          value={selectedTeamsInternal}
          onChange={onChange}
          onOpenChange={handleDropdownChange}
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
      </div>
    );
  }
);

export default TeamsSelectableNew;

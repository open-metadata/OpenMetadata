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
import { AxiosError } from 'axios';

import { isEmpty } from 'lodash';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamHierarchy } from '../../../../generated/entity/teams/teamHierarchy';
import { getTeamsHierarchy } from '../../../../rest/teamsAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import i18n from '../../../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { TagRenderer } from '../../../common/TagRenderer/TagRenderer';
import { TeamsSelectableProps } from './TeamsSelectable.interface';

const TeamsSelectableNew = forwardRef<any, TeamsSelectableProps>(
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
    },
    ref
  ) => {
    const [noTeam, setNoTeam] = useState<boolean>(false);
    const [teams, setTeams] = useState<Array<TeamHierarchy>>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const { t } = useTranslation();

    const onChange = (newValue: { label: string; value: string }[]) => {
      onSelectionChange &&
        onSelectionChange(
          newValue.map((val) => ({
            id: val.value,
            displayName: val.label,
            type: 'team',
          }))
        );
    };

    const loadOptions = async () => {
      try {
        setIsLoading(true);
        const { data } = await getTeamsHierarchy(filterJoinable);
        setTeams(data);
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
      return teams.map((team) => getTreeNodeData(team));
    }, [teams]);

    const selectedTeamsInternal = useMemo(() => {
      return selectedTeams?.map((selectedTeam) => ({
        label: getEntityName(selectedTeam),
        value: selectedTeam.id,
      }));
    }, [selectedTeams]);

    return (
      <>
        <TreeSelect
          allowClear
          labelInValue
          multiple
          showSearch
          treeDefaultExpandAll
          data-testid="team-select"
          dropdownMatchSelectWidth={false}
          dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
          getPopupContainer={(trigger) => trigger.parentElement}
          loading={isLoading}
          maxTagCount={maxValueCount}
          maxTagPlaceholder={(omittedValues) => (
            <span className="max-tag-text">
              {t('label.plus-count-more', {
                count: omittedValues.length,
              })}
            </span>
          )}
          placeholder={placeholder}
          placement="bottomLeft"
          popupClassName="teams-custom-dropdown-class"
          ref={ref as any}
          showCheckedStrategy={TreeSelect.SHOW_CHILD}
          style={{ width: '100%' }}
          tagRender={TagRenderer}
          treeData={teamsTree}
          treeLine={{ showLeafIcon }}
          treeNodeFilterProp="title"
          value={selectedTeamsInternal}
          onChange={onChange}
          onDropdownVisibleChange={handleDropdownChange}
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
  }
);

export default TeamsSelectableNew;

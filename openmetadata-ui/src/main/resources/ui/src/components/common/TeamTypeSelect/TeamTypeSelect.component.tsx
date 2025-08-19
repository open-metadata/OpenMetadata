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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { useMemo, useState } from 'react';
import { TeamType } from '../../../generated/entity/teams/team';
import { getTeamOptionsFromType } from '../../../utils/TeamUtils';
import { Select } from '../AntdCompat';
import { TeamTypeSelectProps } from './TeamTypeSelect.interface';
;

function TeamTypeSelect({
  handleShowTypeSelector,
  showGroupOption,
  teamType,
  updateTeamType,
  parentTeamType,
}: TeamTypeSelectProps) {
  const [value, setValue] = useState<TeamType>(teamType);

  const handleSelect = (type: TeamType) => {
    setValue(type);
  };

  const handleCancel = () => {
    handleShowTypeSelector(false);
  };

  const handleSubmit = () => {
    updateTeamType && updateTeamType(value);
  };

  const options = useMemo(() => {
    const options = getTeamOptionsFromType(parentTeamType).map((type) => ({
      label: type,
      value: type,
    }));

    return showGroupOption
      ? options
      : options.filter((opt) => opt.value !== TeamType.Group);
  }, [parentTeamType, showGroupOption]);

  return (
    <Space
      align="center"
      className="team-type-select"
      data-testid="team-type-select"
      size={4}
      // Used to stop click propagation event anywhere in the form to parent TeamDetailsV1 collapsible panel
      onClick={(e) => e.stopPropagation()}>
      <Select
        defaultActiveFirstOption
        options={options}
        value={value}
        onSelect={handleSelect}
      />
      <Space className="m-l-xs" size={4}>
        <Button
          className="h-8 p-x-xss"
          data-testid="cancel-btn"
          size="small"
          type="primary"
          onClick={handleCancel}>
          <CloseOutlined />
        </Button>
        <Button
          className="h-8 p-x-xss"
          data-testid="save-btn"
          size="small"
          type="primary"
          onClick={handleSubmit}>
          <CheckOutlined />
        </Button>
      </Space>
    </Space>
  );
}

export default TeamTypeSelect;

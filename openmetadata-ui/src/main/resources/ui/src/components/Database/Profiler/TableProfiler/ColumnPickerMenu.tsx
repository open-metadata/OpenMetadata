/*
 *  Copyright 2023 Collate.
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
import { Button, Dropdown, Space, Typography } from 'antd';
import { find, map } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import { FC, useMemo, useState } from 'react';
import { ReactComponent as DropdownIcon } from '../../../../assets/svg/drop-down.svg';
import { Column } from '../../../../generated/entity/data/container';
import { getEntityName } from '../../../../utils/EntityUtils';

interface ColumnPickerMenuProps {
  activeColumnFqn: string;
  columns: Column[];
  handleChange: (key: string) => void;
}

const ColumnPickerMenu: FC<ColumnPickerMenuProps> = ({
  activeColumnFqn,
  columns,
  handleChange,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const items = useMemo(() => {
    return map(columns, (column) => ({
      label: (
        <Space>
          {getEntityName(column)}

          <Typography.Text className="text-xs text-grey-muted">{`(${column.dataType})`}</Typography.Text>
        </Space>
      ),
      key: column.fullyQualifiedName || '',
    }));
  }, [columns]);

  const selectedItem = useMemo(() => {
    return find(
      columns,
      (column: Column) => column.fullyQualifiedName === activeColumnFqn
    );
  }, [activeColumnFqn, columns]);

  const handleOptionClick = ({ key }: MenuInfo) => {
    handleChange(key);
    setIsMenuOpen(false);
  };

  return (
    <Dropdown
      destroyPopupOnHide
      menu={{
        items,
        triggerSubMenuAction: 'click',
        onClick: handleOptionClick,
        selectedKeys: [activeColumnFqn],
      }}
      open={isMenuOpen}
      trigger={['click']}
      onOpenChange={(value) => setIsMenuOpen(value)}>
      <Button>
        <Space align="center" size={8}>
          {getEntityName(selectedItem)}
          <DropdownIcon height={14} width={14} />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default ColumnPickerMenu;

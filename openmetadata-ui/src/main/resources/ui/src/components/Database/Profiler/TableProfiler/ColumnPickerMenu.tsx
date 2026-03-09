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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import { find } from 'lodash';
import { FC, useMemo, useState } from 'react';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const selectedItem = useMemo(() => {
    return find(
      columns,
      (column: Column) => column.fullyQualifiedName === activeColumnFqn
    );
  }, [activeColumnFqn, columns]);

  return (
    <div data-testid="column-picker-menu">
      <Dropdown.Root isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Button
          color="secondary"
          data-testid="column-picker-menu-button"
          iconTrailing={<ChevronDown className="tw:size-4" />}
          size="sm">
          {getEntityName(selectedItem)}
        </Button>
        <Dropdown.Popover className="tw:max-h-87 tw:min-w-50 tw:w-max">
          <Dropdown.Menu
            selectedKeys={[activeColumnFqn]}
            selectionMode="single"
            onAction={(key) => {
              handleChange(key as string);
              setIsMenuOpen(false);
            }}>
            {columns.map((column) => (
              <Dropdown.Item
                className="tw:[&[data-selected]>div]:bg-brand-solid! tw:[&[data-selected]>div]:hover:bg-brand-solid_hover! tw:[&[data-selected]>div>span]:text-white!"
                data-testid={`column-picker-menu-item-${column.fullyQualifiedName}`}
                id={column.fullyQualifiedName || ''}
                key={column.fullyQualifiedName}>
                <>
                  <span>{getEntityName(column)}</span>{' '}
                  <span className="tw:text-xs tw:font-normal">
                    {`(${column.dataType})`}
                  </span>
                </>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
};

export default ColumnPickerMenu;

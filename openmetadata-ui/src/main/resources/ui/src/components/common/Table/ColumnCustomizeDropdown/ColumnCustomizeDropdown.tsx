/*
 *  Copyright 2026 Collate.
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
import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import { ColumnCustomize } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import DraggableMenuItemV2 from '../DraggableMenu/DraggableMenuItemV2.component';
import { ColumnCustomizeDropdownProps } from './ColumnCustomizeDropdown.interface';

/** Column show/hide + drag-reorder menu; reused by pages that render their own core `Table`. */
const ColumnCustomizeDropdown = ({
  columnDropdownSelections,
  dropdownColumnList,
  onBulkAction,
  onMoveItem,
  onSelect,
}: ColumnCustomizeDropdownProps) => {
  const { t } = useTranslation();
  const allSelected =
    dropdownColumnList.length === columnDropdownSelections.length;

  return (
    <Dropdown.Root>
      <Button
        color="tertiary"
        data-testid="column-dropdown"
        iconLeading={ColumnCustomize}
        size="sm"
        title={t('label.show-or-hide-column-plural')}>
        {t('label.customize')}
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu>
          <Dropdown.SectionHeader className="tw:px-3 tw:py-1.5  tw:flex tw:justify-between tw:items-center">
            <Typography
              className="tw:text-tertiary"
              data-testid="column-dropdown-title"
              weight="medium">
              {t('label.column')}
            </Typography>
            <Button
              color="link-color"
              data-testid="column-dropdown-action-button"
              size="xs"
              onClick={onBulkAction}>
              {allSelected ? t('label.hide-all') : t('label.view-all')}
            </Button>
          </Dropdown.SectionHeader>

          <Dropdown.Separator />
          <Dropdown.Section>
            {dropdownColumnList.map((item, index) => (
              <DraggableMenuItemV2
                currentItem={item}
                index={index}
                itemList={dropdownColumnList}
                key={item.value}
                selectedOptions={columnDropdownSelections}
                onMoveItem={onMoveItem}
                onSelect={onSelect}
              />
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default ColumnCustomizeDropdown;

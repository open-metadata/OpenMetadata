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
import { ChevronDown } from '@untitledui/icons';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { DqFilterDescriptor } from '../../../DataQuality/DataQualityDashboard/useDataQualityDashboardFilters';
import { chipLabel, chipTriggerClassName } from './dqFilterChip.utils';
import DqSearchFilterChip from './DqSearchFilterChip';

const DqFilterChip = ({
  filter,
  isOpen,
  onOpenChange,
}: {
  filter: DqFilterDescriptor;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  if (filter.type === 'owner') {
    return (
      <UserTeamSelectableList
        hasPermission
        owner={filter.selectedOwners}
        popoverProps={{ open: isOpen, placement: 'bottomLeft', onOpenChange }}
        // `UserTeamSelectableList` closes itself by clearing its internal
        // visibility state, but `popoverProps` is spread onto the Popover last,
        // so the `open` above wins and that internal close does nothing. Owning
        // `open` means owning the close on both exits, or the picker stays up
        // after a selection.
        onClose={() => onOpenChange(false)}
        onUpdate={async (owners) => {
          await filter.onChange(owners);
          onOpenChange(false);
        }}>
        <button
          className={chipTriggerClassName}
          data-testid={`search-dropdown-${filter.key}`}
          type="button">
          {chipLabel(filter.label, filter.selectedOwnerKeys.length)}
          <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
        </button>
      </UserTeamSelectableList>
    );
  }

  return (
    <DqSearchFilterChip
      isOpen={isOpen}
      label={filter.label}
      searchKey={filter.searchKey}
      searchProps={filter.searchProps}
      onOpenChange={onOpenChange}
    />
  );
};

export default DqFilterChip;

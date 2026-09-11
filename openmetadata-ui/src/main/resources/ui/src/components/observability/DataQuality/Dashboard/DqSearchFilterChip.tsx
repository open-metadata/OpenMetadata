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
import { FilterSelect } from '@openmetadata/ui-core-components';
import { DqSearchFilterProps } from '../../../DataQuality/DataQualityDashboard/useDataQualityDashboardFilters';

// Staged multi-select filter chip rendered through the unified FilterSelect:
// selections are only committed on Apply, so picking options does not trigger
// a data refetch per click.
const DqSearchFilterChip = ({
  label,
  searchKey,
  searchProps,
  isOpen,
  onOpenChange,
}: {
  label: string;
  searchKey: string;
  searchProps: DqSearchFilterProps;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { options, selectedKeys, onChange, onGetInitialOptions, onSearch } =
    searchProps;

  const handleChange = (values: string[]) => {
    const knownOptions = new Map(
      [...selectedKeys, ...options].map((option) => [option.key, option])
    );
    onChange(
      values.map(
        (value) => knownOptions.get(value) ?? { key: value, label: value }
      )
    );
  };

  return (
    <FilterSelect
      hideCounts
      searchable
      commitMode="staged"
      data-testid={`search-dropdown-${searchKey}`}
      isOpen={isOpen}
      label={label}
      options={options.map((option) => ({
        value: option.key,
        label: option.label,
        textValue: option.label,
      }))}
      resolveMissingLabel={(value) =>
        selectedKeys.find((option) => option.key === value)?.label ?? value
      }
      selectedValues={selectedKeys.map((option) => option.key)}
      triggerVariant="button"
      onChange={handleChange}
      onOpenChange={(open) => {
        if (open) {
          onGetInitialOptions();
        }
        onOpenChange(open);
      }}
      onSearch={onSearch}
    />
  );
};

export default DqSearchFilterChip;

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

import { uniq } from 'lodash';
import { TestCase } from '../../../generated/tests/testCase';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import { getColumnNameFromEntityLink } from '../../../utils/EntityUtils';
import { getEntityFQN } from '../../../utils/FeedUtils';
import { SearchDropdownOption } from '../../SearchDropdown/SearchDropdown.interface';

export function getTableFilterOptions(
  items: TestCase[]
): SearchDropdownOption[] {
  const fqns = items.map((tc) => getEntityFQN(tc.entityLink)).filter(Boolean);

  return uniq(fqns).map((fqn) => ({
    key: fqn,
    label: getNameFromFQN(fqn),
  }));
}

export function getColumnFilterOptions(
  items: TestCase[]
): SearchDropdownOption[] {
  const withColumn = items.filter((tc) =>
    tc.entityLink?.includes('::columns::')
  );
  const pairs = withColumn.map((tc) => {
    const tableFqn = getEntityFQN(tc.entityLink);
    const colName = getColumnNameFromEntityLink(tc.entityLink);

    return {
      key: `${tableFqn}::${colName ?? ''}`,
      label: colName ?? '--',
    };
  });
  const seen = new Set<string>();

  return pairs.filter((p) => {
    if (seen.has(p.key)) {
      return false;
    }

    seen.add(p.key);

    return true;
  });
}

export function getSelectedOptionsFromKeys(
  keys: string[],
  options: SearchDropdownOption[],
  getDefaultLabel: (key: string) => string
): SearchDropdownOption[] {
  return keys.map((key) => {
    const opt = options.find((o) => o.key === key);

    return opt ?? { key, label: getDefaultLabel(key) };
  });
}

export function filterTestCasesByTableAndColumn(
  items: TestCase[],
  filterTables: string[],
  filterColumns: string[]
): TestCase[] {
  let result = items;
  if (filterTables.length > 0) {
    const tableSet = new Set(filterTables);
    result = result.filter((tc) =>
      tableSet.has(getEntityFQN(tc.entityLink))
    );
  }
  if (filterColumns.length > 0) {
    const columnSet = new Set(filterColumns);
    result = result.filter((tc) => {
      if (!tc.entityLink?.includes('::columns::')) {
        return false;
      }

      const tableFqn = getEntityFQN(tc.entityLink);
      const colName = getColumnNameFromEntityLink(tc.entityLink);

      return columnSet.has(`${tableFqn}::${colName ?? ''}`);
    });
  }

  return result;
}

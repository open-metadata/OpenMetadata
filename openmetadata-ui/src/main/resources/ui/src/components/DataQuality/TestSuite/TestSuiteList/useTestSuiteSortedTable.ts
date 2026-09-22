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
import { useMemo, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { TestSuite } from '../../../../generated/tests/testCase';

export interface UseTestSuiteSortedTableProps {
  testSuites: TestSuite[];
}

/**
 * Owns the client-side SORT concern for the Test Suites table: the sort
 * descriptor, the column list (co-located with the descriptor it drives) and
 * the name-sorted view over the already-fetched rows. The rows are injected
 * from the data concern; sorting never re-fetches.
 */
export const useTestSuiteSortedTable = ({
  testSuites,
}: UseTestSuiteSortedTableProps) => {
  const { t } = useTranslation();
  const [sortDescriptor, setSortDescriptor] = useState<
    SortDescriptor | undefined
  >();

  const columnList = useMemo(
    () => [
      { id: 'name', name: t('label.name'), allowsSorting: true },
      { id: 'tests', name: t('label.test-plural') },
      { id: 'success', name: `${t('label.success')} %` },
      { id: 'owners', name: t('label.owner-plural') },
    ],
    [t]
  );

  const sortedData = useMemo(() => {
    if (!sortDescriptor?.column || !sortDescriptor?.direction) {
      return testSuites;
    }

    return [...testSuites].sort((a, b) => {
      let cmp = 0;
      if (sortDescriptor.column === 'name') {
        const getFqn = (item: TestSuite) =>
          item.basic
            ? item.basicEntityReference?.fullyQualifiedName ?? ''
            : item.fullyQualifiedName ?? '';
        cmp = getFqn(a).localeCompare(getFqn(b));
      }

      return sortDescriptor.direction === 'descending' ? -cmp : cmp;
    });
  }, [testSuites, sortDescriptor]);

  return {
    sortDescriptor,
    setSortDescriptor,
    columnList,
    sortedData,
  };
};

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

import { lazy, useCallback, useMemo } from 'react';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import { EntityDetailWidgetSkeleton } from '../../../components/common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import {
  SearchIndex,
  SearchIndexField,
} from '../../../generated/entity/data/searchIndex';
import { useFqn } from '../../../hooks/useFqn';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getAllRowKeysByKeyName } from '../../../utils/TablePureUtils';

const SearchIndexFieldsTable = withSuspenseFallback(
  lazy(() => import('../SearchIndexFieldsTable/SearchIndexFieldsTable')),
  <EntityDetailWidgetSkeleton lineCount={5} />
);

function SearchIndexFieldsTab() {
  const { fqn: entityFqn } = useFqn();
  const { data, permissions, onUpdate } = useGenericContext<SearchIndex>();
  const { fields, deleted } = useMemo(() => data, [data.fields, data.deleted]);

  // Consumer via useGenericContext() (Task 8 rule 2). Ungated: `deleted` is passed
  // separately to SearchIndexFieldsTable as `isReadOnly` (handled at the individual
  // TableDescription/TableTags render sites), never folded into these edit flags in
  // the old code — same isReadOnly-vs-deleted separation as the sibling SchemaTable
  // family. All 3 raw `EditAll || EditField` OR-expressions are explicit-deny-wins
  // fixes: getDerivedPermissionFlags prioritizes the field-specific key over EditAll.
  const flags = useMemo(() => getDerivedPermissionFlags(permissions), [permissions]);

  const {
    hasDescriptionEditAccess,
    hasGlossaryTermEditAccess,
    hasTagEditAccess,
  } = useMemo(
    () => ({
      hasDescriptionEditAccess: flags.canEditDescription,
      hasGlossaryTermEditAccess: flags.canEditGlossaryTerms,
      hasTagEditAccess: flags.canEditTags,
    }),
    [flags]
  );

  const fieldAllRowKeys = useMemo(() => {
    return getAllRowKeysByKeyName<SearchIndexField>(
      fields,
      'fullyQualifiedName'
    );
  }, [fields]);

  const handleSearchIndexFieldsUpdate = useCallback(
    async (updatedFields: Array<SearchIndexField>) => {
      await onUpdate({
        ...data,
        fields: updatedFields,
      });
    },
    [data, onUpdate]
  );

  return (
    <SearchIndexFieldsTable
      entityFqn={entityFqn}
      fieldAllRowKeys={fieldAllRowKeys}
      hasDescriptionEditAccess={hasDescriptionEditAccess}
      hasGlossaryTermEditAccess={hasGlossaryTermEditAccess}
      hasTagEditAccess={hasTagEditAccess}
      isReadOnly={Boolean(deleted)}
      searchIndexFields={fields}
      onUpdate={handleSearchIndexFieldsUpdate}
    />
  );
}

export default SearchIndexFieldsTab;

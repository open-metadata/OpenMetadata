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

import { useCallback, useMemo } from 'react';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericProvider';
import {
  SearchIndex,
  SearchIndexField,
} from '../../../generated/entity/data/searchIndex';
import { useFqn } from '../../../hooks/useFqn';
import { getAllRowKeysByKeyName } from '../../../utils/TableUtils';
import SearchIndexFieldsTable from '../SearchIndexFieldsTable/SearchIndexFieldsTable';

function SearchIndexFieldsTab() {
  const { fqn: entityFqn } = useFqn();
  const { data, permissions, onUpdate } = useGenericContext<SearchIndex>();
  const { fields, deleted } = useMemo(() => data, [data.fields, data.deleted]);

  const {
    hasDescriptionEditAccess,
    hasGlossaryTermEditAccess,
    hasTagEditAccess,
  } = useMemo(
    () => ({
      hasDescriptionEditAccess:
        permissions.EditAll || permissions.EditDescription,
      hasGlossaryTermEditAccess:
        permissions.EditAll || permissions.EditGlossaryTerms,
      hasTagEditAccess: permissions.EditAll || permissions.EditTags,
    }),
    [permissions]
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

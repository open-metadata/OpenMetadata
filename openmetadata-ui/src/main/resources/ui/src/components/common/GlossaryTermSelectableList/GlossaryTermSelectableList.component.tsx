/*
 *  Copyright 2025 Collate.
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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ADD_USER_CONTAINER_HEIGHT } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  convertEntityReferencesToTerms,
  convertTermsToEntityReferences,
  GlossaryTermListItemRenderer,
} from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import { fetchGlossaryList } from '../../../utils/TagsUtils';
import { EntitySelectableList } from '../EntitySelectableList/EntitySelectableList.component';
import { EntitySelectableListConfig } from '../EntitySelectableList/EntitySelectableList.interface';
import { GlossaryTermSelectableListProps } from './GlossaryTermSelectableList.interface';

const fetchGlossaryTermOptions = async (searchText: string, after?: string) => {
  try {
    const afterPage = after ? Number.parseInt(after, 10) : 1;
    const response = await fetchGlossaryList(searchText, afterPage);
    const terms = response.data || [];

    const entityRefs: EntityReference[] = terms.map((term) => ({
      id: term.value,
      name: term.data?.name || term.label,
      displayName: term.data?.displayName || term.label,
      type: 'glossaryTerm',
      fullyQualifiedName: term.value,
      description: term.data?.description,
    }));

    return {
      data: entityRefs,
      paging: {
        total: response.paging?.total || terms.length,
        after: response.paging?.after ? String(afterPage + 1) : undefined,
      },
    };
  } catch (error) {
    return { data: [], paging: { total: 0 } };
  }
};

export const GlossaryTermSelectableList = ({
  selectedTerms = [],
  onUpdate,
  children,
  popoverProps,
  onCancel,
  listHeight = ADD_USER_CONTAINER_HEIGHT,
  multiSelect = true,
}: GlossaryTermSelectableListProps & { listHeight?: number }) => {
  const { t } = useTranslation();

  const config: EntitySelectableListConfig<TagLabel> = useMemo(
    () => ({
      toEntityReference: convertTermsToEntityReferences,
      fromEntityReference: convertEntityReferencesToTerms,
      fetchOptions: fetchGlossaryTermOptions,
      customTagRenderer: GlossaryTermListItemRenderer,
      searchPlaceholder: t('label.search-for-type', {
        type: t('label.glossary-term'),
      }),
      searchBarDataTestId: 'glossary-term-select-search-bar',
      overlayClassName: 'glossary-term-select-popover',
    }),
    [t]
  );

  return (
    <EntitySelectableList
      config={config}
      listHeight={listHeight}
      multiSelect={multiSelect}
      popoverProps={popoverProps}
      selectedItems={selectedTerms}
      onCancel={onCancel}
      onUpdate={onUpdate}>
      {children}
    </EntitySelectableList>
  );
};

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
import { Popover, Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import {
  ADD_USER_CONTAINER_HEIGHT,
  DE_ACTIVE_COLOR,
} from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { fetchGlossaryList } from '../../../utils/TagsUtils';
import { FocusTrapWithContainer } from '../FocusTrap/FocusTrapWithContainer';
import { SelectableList } from '../SelectableList/SelectableList.component';
import { GlossaryTermSelectableListProps } from './GlossaryTermSelectableList.interface';

export const GlossaryTermListItemRenderer = (props: EntityReference) => {
  return (
    <Space>
      <IconTerm
        className="align-middle"
        color={DE_ACTIVE_COLOR}
        height={16}
        name="doc"
        width={16}
      />
      <Typography.Text>{props.displayName || props.name}</Typography.Text>
    </Space>
  );
};

export const GlossaryTermSelectableList = ({
  selectedTerms = [],
  onUpdate,
  children,
  popoverProps,
  onCancel,
  listHeight = ADD_USER_CONTAINER_HEIGHT,
}: GlossaryTermSelectableListProps & { listHeight?: number }) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();

  const convertTermsToEntityReferences = (
    terms: TagLabel[]
  ): EntityReference[] => {
    return terms.map((term) => ({
      id: term.tagFQN || '',
      name: term.name || term.tagFQN || '',
      displayName: term.displayName || term.name || term.tagFQN,
      type: 'glossaryTerm',
      fullyQualifiedName: term.tagFQN,
      description: term.description,
    }));
  };

  const convertEntityReferencesToTerms = (
    refs: EntityReference[]
  ): TagLabel[] => {
    return refs.map((ref) => ({
      tagFQN: ref.fullyQualifiedName || ref.id,
      displayName: ref.displayName || ref.name,
      name: ref.name,
      source: TagSource.Glossary,
      labelType: LabelType.Manual,
      state: State.Confirmed,
      description: ref.description,
    }));
  };

  const fetchGlossaryTermOptions = async (
    searchText: string,
    after?: string
  ) => {
    try {
      const afterPage = after ? parseInt(after, 10) : 1;
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

  const handleUpdate = async (updateItems: EntityReference[]) => {
    const updatedTerms = convertEntityReferencesToTerms(updateItems);
    await onUpdate(updatedTerms);
    setPopupVisible(false);
  };

  const handleCancel = () => {
    setPopupVisible(false);
  };

  return (
    <Popover
      destroyTooltipOnHide
      content={
        <FocusTrapWithContainer active={popoverProps?.open || popupVisible}>
          <SelectableList
            multiSelect
            customTagRenderer={GlossaryTermListItemRenderer}
            fetchOptions={fetchGlossaryTermOptions}
            height={listHeight}
            searchBarDataTestId="glossary-term-select-search-bar"
            searchPlaceholder={t('label.search-for-type', {
              type: t('label.glossary-term'),
            })}
            selectedItems={convertTermsToEntityReferences(selectedTerms)}
            onCancel={onCancel}
            onUpdate={handleUpdate}
          />
        </FocusTrapWithContainer>
      }
      open={popupVisible}
      overlayClassName={`glossary-term-select-popover ${popoverProps?.overlayClassName}`}
      placement="bottomLeft"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}
      {...popoverProps}>
      {children}
    </Popover>
  );
};

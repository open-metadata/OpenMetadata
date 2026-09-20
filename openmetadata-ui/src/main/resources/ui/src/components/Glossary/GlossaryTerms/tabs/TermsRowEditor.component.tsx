/*
 *  Copyright 2022 Collate.
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

import { Button, Select } from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { useCallback, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { EntityType } from '../../../../enums/entity.enum';
import { TagSource } from '../../../../generated/entity/data/container';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { getEntityReferenceFromEntity } from '../../../../utils/EntityReferenceUtils';
import { GlossaryPickerValue } from '../../../common/GlossaryTermPicker/GlossaryTagSuggestionUtils';
import GlossaryTermPicker from '../../../common/GlossaryTermPicker/GlossaryTermPicker';
import {
  TermItem,
  TermsRowEditorProps,
  TermsRowProps,
} from './RelatedTerms.interface';

// A seeded row already knows its reference; a freshly picked term carries the
// entity the picker fetched.
const termItemToPickerValue = (term: TermItem): GlossaryPickerValue =>
  ({
    tagFQN: term.value,
    name: term.label,
    source: TagSource.Glossary,
  } as GlossaryPickerValue);

const pickerValueToTermItem = (
  term: GlossaryPickerValue,
  initialTerms: TermItem[]
): TermItem => ({
  value: term.tagFQN,
  label: term.name ?? term.tagFQN,
  entity: term.entity
    ? getEntityReferenceFromEntity(
        term.entity as GlossaryTerm,
        EntityType.GLOSSARY_TERM
      )
    : initialTerms.find((i) => i.value === term.tagFQN)?.entity,
});

const TermsRow: React.FC<TermsRowProps> = ({
  rowId,
  initialRelationType,
  initialTerms,
  relationTypeOptions,
  excludeFQN,
  onRelationTypeChange,
  onTermsChange,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [relationType, setRelationType] = useState(initialRelationType);
  const [selectedTerms, setSelectedTerms] = useState<GlossaryPickerValue[]>(() =>
    initialTerms.map(termItemToPickerValue)
  );

  const handleRelationTypeChange = useCallback(
    (key: Key | null) => {
      setRelationType(String(key ?? ''));
      onRelationTypeChange(rowId, String(key ?? ''));
    },
    [rowId, onRelationTypeChange]
  );

  const handleTermsChange = useCallback(
    (terms: GlossaryPickerValue[]) => {
      setSelectedTerms(terms);
      onTermsChange(
        rowId,
        terms.map((term) => pickerValueToTermItem(term, initialTerms))
      );
    },
    [rowId, onTermsChange, initialTerms]
  );

  return (
    <div
      className="d-flex items-center gap-3"
      data-testid={`relation-row-${rowId}`}>
      <div className="tw:w-67.5 tw:shrink-0">
        <Select
          className="w-full"
          fontSize="sm"
          items={relationTypeOptions}
          size="sm"
          value={relationType}
          onChange={handleRelationTypeChange}>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>
      </div>
      <div className="tw:flex-1" data-testid={`term-autocomplete-${rowId}`}>
        <GlossaryTermPicker
          data-testid={`term-picker-${rowId}`}
          // A term cannot be related to itself.
          excludeFqns={[excludeFQN]}
          placeholder={t('label.add-entity', {
            entity: t('label.term-plural'),
          })}
          value={selectedTerms}
          onChange={handleTermsChange}
        />
      </div>
      <Button
        color="tertiary-destructive"
        data-testid={`remove-row-${rowId}`}
        iconLeading={Trash01}
        size="sm"
        onClick={() => onRemove(rowId)}
      />
    </div>
  );
};

const TermsRowEditor: React.FC<TermsRowEditorProps> = ({
  rows,
  excludeFQN,
  relationTypeOptions,
  onAddRow,
  onRelationTypeChange,
  onTermsChange,
  onRemove,
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {rows.map((row) => (
        <TermsRow
          excludeFQN={excludeFQN}
          initialRelationType={row.relationType}
          initialTerms={row.terms}
          key={row.id}
          relationTypeOptions={relationTypeOptions}
          rowId={row.id}
          onRelationTypeChange={onRelationTypeChange}
          onRemove={onRemove}
          onTermsChange={onTermsChange}
        />
      ))}
      <Button
        className="tw:w-fit"
        color="tertiary"
        data-testid="add-row-button"
        size="sm"
        onClick={onAddRow}>
        {`+ ${t('label.add-entity', {
          entity: t('label.related-term-plural'),
        })}`}
      </Button>
    </div>
  );
};

export default TermsRowEditor;

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

import {
  Button,
  Checkbox,
  Input,
  Select,
  TextArea,
} from '@openmetadata/ui-core-components';
import { Download01, UploadCloud01 } from '@untitledui/icons';
import { ChangeEvent, RefObject } from 'react';
import { FieldPath, FieldPathValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  MatchField,
  MatchMode,
  Operation,
} from '../../generated/api/data/ontologyBulkRequest';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { OntologyBulkFormState } from './OntologyBulkAuthoring.utils';

interface OntologyBulkOperationFieldsProps {
  fileInputRef: RefObject<HTMLInputElement>;
  form: OntologyBulkFormState;
  isDownloadingTemplate: boolean;
  relationshipTypes: RelationshipType[];
  onDownloadTemplate: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdate: <Field extends FieldPath<OntologyBulkFormState>>(
    field: Field,
    value: FieldPathValue<OntologyBulkFormState, Field>
  ) => void;
}

interface SelectOption {
  id: string;
  label: string;
}

const OntologyBulkOperationFields = ({
  fileInputRef,
  form,
  isDownloadingTemplate,
  relationshipTypes,
  onDownloadTemplate,
  onFileChange,
  onUpdate,
}: OntologyBulkOperationFieldsProps) => {
  const { t } = useTranslation();
  const operationOptions: SelectOption[] = [
    {
      id: Operation.CSVUpsert,
      label: `${t('label.csv')} ${t('label.upload')}`,
    },
    {
      id: Operation.FindReplace,
      label: `${t('label.find')} / ${t('label.replace')}`,
    },
    {
      id: Operation.RetypeRelationships,
      label: `${t('label.relationship-type')} ${t('label.edit')}`,
    },
  ];
  const relationshipTypeOptions = relationshipTypes.map((type) => ({
    id: type.id,
    label: type.displayName ?? type.name,
  }));

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <Select
        data-testid="ontology-bulk-operation"
        items={operationOptions}
        label={t('label.operation')}
        value={form.operation}
        onChange={(key) => onUpdate('operation', String(key) as Operation)}>
        {(item) => (
          <Select.Item id={item.id} key={item.id} label={item.label} />
        )}
      </Select>

      {form.operation === Operation.CSVUpsert ? (
        <div className="tw:flex tw:flex-col tw:gap-3">
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <input
              accept=".csv,text/csv"
              aria-label={t('label.csv')}
              className="tw:hidden"
              data-testid="ontology-bulk-file-input"
              ref={fileInputRef}
              type="file"
              onChange={onFileChange}
            />
            <Button
              color="secondary"
              iconLeading={UploadCloud01}
              size="sm"
              onClick={() => fileInputRef.current?.click()}>
              {t('label.upload')} {t('label.csv')}
            </Button>
            <Button
              color="secondary"
              data-testid="ontology-bulk-download-template"
              iconLeading={Download01}
              isLoading={isDownloadingTemplate}
              size="sm"
              onClick={onDownloadTemplate}>
              {t('label.download')} {t('label.template')}
            </Button>
          </div>
          <TextArea
            data-testid="ontology-bulk-csv"
            label={t('label.csv')}
            rows={10}
            value={form.csv}
            onChange={(value) => onUpdate('csv', value)}
          />
        </div>
      ) : null}

      {form.operation === Operation.FindReplace ? (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-2">
          <Select
            items={[
              { id: MatchField.Name, label: t('label.name') },
              { id: MatchField.DisplayName, label: t('label.display-name') },
              { id: MatchField.Description, label: t('label.description') },
            ]}
            label={t('label.field')}
            value={form.field}
            onChange={(key) => onUpdate('field', String(key) as MatchField)}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
          <Select
            items={[
              { id: MatchMode.Exact, label: t('label.is-exactly') },
              { id: MatchMode.Contains, label: t('label.contains') },
            ]}
            label={t('label.match-type')}
            value={form.matchMode}
            onChange={(key) => onUpdate('matchMode', String(key) as MatchMode)}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
          <Input
            isRequired
            data-testid="ontology-bulk-find"
            label={t('label.find')}
            value={form.find}
            onChange={(value) => onUpdate('find', value)}
          />
          <Input
            data-testid="ontology-bulk-replacement"
            label={t('label.replace')}
            value={form.replacement}
            onChange={(value) => onUpdate('replacement', value)}
          />
          <Checkbox
            isSelected={form.caseSensitive}
            label={t('label.sensitive')}
            onChange={(isSelected) => onUpdate('caseSensitive', isSelected)}
          />
        </div>
      ) : null}

      {form.operation === Operation.RetypeRelationships ? (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-2">
          <Select
            items={relationshipTypeOptions}
            label={`${t('label.relationship-type')} ${t(
              'label.from-lowercase'
            )}`}
            value={form.fromRelationshipTypeId}
            onChange={(key) => onUpdate('fromRelationshipTypeId', String(key))}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
          <Select
            items={relationshipTypeOptions}
            label={`${t('label.relationship-type')} ${t('label.to-lowercase')}`}
            value={form.toRelationshipTypeId}
            onChange={(key) => onUpdate('toRelationshipTypeId', String(key))}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
          <TextArea
            className="tw:lg:col-span-2"
            label={`${t('label.term-plural')} (${t('label.optional')})`}
            rows={4}
            value={form.termIds}
            onChange={(value) => onUpdate('termIds', value)}
          />
        </div>
      ) : null}
    </div>
  );
};

export default OntologyBulkOperationFields;

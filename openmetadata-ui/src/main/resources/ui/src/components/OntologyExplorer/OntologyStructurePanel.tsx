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
  Alert,
  Button,
  Card,
  Checkbox,
  FieldProp,
  FieldTypes,
  getField,
  HookForm,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Key, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field as MergeField } from '../../generated/api/data/mergeOntologyStructure';
import {
  Field as DiffField,
  OntologyStructuralDiff,
  State as DiffState,
  TermDiff,
} from '../../generated/api/data/ontologyStructuralDiff';
import { OntologyStructuralMergeResult } from '../../generated/api/data/ontologyStructuralMergeResult';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  diffOntologyStructure,
  mergeOntologyStructure,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyTermSelection from './OntologyTermSelection';

interface OntologyStructurePanelProps {
  glossaries: Glossary[];
  graphData?: OntologyGraphData | null;
  selectedGlossary: Glossary;
}

interface StructureFormState {
  changeSetDescription: string;
  changeSetDisplayName: string;
  changeSetName: string;
  sourceGlossaryId: string;
  subsetTermIds: string[];
  targetGlossaryId: string;
}

interface FieldSelection {
  fields: DiffField[];
  subsetTermId: string;
}

const OntologyStructurePanel = ({
  glossaries,
  graphData,
  selectedGlossary,
}: OntologyStructurePanelProps) => {
  const { t } = useTranslation();
  const form = useForm<StructureFormState>({
    defaultValues: defaults(selectedGlossary),
  });
  const values = form.watch();
  const [diff, setDiff] = useState<OntologyStructuralDiff>();
  const [isDiffing, setIsDiffing] = useState(false);
  const [mergeResult, setMergeResult] =
    useState<OntologyStructuralMergeResult>();
  const [selections, setSelections] = useState<FieldSelection[]>([]);
  const glossaryOptions = glossaries.map((glossary) => ({
    id: glossary.id,
    label: glossary.displayName ?? glossary.name,
  }));
  const targetNodes = useMemo(
    () =>
      (graphData?.nodes ?? []).filter(
        (node) => node.glossaryId === values.targetGlossaryId
      ),
    [graphData?.nodes, values.targetGlossaryId]
  );

  useEffect(() => {
    form.reset(defaults(selectedGlossary));
    setDiff(undefined);
    setMergeResult(undefined);
    setSelections([]);
  }, [form, selectedGlossary.id, selectedGlossary.name]);

  const handleDiff = async () => {
    setIsDiffing(true);
    try {
      const result = await diffOntologyStructure({
        sourceGlossaryId: values.sourceGlossaryId,
        subsetTermIds: values.subsetTermIds,
        targetGlossaryId: values.targetGlossaryId,
      });
      setDiff(result);
      setSelections(defaultSelections(result));
      setMergeResult(undefined);
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsDiffing(false);
    }
  };

  const handleMerge = async (submitted: StructureFormState) => {
    try {
      const result = await mergeOntologyStructure({
        changeSetDescription: submitted.changeSetDescription.trim(),
        changeSetDisplayName:
          submitted.changeSetDisplayName.trim() || undefined,
        changeSetName: submitted.changeSetName.trim(),
        contextTermIds: submitted.subsetTermIds,
        selections: selections
          .filter((selection) => selection.fields.length)
          .map((selection) => ({
            fields: selection.fields.map(toMergeField),
            subsetTermId: selection.subsetTermId,
          })),
        sourceGlossaryId: submitted.sourceGlossaryId,
        targetGlossaryId: submitted.targetGlossaryId,
      });
      setMergeResult(result);
      showSuccessToast(t('label.draft-created'));
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  };

  const selectGlossary = (
    field: 'sourceGlossaryId' | 'targetGlossaryId',
    key: Key | null
  ) => {
    if (key) {
      form.setValue(field, String(key), { shouldDirty: true });
      if (field === 'targetGlossaryId') {
        form.setValue('subsetTermIds', []);
      }
      setDiff(undefined);
      setSelections([]);
    }
  };

  const toggleField = (
    subsetTermId: string,
    field: DiffField,
    selected: boolean
  ) => {
    setSelections((current) =>
      current.map((selection) =>
        selection.subsetTermId === subsetTermId
          ? {
              ...selection,
              fields: selected
                ? [...selection.fields, field]
                : selection.fields.filter((candidate) => candidate !== field),
            }
          : selection
      )
    );
  };

  const metadataFields: FieldProp[] = [
    requiredField('changeSetName', t('label.change-set-name'), t),
    textField('changeSetDisplayName', t('label.display-name')),
    requiredField(
      'changeSetDescription',
      t('label.draft-description'),
      t,
      FieldTypes.TEXTAREA
    ),
  ];
  const canDiff = Boolean(
    values.sourceGlossaryId &&
      values.targetGlossaryId &&
      values.sourceGlossaryId !== values.targetGlossaryId &&
      values.subsetTermIds.length
  );
  const canMerge = Boolean(
    canDiff &&
      diff &&
      selections.some((selection) => selection.fields.length) &&
      values.changeSetName.trim() &&
      values.changeSetDescription.trim()
  );

  return (
    <HookForm form={form} onSubmit={form.handleSubmit(handleMerge)}>
      <Card
        className="tw:flex tw:flex-col tw:gap-5 tw:border tw:border-secondary tw:p-5 tw:ring-0"
        data-testid="ontology-structure-panel">
        <Typography as="h3" size="text-lg" weight="semibold">
          {t('label.merge')}
        </Typography>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          <Select
            items={glossaryOptions}
            label={`${t('label.source')} ${t('label.glossary')}`}
            value={values.sourceGlossaryId}
            onChange={(key) => selectGlossary('sourceGlossaryId', key)}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
          <Select
            items={glossaryOptions}
            label={`${t('label.target')} ${t('label.glossary')}`}
            value={values.targetGlossaryId}
            onChange={(key) => selectGlossary('targetGlossaryId', key)}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
        </div>
        <OntologyTermSelection
          label={t('label.term-plural')}
          maxItems={500}
          nodes={targetNodes}
          selectedIds={values.subsetTermIds}
          onChange={(subsetTermIds) => {
            form.setValue('subsetTermIds', subsetTermIds, {
              shouldDirty: true,
            });
            setDiff(undefined);
            setSelections([]);
          }}
        />
        <Button
          color="secondary"
          data-testid="ontology-structure-diff"
          isDisabled={!canDiff}
          isLoading={isDiffing}
          onClick={() => void handleDiff()}>
          {t('label.preview')} {t('label.change-plural')}
        </Button>

        {diff ? (
          <div className="tw:flex tw:flex-col tw:gap-3">
            {diff.data.map((termDiff) => (
              <DiffSelection
                key={termDiff.subsetTerm.id}
                selection={selections.find(
                  (selection) =>
                    selection.subsetTermId === termDiff.subsetTerm.id
                )}
                termDiff={termDiff}
                onToggle={toggleField}
              />
            ))}
          </div>
        ) : null}

        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          {metadataFields.slice(0, 2).map((field) => (
            <div key={field.name}>{getField(field)}</div>
          ))}
          <div className="tw:md:col-span-2">{getField(metadataFields[2])}</div>
        </div>
        <Button
          color="primary"
          data-testid="ontology-structure-merge"
          isDisabled={!canMerge}
          isLoading={form.formState.isSubmitting}
          type="submit">
          {t('label.create-draft')}
        </Button>
        {mergeResult ? (
          <Alert
            title={
              mergeResult.changeSet.displayName ??
              mergeResult.changeSet.name ??
              t('label.draft')
            }
            variant="success">
            {`${mergeResult.terms.length} ${t('label.term-plural')} · ${
              mergeResult.relationshipOperations.length
            } ${t('label.relationship-plural')}`}
          </Alert>
        ) : null}
      </Card>
    </HookForm>
  );
};

interface DiffSelectionProps {
  selection?: FieldSelection;
  termDiff: TermDiff;
  onToggle: (subsetTermId: string, field: DiffField, selected: boolean) => void;
}

const DiffSelection = ({
  selection,
  termDiff,
  onToggle,
}: DiffSelectionProps) => {
  const { t } = useTranslation();

  return (
    <Card className="tw:flex tw:flex-col tw:gap-3 tw:border tw:border-secondary tw:p-4 tw:ring-0">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <Typography size="text-sm" weight="semibold">
          {termDiff.subsetTerm.displayName ?? termDiff.subsetTerm.name}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {stateLabel(termDiff.state, t)}
        </Typography>
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        {termDiff.sourceChangedFields.map((field) => {
          const isConflict = termDiff.conflictingFields.includes(field);

          return (
            <Checkbox
              isDisabled={isConflict}
              isSelected={selection?.fields.includes(field) ?? false}
              key={field}
              label={fieldLabel(field, t)}
              onChange={(selected) =>
                onToggle(termDiff.subsetTerm.id, field, selected)
              }
            />
          );
        })}
      </div>
    </Card>
  );
};

const defaultSelections = (diff: OntologyStructuralDiff): FieldSelection[] =>
  diff.data.map((termDiff) => ({
    fields: termDiff.sourceChangedFields.filter(
      (field) => !termDiff.conflictingFields.includes(field)
    ),
    subsetTermId: termDiff.subsetTerm.id,
  }));

const toMergeField = (field: DiffField): MergeField => {
  let result: MergeField;

  switch (field) {
    case DiffField.Attributes:
      result = MergeField.Attributes;

      break;
    case DiffField.ConceptMappings:
      result = MergeField.ConceptMappings;

      break;
    case DiffField.Description:
      result = MergeField.Description;

      break;
    case DiffField.DisplayName:
      result = MergeField.DisplayName;

      break;
    case DiffField.EntityStatus:
      result = MergeField.EntityStatus;

      break;
    case DiffField.Name:
      result = MergeField.Name;

      break;
    case DiffField.Parent:
      result = MergeField.Parent;

      break;
    case DiffField.Relationships:
      result = MergeField.Relationships;

      break;
  }

  return result;
};

const stateLabel = (
  state: DiffState,
  t: ReturnType<typeof useTranslation>['t']
) => {
  let label: string;

  switch (state) {
    case DiffState.Conflict:
      label = t('label.conflict-resolution');

      break;
    case DiffState.Mergeable:
      label = t('label.merge');

      break;
    case DiffState.SourceChanged:
      label = `${t('label.source')} ${t('label.change')}`;

      break;
    case DiffState.SubsetChanged:
      label = `${t('label.target')} ${t('label.change')}`;

      break;
    case DiffState.Unchanged:
      label = t('label.no-change');

      break;
  }

  return label;
};

const fieldLabel = (
  field: DiffField,
  t: ReturnType<typeof useTranslation>['t']
) => {
  let label: string;

  switch (field) {
    case DiffField.Attributes:
      label = t('label.custom-property-plural');

      break;
    case DiffField.ConceptMappings:
      label = t('label.mapping-plural');

      break;
    case DiffField.Description:
      label = t('label.description');

      break;
    case DiffField.DisplayName:
      label = t('label.display-name');

      break;
    case DiffField.EntityStatus:
      label = t('label.entity-status');

      break;
    case DiffField.Name:
      label = t('label.name');

      break;
    case DiffField.Parent:
      label = t('label.parent');

      break;
    case DiffField.Relationships:
      label = t('label.relationship-plural');

      break;
  }

  return label;
};

const defaults = (glossary: Glossary): StructureFormState => ({
  changeSetDescription: glossary.description,
  changeSetDisplayName: glossary.displayName ?? glossary.name,
  changeSetName: `merge-${glossary.name}`,
  sourceGlossaryId: '',
  subsetTermIds: [],
  targetGlossaryId: glossary.id,
});

const textField = (
  name: string,
  label: string,
  type: FieldTypes = FieldTypes.TEXT
): FieldProp => ({ label, name, type });

const requiredField = (
  name: string,
  label: string,
  t: ReturnType<typeof useTranslation>['t'],
  type: FieldTypes = FieldTypes.TEXT
): FieldProp => ({
  label,
  name,
  required: true,
  rules: { required: t('label.field-required', { field: label }) },
  type,
});

export default OntologyStructurePanel;

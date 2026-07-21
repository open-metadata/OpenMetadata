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
import { BuildOntologySubset } from '../../generated/api/data/buildOntologySubset';
import { OntologySubsetResult } from '../../generated/api/data/ontologySubsetResult';
import { Glossary } from '../../generated/entity/data/glossary';
import { buildOntologySubset } from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyTermSelection from './OntologyTermSelection';

interface OntologySubsetPanelProps {
  glossaries: Glossary[];
  graphData?: OntologyGraphData | null;
  selectedGlossary: Glossary;
}

interface SubsetFormState extends BuildOntologySubset {
  changeSetDisplayName: string;
  includeDescendants: boolean;
  includeRelationships: boolean;
}

const OntologySubsetPanel = ({
  glossaries,
  graphData,
  selectedGlossary,
}: OntologySubsetPanelProps) => {
  const { t } = useTranslation();
  const form = useForm<SubsetFormState>({
    defaultValues: defaults(selectedGlossary),
  });
  const values = form.watch();
  const [result, setResult] = useState<OntologySubsetResult>();
  const glossaryOptions = glossaries.map((glossary) => ({
    id: glossary.id,
    label: glossary.displayName ?? glossary.name,
  }));
  const sourceNodes = useMemo(
    () =>
      (graphData?.nodes ?? []).filter(
        (node) => node.glossaryId === values.sourceGlossaryId
      ),
    [graphData?.nodes, values.sourceGlossaryId]
  );

  useEffect(() => {
    form.reset(defaults(selectedGlossary));
    setResult(undefined);
  }, [form, selectedGlossary.id, selectedGlossary.name]);

  const submit = async (request: SubsetFormState) => {
    try {
      setResult(
        await buildOntologySubset({
          ...request,
          changeSetDescription: request.changeSetDescription.trim(),
          changeSetDisplayName:
            request.changeSetDisplayName.trim() || undefined,
          changeSetName: request.changeSetName.trim(),
        })
      );
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
      if (field === 'sourceGlossaryId') {
        form.setValue('sourceTermIds', []);
      }
      setResult(undefined);
    }
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
  const isReady = Boolean(
    values.sourceGlossaryId &&
      values.targetGlossaryId &&
      values.sourceGlossaryId !== values.targetGlossaryId &&
      values.sourceTermIds.length &&
      values.changeSetName.trim() &&
      values.changeSetDescription.trim()
  );

  return (
    <HookForm form={form} onSubmit={form.handleSubmit(submit)}>
      <Card
        className="tw:flex tw:flex-col tw:gap-5 tw:border tw:border-secondary tw:p-5 tw:ring-0"
        data-testid="ontology-subset-panel">
        <Typography as="h3" size="text-lg" weight="semibold">
          {t('label.include')} {t('label.term-plural')}
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
          maxItems={100}
          nodes={sourceNodes}
          selectedIds={values.sourceTermIds}
          onChange={(sourceTermIds) =>
            form.setValue('sourceTermIds', sourceTermIds, {
              shouldDirty: true,
            })
          }
        />
        <div className="tw:flex tw:flex-wrap tw:gap-4">
          <Checkbox
            isSelected={values.includeDescendants}
            label={`${t('label.include')} ${t('label.children-lowercase')}`}
            onChange={(includeDescendants) =>
              form.setValue('includeDescendants', includeDescendants)
            }
          />
          <Checkbox
            isSelected={values.includeRelationships}
            label={`${t('label.include')} ${t('label.relationship-plural')}`}
            onChange={(includeRelationships) =>
              form.setValue('includeRelationships', includeRelationships)
            }
          />
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          {metadataFields.slice(0, 2).map((field) => (
            <div key={field.name}>{getField(field)}</div>
          ))}
          <div className="tw:md:col-span-2">{getField(metadataFields[2])}</div>
        </div>
        <Button
          color="primary"
          data-testid="ontology-subset-submit"
          isDisabled={!isReady}
          isLoading={form.formState.isSubmitting}
          type="submit">
          {t('label.create-draft')}
        </Button>
        {result ? (
          <Alert
            title={
              result.changeSet.displayName ??
              result.changeSet.name ??
              t('label.draft')
            }
            variant="success">
            {`${result.terms.length} ${t('label.term-plural')} · ${
              result.relationships.length
            } ${t('label.relationship-plural')}`}
          </Alert>
        ) : null}
      </Card>
    </HookForm>
  );
};

const defaults = (glossary: Glossary): SubsetFormState => ({
  changeSetDescription: glossary.description,
  changeSetDisplayName: glossary.displayName ?? glossary.name,
  changeSetName: `subset-${glossary.name}`,
  includeDescendants: true,
  includeRelationships: true,
  sourceGlossaryId: '',
  sourceTermIds: [],
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

export default OntologySubsetPanel;

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
import { OntologyPatternInstantiationResult } from '../../generated/api/data/ontologyPatternInstantiationResult';
import {
  OntologyPatternTemplate,
  PatternType,
} from '../../generated/api/data/ontologyPatternTemplate';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  instantiateOntologyPattern,
  listOntologyPatterns,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  buildOntologyPatternRequest,
  createEmptyPatternForm,
  isOntologyPatternReady,
  isPatternTermKey,
  OntologyPatternFormState,
  PatternTermKey,
  patternTermPaths,
} from './OntologyModelingWorkbench.utils';

interface OntologyPatternPanelProps {
  glossary: Glossary;
}

const OntologyPatternPanel = ({ glossary }: OntologyPatternPanelProps) => {
  const { t } = useTranslation();
  const form = useForm<OntologyPatternFormState>({
    defaultValues: createEmptyPatternForm(),
  });
  const values = form.watch();
  const [patterns, setPatterns] = useState<OntologyPatternTemplate[]>([]);
  const [result, setResult] = useState<OntologyPatternInstantiationResult>();

  useEffect(() => {
    let isCurrent = true;
    listOntologyPatterns()
      .then((response) => isCurrent && setPatterns(response.data))
      .catch(() => isCurrent && showErrorToast(t('server.unexpected-error')));

    return () => {
      isCurrent = false;
    };
  }, [t]);

  useEffect(() => {
    const initial = createEmptyPatternForm();
    form.reset({
      ...initial,
      changeSetDescription: glossary.description,
      changeSetDisplayName: glossary.displayName ?? glossary.name,
      changeSetName: `pattern-${glossary.name}`,
    });
    setResult(undefined);
  }, [
    form,
    glossary.description,
    glossary.displayName,
    glossary.id,
    glossary.name,
  ]);

  const template = patterns.find(
    (pattern) => pattern.patternType === values.patternType
  );
  const termKeys = useMemo(
    () =>
      (template?.termRoles ?? [])
        .map((role) => role.key)
        .filter(isPatternTermKey),
    [template]
  );
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

  const submit = async (submitted: OntologyPatternFormState) => {
    try {
      const created = await instantiateOntologyPattern(
        buildOntologyPatternRequest(glossary.id, submitted)
      );
      setResult(created);
      showSuccessToast(t('label.draft-created'));
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  };

  const selectPattern = (key: Key | null) => {
    if (key) {
      form.setValue('patternType', String(key) as PatternType, {
        shouldDirty: true,
      });
      setResult(undefined);
    }
  };

  return (
    <HookForm form={form} onSubmit={form.handleSubmit(submit)}>
      <Card
        className="tw:flex tw:flex-col tw:gap-5 tw:border tw:border-secondary tw:p-5 tw:ring-0"
        data-testid="ontology-pattern-panel">
        <div>
          <Typography as="h3" size="text-lg" weight="semibold">
            {t('label.template')}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-sm">
            {template?.description}
          </Typography>
        </div>
        <Select
          items={patterns.map((pattern) => ({
            id: pattern.patternType,
            label: pattern.displayName,
          }))}
          label={t('label.template')}
          value={values.patternType}
          onChange={selectPattern}>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>

        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          {template?.termRoles.map((role) =>
            isPatternTermKey(role.key) ? (
              <PatternTermFields
                description={role.description}
                displayName={role.displayName}
                key={role.key}
                termKey={role.key}
              />
            ) : null
          )}
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          {metadataFields.slice(0, 2).map((field) => (
            <div key={field.name}>{getField(field)}</div>
          ))}
          <div className="tw:md:col-span-2">{getField(metadataFields[2])}</div>
        </div>
        <Button
          color="primary"
          data-testid="ontology-pattern-submit"
          isDisabled={!template || !isOntologyPatternReady(values, termKeys)}
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

interface PatternTermFieldsProps {
  description: string;
  displayName: string;
  termKey: PatternTermKey;
}

const PatternTermFields = ({
  description,
  displayName,
  termKey,
}: PatternTermFieldsProps) => {
  const { t } = useTranslation();
  const paths = patternTermPaths[termKey];

  return (
    <Card className="tw:flex tw:flex-col tw:gap-3 tw:border tw:border-secondary tw:p-4 tw:ring-0">
      <div>
        <Typography size="text-sm" weight="semibold">
          {displayName}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {description}
        </Typography>
      </div>
      {getField(requiredField(paths.name, t('label.name'), t))}
      {getField(textField(paths.displayName, t('label.display-name')))}
      {getField(
        requiredField(
          paths.description,
          t('label.description'),
          t,
          FieldTypes.TEXTAREA
        )
      )}
    </Card>
  );
};

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

export default OntologyPatternPanel;

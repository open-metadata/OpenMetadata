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
  Box,
  Button,
  FieldProp,
  FormField,
  FormItemLabel,
  getField,
  HookForm,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import { keyBy } from 'lodash';
import { Fragment, ReactNode, useState } from 'react';
import { RegisterOptions, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Layer } from '../../../../generated/api/data/createOntology';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { createOntology, patchOntology } from '../../../../rest/ontologyAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useUserTeamOptions } from '../../../Glossary/hooks/useEntityReferenceOptions';
import {
  ontologyFormFields,
  ontologyFormValues,
  OntologyFormValues,
  ontologyPatch,
  ontologyRequest,
} from './OntologyCreateForm.utils';

const AI_FIELD_ORDER = [
  'displayName',
  'description',
  'owners',
  'reviewers',
  'layer',
  'name',
  'iri',
  'namespace',
];

const SettingsRow = ({
  label,
  required,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  children: ReactNode;
}) => (
  <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:py-3 tw:md:grid-cols-[minmax(10rem,15rem)_minmax(0,1fr)] tw:md:gap-6">
    <FormItemLabel label={label} required={required} />
    <div className="tw:max-w-130 tw:min-w-0">{children}</div>
  </div>
);

const unlabelled = (field: FieldProp): FieldProp => ({
  ...field,
  label: undefined,
  required: false,
  props: {
    ...field.props,
    'aria-label': typeof field.label === 'string' ? field.label : undefined,
  },
});

interface OntologyCreateFormProps {
  canCreate: boolean;
  ontology?: Ontology;
  currentUserId?: string;
  onSaved: (ontology: Ontology) => void;
}

const OntologyCreateForm = ({
  canCreate,
  ontology,
  currentUserId,
  onSaved,
}: OntologyCreateFormProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const owners = useUserTeamOptions();
  const reviewers = useUserTeamOptions();
  const form = useForm<OntologyFormValues>({
    defaultValues: ontologyFormValues(ontology),
  });
  const [isSaving, setIsSaving] = useState(false);
  const save = async (values: OntologyFormValues) => {
    if (!canCreate) {
      return;
    }
    setIsSaving(true);
    try {
      onSaved(
        ontology
          ? await patchOntology(ontology.id, ontologyPatch(ontology, values))
          : await createOntology(ontologyRequest(values, currentUserId))
      );
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderLayer = (field: FieldProp) => (
    <FormField
      control={form.control}
      name="layer"
      rules={field.rules as RegisterOptions<OntologyFormValues, 'layer'>}>
      {({ field: { value, onChange } }) => (
        <Tabs
          className="tw:w-auto"
          isDisabled={field.props?.isDisabled}
          selectedKey={value?.id}
          onSelectionChange={(key) =>
            onChange({ id: key as Layer, label: String(key) })
          }>
          <Tabs.List
            aria-label={t('label.layer')}
            size="sm"
            type="button-border">
            {Object.values(Layer).map((layer) => (
              <Tabs.Item id={layer} key={layer}>
                {layer}
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>
      )}
    </FormField>
  );

  const renderAiForm = () => {
    const fields = keyBy(
      ontologyFormFields(
        t,
        owners,
        reviewers,
        !canCreate || isSaving,
        Boolean(ontology)
      ),
      'name'
    );

    return (
      <HookForm
        data-testid="ontology-create-form"
        form={form}
        onSubmit={form.handleSubmit(save)}>
        <Box direction="col">
          {ontology ? null : (
            <Typography
              as="h2"
              className="not-prose tw:m-0 tw:pb-3"
              size="text-lg"
              weight="semibold">
              {t('label.new-entity', { entity: t('label.ontology') })}
            </Typography>
          )}
          {AI_FIELD_ORDER.map((name) => (
            <SettingsRow
              key={name}
              label={fields[name].label}
              required={fields[name].required}>
              {name === 'layer'
                ? renderLayer(fields[name])
                : getField(unlabelled(fields[name]))}
            </SettingsRow>
          ))}
          <Box
            className="tw:border-t tw:border-secondary tw:pt-4"
            justify="end">
            <Button
              color="primary"
              isDisabled={!canCreate}
              isLoading={isSaving}
              size="sm"
              type="submit">
              {t('label.save')}
            </Button>
          </Box>
        </Box>
      </HookForm>
    );
  };

  if (isAiMode) {
    return renderAiForm();
  }

  return (
    <HookForm
      data-testid="ontology-create-form"
      form={form}
      onSubmit={form.handleSubmit(save)}>
      <Box direction="col" gap={4}>
        {ontologyFormFields(
          t,
          owners,
          reviewers,
          !canCreate || isSaving,
          Boolean(ontology)
        ).map((field) => (
          <Fragment key={field.name}>{getField(field)}</Fragment>
        ))}
        <Button isDisabled={!canCreate} isLoading={isSaving} type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default OntologyCreateForm;

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
  ButtonUtility,
  Dialog,
  FieldProp,
  FormField,
  FormItemLabel,
  getField,
  HookForm,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, Copy01 } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { keyBy } from 'lodash';
import { ReactNode, useState } from 'react';
import { RegisterOptions, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Layer } from '../../../../generated/api/data/createOntology';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { patchOntology } from '../../../../rest/ontologyAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useUserTeamOptions } from '../../../Glossary/hooks/useEntityReferenceOptions';
import OntologyAdvancedToggle from './OntologyAdvancedToggle';
import {
  ontologyFormFields,
  ontologyFormValues,
  OntologyFormValues,
  ontologyPatch,
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

const DIALOG_MAIN_FIELDS = [
  'displayName',
  'description',
  'owners',
  'reviewers',
];
const DIALOG_ADVANCED_FIELDS = ['name', 'iri', 'namespace', 'layer'];

// The settings page's hint under each label and the layer tooltip, as the design shows them.
const ROW_HINTS: Record<string, string> = {
  owners: 'message.ontology-settings-owners-hint',
  reviewers: 'message.ontology-settings-reviewers-hint',
  name: 'message.ontology-settings-name-hint',
  namespace: 'message.ontology-settings-namespace-hint',
};
const ROW_LABELS: Record<string, string> = {
  displayName: 'label.ontology-display-name',
  name: 'label.name-slash-id',
};
const READ_ONLY_FIELDS = new Set(['name', 'iri', 'namespace']);

const SettingsRow = ({
  label,
  hint,
  tooltip,
  children,
}: {
  label: ReactNode;
  hint?: string;
  tooltip?: string;
  children: ReactNode;
}) => (
  <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-2 tw:py-3 tw:md:grid-cols-[minmax(10rem,15rem)_minmax(0,1fr)] tw:md:gap-6">
    <Box className="tw:pt-2" direction="col">
      <FormItemLabel label={label} tooltip={tooltip} />
      {hint ? (
        <Typography color="secondary" size="text-xs">
          {hint}
        </Typography>
      ) : null}
    </Box>
    <div className="tw:max-w-130 tw:min-w-0">{children}</div>
  </div>
);

/** Set at creation: a grey read-only value with a copy button. */
const ReadOnlyField = ({
  label,
  testId,
  value,
}: {
  label: string;
  testId: string;
  value: string;
}) => {
  const { t } = useTranslation();
  const { hasCopied, onCopyToClipBoard } = useClipboard(value);

  return (
    <Box
      align="center"
      aria-label={label}
      className="tw:min-h-10 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:py-1 tw:pr-1 tw:pl-3.5"
      data-testid={testId}
      gap={2}
      role="group">
      <Typography
        className="tw:min-w-0 tw:flex-1 tw:break-all tw:text-primary"
        size="text-sm">
        {value}
      </Typography>
      <ButtonUtility
        color="tertiary"
        icon={hasCopied ? Check : Copy01}
        size="xs"
        tooltip={t(
          hasCopied
            ? 'message.copied-to-clipboard'
            : 'message.copy-to-clipboard'
        )}
        onClick={() => void onCopyToClipBoard(value)}
      />
    </Box>
  );
};

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
  canEdit: boolean;
  ontology: Ontology;
  onSaved: (ontology: Ontology) => void;
  /**
   * `dialog` renders the fields stacked inside `Dialog.Content`, identifiers under a collapsed
   * Advanced section, and Cancel / Save changes in `Dialog.Footer`.
   */
  layout?: 'rows' | 'dialog';
  onCancel?: () => void;
}

const OntologyCreateForm = ({
  canEdit,
  ontology,
  onSaved,
  layout = 'rows',
  onCancel,
}: OntologyCreateFormProps) => {
  const { t } = useTranslation();
  const owners = useUserTeamOptions();
  const reviewers = useUserTeamOptions();
  const form = useForm<OntologyFormValues>({
    defaultValues: ontologyFormValues(ontology),
  });
  const markSaved = useOntologyDirtyForm(form.formState.isDirty);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const save = async (values: OntologyFormValues) => {
    if (!canEdit) {
      return;
    }
    setIsSaving(true);
    try {
      const saved = await patchOntology(
        ontology.id,
        ontologyPatch(ontology, values)
      );
      form.reset(ontologyFormValues(saved));
      markSaved();
      onSaved(saved);
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
          className="tw:w-fit"
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

  const fields = keyBy(
    ontologyFormFields(t, owners, reviewers, !canEdit || isSaving, true),
    'name'
  );

  const renderRowControl = (name: string) => {
    if (name === 'layer') {
      return renderLayer(fields[name]);
    }
    if (READ_ONLY_FIELDS.has(name)) {
      return (
        <ReadOnlyField
          label={String(fields[name].label)}
          testId={`ontology-settings-${name}`}
          value={form.getValues(name as 'name' | 'iri' | 'namespace')}
        />
      );
    }

    // The design's shorter description box; TextArea takes rows though the field props type omits it.
    const shortTextArea = { ...fields[name].props, rows: 3 };

    return getField(
      unlabelled(
        name === 'description'
          ? { ...fields[name], props: shortTextArea }
          : fields[name]
      )
    );
  };

  const renderStacked = (name: string) => (
    <Box direction="col" gap={1} key={name}>
      {name === 'layer' ? (
        <>
          <FormItemLabel
            label={fields[name].label}
            required={fields[name].required}
          />
          {renderLayer(fields[name])}
        </>
      ) : (
        getField(fields[name])
      )}
    </Box>
  );

  if (layout === 'dialog') {
    return (
      <HookForm
        data-testid="ontology-create-form"
        form={form}
        onSubmit={form.handleSubmit(save)}>
        <Dialog.Content>
          {DIALOG_MAIN_FIELDS.map(renderStacked)}
          <OntologyAdvancedToggle
            controls="ontology-settings-advanced"
            isOpen={isAdvancedOpen}
            testId="ontology-settings-advanced-toggle"
            onToggle={() => setIsAdvancedOpen((open) => !open)}
          />
          {isAdvancedOpen ? (
            <Box direction="col" gap={4} id="ontology-settings-advanced">
              {DIALOG_ADVANCED_FIELDS.map(renderStacked)}
            </Box>
          ) : null}
        </Dialog.Content>
        <Dialog.Footer>
          <Button
            color="secondary"
            data-testid="ontology-settings-cancel"
            isDisabled={isSaving}
            onPress={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid="ontology-settings-save"
            isDisabled={!canEdit}
            isLoading={isSaving}
            type="submit">
            {t('label.save-changes')}
          </Button>
        </Dialog.Footer>
      </HookForm>
    );
  }

  return (
    <HookForm
      data-testid="ontology-create-form"
      form={form}
      onSubmit={form.handleSubmit(save)}>
      <Box direction="col">
        {AI_FIELD_ORDER.map((name) => (
          <SettingsRow
            hint={ROW_HINTS[name] ? t(ROW_HINTS[name]) : undefined}
            key={name}
            label={ROW_LABELS[name] ? t(ROW_LABELS[name]) : fields[name].label}
            tooltip={
              name === 'layer' ? t('message.ontology-layer-tooltip') : undefined
            }>
            {renderRowControl(name)}
          </SettingsRow>
        ))}
        <Box className="tw:border-t tw:border-secondary tw:pt-4" justify="end">
          <Button
            color="primary"
            isDisabled={!canEdit}
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

export default OntologyCreateForm;

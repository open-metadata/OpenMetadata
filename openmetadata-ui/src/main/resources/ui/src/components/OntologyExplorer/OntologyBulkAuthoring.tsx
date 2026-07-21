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
  Typography,
} from '@openmetadata/ui-core-components';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { FieldPath, FieldPathValue, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { OntologyBulkJob } from '../../generated/api/data/ontologyBulkJob';
import { OntologyBulkResultArtifact } from '../../generated/api/data/ontologyBulkResultArtifact';
import { ExecutionMode } from '../../generated/api/data/ontologyBulkSubmission';
import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import {
  getOntologyBulkTemplate,
  submitOntologyBulkOperation,
} from '../../rest/ontologyAPI';
import { downloadFile } from '../../utils/Export/ExportUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useOntologyBulkJobs } from './hooks/useOntologyBulkJobs';
import {
  buildOntologyBulkRequest,
  EMPTY_BULK_FORM,
  isOntologyBulkFormReady,
  OntologyBulkFormState,
} from './OntologyBulkAuthoring.utils';
import OntologyBulkJobsPanel from './OntologyBulkJobsPanel';
import OntologyBulkOperationFields from './OntologyBulkOperationFields';
import OntologyBulkResultPanel from './OntologyBulkResultPanel';

interface OntologyBulkAuthoringProps {
  glossary?: Glossary;
  relationshipTypes: RelationshipType[];
}

const OntologyBulkAuthoring = ({
  glossary,
  relationshipTypes,
}: OntologyBulkAuthoringProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hookForm = useForm<OntologyBulkFormState>({
    defaultValues: EMPTY_BULK_FORM,
  });
  const form = hookForm.watch();
  const [result, setResult] = useState<OntologyBulkResultArtifact>();
  const [resultJobId, setResultJobId] = useState<number>();
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const {
    cancelJob,
    hasLoadError,
    isCancelling,
    isLoading,
    jobs,
    refreshJobs,
  } = useOntologyBulkJobs(glossary?.id);

  useEffect(() => {
    const glossaryName = glossary?.displayName ?? glossary?.name;

    setResult(undefined);
    setResultJobId(undefined);
    hookForm.reset({
      ...EMPTY_BULK_FORM,
      changeSetDescription: glossary
        ? t('message.bulk-edit-entity-help', {
            entity: t('label.term-plural'),
          })
        : '',
      changeSetDisplayName: glossary
        ? `${t('label.bulk-edit')}: ${glossaryName}`
        : '',
      changeSetName: glossary ? `ontology-bulk-${glossary.name}` : '',
    });
  }, [glossary?.id, glossary?.name, glossary?.displayName, hookForm, t]);

  const updateForm = <Field extends FieldPath<OntologyBulkFormState>>(
    field: Field,
    value: FieldPathValue<OntologyBulkFormState, Field>
  ) => {
    hookForm.setValue(field, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setResult(undefined);
    setResultJobId(undefined);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      updateForm('csv', await file.text());
      event.target.value = '';
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const template = await getOntologyBulkTemplate();
      downloadFile(template.csv, template.fileName, template.mediaType);
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleSubmit = async (values: OntologyBulkFormState) => {
    if (glossary) {
      try {
        const submission = await submitOntologyBulkOperation(
          buildOntologyBulkRequest(glossary.id, values)
        );
        setResult(submission.result);
        setResultJobId(submission.job?.id);
        if (submission.executionMode === ExecutionMode.Background) {
          await refreshJobs();
          showSuccessToast(t('label.queued'));
        } else {
          showSuccessToast(
            values.dryRun
              ? t('message.ontology-pack-dry-run-success')
              : t('label.draft-created')
          );
        }
      } catch {
        showErrorToast(t('server.unexpected-error'));
      }
    }
  };

  const handleCancel = async (jobId: number) => {
    try {
      await cancelJob(jobId);
      showSuccessToast(t('label.cancelled'));
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  };

  const handleViewResult = (job: OntologyBulkJob) => {
    setResult(job.result);
    setResultJobId(job.id);
  };
  const requiredRule = (label: string) => ({
    required: t('label.field-required', { field: label }),
  });
  const metadataFields: FieldProp[] = [
    {
      label: t('label.change-set-name'),
      name: 'changeSetName',
      required: true,
      rules: requiredRule(t('label.change-set-name')),
      type: FieldTypes.TEXT,
    },
    {
      label: t('label.display-name'),
      name: 'changeSetDisplayName',
      type: FieldTypes.TEXT,
    },
    {
      label: t('label.draft-description'),
      name: 'changeSetDescription',
      required: true,
      rules: requiredRule(t('label.draft-description')),
      type: FieldTypes.TEXTAREA,
    },
  ];

  return !glossary ? (
    <div className="tw:w-full tw:p-6">
      <Alert
        title={t('label.select-entity', { entity: t('label.glossary') })}
        variant="gray"
      />
    </div>
  ) : (
    <div
      className="tw:h-full tw:w-full tw:overflow-auto tw:bg-secondary tw:p-6"
      data-testid="ontology-bulk-authoring">
      <div className="tw:mx-auto tw:flex tw:max-w-5xl tw:flex-col tw:gap-5">
        <div>
          <Typography as="h2" size="display-xs" weight="semibold">
            {t('label.bulk-edit')}
          </Typography>
          <Typography
            as="p"
            className="tw:mt-1 tw:text-tertiary"
            size="text-sm">
            {t('message.bulk-edit-entity-help', {
              entity: t('label.term-plural'),
            })}
          </Typography>
        </div>

        <HookForm
          form={hookForm}
          onSubmit={hookForm.handleSubmit(handleSubmit)}>
          <Card className="tw:flex tw:flex-col tw:gap-5 tw:border tw:border-secondary tw:p-5 tw:ring-0">
            <OntologyBulkOperationFields
              fileInputRef={fileInputRef}
              form={form}
              isDownloadingTemplate={isDownloadingTemplate}
              relationshipTypes={relationshipTypes}
              onDownloadTemplate={() => void handleDownloadTemplate()}
              onFileChange={(event) => void handleFileChange(event)}
              onUpdate={updateForm}
            />

            <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-2">
              {metadataFields.slice(0, 2).map((field) => (
                <div key={field.name}>{getField(field)}</div>
              ))}
              <div className="tw:lg:col-span-2">
                {getField(metadataFields[2])}
              </div>
            </div>

            <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:pt-4">
              <Checkbox
                isSelected={form.dryRun}
                label={t('label.dry-run')}
                onChange={(isSelected) => updateForm('dryRun', isSelected)}
              />
              <Button
                color="primary"
                data-testid="ontology-bulk-submit"
                isDisabled={!isOntologyBulkFormReady(glossary.id, form)}
                isLoading={hookForm.formState.isSubmitting}
                type="submit">
                {form.dryRun ? t('label.preview') : t('label.create-draft')}
              </Button>
            </div>
          </Card>
        </HookForm>

        {result ? (
          <OntologyBulkResultPanel jobId={resultJobId} result={result} />
        ) : null}

        <OntologyBulkJobsPanel
          hasLoadError={hasLoadError}
          isCancelling={isCancelling}
          isLoading={isLoading}
          jobs={jobs}
          onCancel={(jobId) => void handleCancel(jobId)}
          onRefresh={() => void refreshJobs()}
          onViewResult={handleViewResult}
        />
      </div>
    </div>
  );
};

export default OntologyBulkAuthoring;

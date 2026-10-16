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
  FieldTypes,
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { OntologyIRIPreview } from '../../generated/api/data/ontologyIriPreview';
import { Glossary } from '../../generated/entity/data/glossary';
import { previewOntologyIri } from '../../rest/ontologyAPI';
import { showErrorToast } from '../../utils/ToastUtils';

interface OntologyIriPreviewPanelProps {
  glossary: Glossary;
}

interface IriPreviewForm {
  termName: string;
}

const OntologyIriPreviewPanel = ({
  glossary,
}: OntologyIriPreviewPanelProps) => {
  const { t } = useTranslation();
  const form = useForm<IriPreviewForm>({ defaultValues: { termName: '' } });
  const [preview, setPreview] = useState<OntologyIRIPreview>();

  useEffect(() => {
    form.reset({ termName: '' });
    setPreview(undefined);
  }, [form, glossary.id]);

  const submit = async (values: IriPreviewForm) => {
    try {
      setPreview(
        await previewOntologyIri({
          glossaryId: glossary.id,
          termName: values.termName.trim(),
        })
      );
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  };

  return (
    <HookForm form={form} onSubmit={form.handleSubmit(submit)}>
      <Card className="tw:flex tw:flex-col tw:gap-4 tw:border tw:border-secondary tw:p-5">
        <div>
          <Typography as="h3" size="text-lg" weight="semibold">
            {t('label.concept-iri')}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-sm">
            {glossary.ontologyConfiguration?.baseIri}
          </Typography>
        </div>
        {getField({
          label: t('label.term'),
          name: 'termName',
          required: true,
          rules: {
            required: t('label.field-required', { field: t('label.term') }),
          },
          type: FieldTypes.TEXT,
        })}
        <Button
          color="primary"
          data-testid="ontology-iri-preview-submit"
          isLoading={form.formState.isSubmitting}
          type="submit">
          {t('label.preview')}
        </Button>
        {preview ? (
          <Alert
            title={`${t('label.preview')}: ${preview.termSegment}`}
            variant="success">
            {preview.iri}
          </Alert>
        ) : null}
      </Card>
    </HookForm>
  );
};

export default OntologyIriPreviewPanel;

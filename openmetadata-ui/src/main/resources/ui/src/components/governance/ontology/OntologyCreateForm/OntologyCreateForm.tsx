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
  getField,
  HookForm,
} from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Layer } from '../../../../generated/api/data/createOntology';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { createOntology } from '../../../../rest/ontologyAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useUserTeamOptions } from '../../../Glossary/hooks/useEntityReferenceOptions';
import {
  ontologyFormFields,
  OntologyFormValues,
  ontologyRequest,
} from './OntologyCreateForm.utils';

interface OntologyCreateFormProps {
  canCreate: boolean;
  currentUserId?: string;
  onSaved: (ontology: Ontology) => void;
}

const OntologyCreateForm = ({
  canCreate,
  currentUserId,
  onSaved,
}: OntologyCreateFormProps) => {
  const { t } = useTranslation();
  const owners = useUserTeamOptions();
  const reviewers = useUserTeamOptions();
  const form = useForm<OntologyFormValues>({
    defaultValues: {
      name: '',
      displayName: '',
      description: '',
      iri: '',
      namespace: '',
      layer: { id: Layer.L1, label: Layer.L1 },
      owners: [],
      reviewers: [],
    },
  });
  const [isSaving, setIsSaving] = useState(false);
  const save = async (values: OntologyFormValues) => {
    if (!canCreate) {
      return;
    }
    setIsSaving(true);
    try {
      onSaved(await createOntology(ontologyRequest(values, currentUserId)));
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <HookForm
      data-testid="ontology-create-form"
      form={form}
      onSubmit={form.handleSubmit(save)}>
      <Box direction="col" gap={4}>
        {ontologyFormFields(t, owners, reviewers, !canCreate || isSaving).map(
          (field) => (
            <Fragment key={field.name}>{getField(field)}</Fragment>
          )
        )}
        <Button isDisabled={!canCreate} isLoading={isSaving} type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default OntologyCreateForm;

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

/* eslint-disable openmetadata-imports/no-lower-layer-page-imports -- shared settings widget reused here */
import { Box, Button } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RelationshipType } from '../../../../../../generated/entity/data/relationshipType';
import RelationshipTypeForm from '../../../../../../pages/GlossaryTermRelationSettings/RelationshipTypeForm';
import {
  DEFAULT_RELATIONSHIP_TYPE_FORM,
  RelationshipTypeFormValues,
  toRelationshipTypeForm,
  toRelationshipTypeRequest,
} from '../../../../../../pages/GlossaryTermRelationSettings/RelationshipTypeForm.utils';
import { validateRelationshipTypeForm } from '../../../../../../pages/GlossaryTermRelationSettings/RelationshipTypeForm.validation';
import {
  createRelationshipType,
  getRelationshipTypeByName,
  updateRelationshipType,
} from '../../../../../../rest/ontologyAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { GovernanceView } from './Governance.types';

interface GovernanceGlossaryFormPageProps {
  /** Defined when editing an existing relationship type (its name). Undefined means create. */
  editName?: string;
  onNavigate: (view: GovernanceView) => void;
}

const RELATION_TYPE_ENTITY = 'label.relation-type';
const VIEW_GLOSSARY_LIST = 'glossary-list' as const;

const GovernanceGlossaryFormPage: FC<GovernanceGlossaryFormPageProps> = ({
  editName,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const isEditing = Boolean(editName);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [existing, setExisting] = useState<RelationshipType | undefined>();
  const [formValues, setFormValues] = useState<RelationshipTypeFormValues>(
    DEFAULT_RELATIONSHIP_TYPE_FORM
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!editName) {
      return;
    }
    setIsLoadingExisting(true);
    getRelationshipTypeByName(editName)
      .then((item) => {
        setExisting(item);
        setFormValues(toRelationshipTypeForm(item));
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', { entity: t(RELATION_TYPE_ENTITY) })
        );
        onNavigate({ type: VIEW_GLOSSARY_LIST });
      })
      .finally(() => setIsLoadingExisting(false));
  }, [editName, t, onNavigate]);

  const handleSave = useCallback(async () => {
    const errors = validateRelationshipTypeForm(formValues, existing, [], t);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSaving(true);
    try {
      const request = toRelationshipTypeRequest(formValues);

      if (existing) {
        await updateRelationshipType(request);
      } else {
        await createRelationshipType(request);
      }
      showSuccessToast(
        t(
          existing
            ? 'server.update-entity-success'
            : 'server.create-entity-success',
          { entity: t(RELATION_TYPE_ENTITY) }
        )
      );
      onNavigate({ type: VIEW_GLOSSARY_LIST });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.update-entity-error', { entity: t(RELATION_TYPE_ENTITY) })
      );
    } finally {
      setIsSaving(false);
    }
  }, [existing, formValues, t, onNavigate]);

  if (isLoadingExisting) {
    return (
      <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:p-8 tw:text-sm tw:text-tertiary">
        {t('label.loading')}
      </div>
    );
  }

  return (
    <Box
      className="tw:h-full tw:overflow-hidden"
      data-testid="glossary-form-page"
      direction="col">
      <div className="tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0">
        <div className="tw:w-[50%]">
          <RelationshipTypeForm
            errors={formErrors}
            isEditing={isEditing}
            values={formValues}
            onChange={(values) => {
              setFormValues(values);
              setFormErrors({});
            }}
          />
        </div>
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface tw:px-8 tw:py-4 tw:shadow-sm"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="glossary-form-cancel"
          isDisabled={isSaving}
          type="button"
          onPress={() => onNavigate({ type: VIEW_GLOSSARY_LIST })}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="glossary-form-save"
          isLoading={isSaving}
          type="button"
          onPress={handleSave}>
          {isEditing ? t('label.update') : t('label.add')}
        </Button>
      </Box>
    </Box>
  );
};

export default GovernanceGlossaryFormPage;

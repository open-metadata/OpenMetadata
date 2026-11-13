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
  Box,
  Button,
  Dialog,
  FieldTypes,
  getField,
  HookForm,
  Input,
  Modal,
  ModalOverlay,
  Tabs,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { Layer } from '../../../../generated/api/data/createOntology';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  useOntologyDirtyForm,
  useOntologyDraftGuard,
} from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { createOntology } from '../../../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../../../rest/rdfAPI';
import { getEntityReferenceFromEntity } from '../../../../utils/EntityReferenceUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { EntityReferenceOption } from '../../../Glossary/AddGlossary/AddGlossary.interface';
import { toEntityReferenceOption } from '../../../Glossary/AddGlossary/AddGlossary.utils';
import { useUserTeamOptions } from '../../../Glossary/hooks/useEntityReferenceOptions';
import OntologyAdvancedToggle from '../OntologyCreateForm/OntologyAdvancedToggle';
import {
  newOntologyRequest,
  ontologyCreateErrorKey,
  ONTOLOGY_NAME_MAX_LENGTH,
  resolveOntologyDraft,
} from '../OntologyCreateForm/OntologyCreateForm.utils';

const RDF_STATUS_QUERY_KEY = 'ontology-rdf-status';

interface OntologyCreateDialogProps {
  readonly ontologies: readonly Ontology[] | undefined;
  readonly onClose: () => void;
  readonly onCreated: (ontology: Ontology) => void;
}

interface PeopleValues {
  owners: EntityReferenceOption[];
  reviewers: EntityReferenceOption[];
}

const ownerOption = (
  user: NonNullable<
    ReturnType<typeof useApplicationStore.getState>['currentUser']
  >,
  youLabel: string
): EntityReferenceOption => ({
  ...toEntityReferenceOption(
    getEntityReferenceFromEntity(user, EntityType.USER)
  ),
  label: `${user.displayName ?? user.name ?? ''} (${youLabel})`,
});

const OntologyCreateDialog = ({
  ontologies,
  onClose,
  onCreated,
}: OntologyCreateDialogProps) => {
  const { t } = useTranslation();
  const currentUser = useApplicationStore((store) => store.currentUser);
  const ownerPicker = useUserTeamOptions();
  const reviewerPicker = useUserTeamOptions();
  const people = useForm<PeopleValues>({
    defaultValues: {
      owners: currentUser ? [ownerOption(currentUser, t('label.you'))] : [],
      reviewers: [],
    },
  });
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [idOverride, setIdOverride] = useState<string>();
  const [iriOverride, setIriOverride] = useState<string>();
  const [namespaceOverride, setNamespaceOverride] = useState<string>();
  const [layer, setLayer] = useState<Layer>(Layer.L3);
  const [isSaving, setIsSaving] = useState(false);
  const guard = useOntologyDraftGuard();
  const markSaved = useOntologyDirtyForm(
    [displayName, description, idOverride, iriOverride, namespaceOverride].some(
      Boolean
    ) || people.formState.isDirty
  );
  const status = useQuery({
    queryKey: [RDF_STATUS_QUERY_KEY],
    queryFn: fetchRdfConfig,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const baseUri = status.data?.baseUri ?? '';
  const {
    id,
    iri,
    namespace,
    nameError,
    isIriInvalid,
    isNamespaceInvalid,
    isNamespaceTaken,
    isSubmittable,
  } = resolveOntologyDraft({
    displayName,
    idOverride,
    iriOverride,
    namespaceOverride,
    baseUri,
    ontologies,
  });
  const isNamespaceEdited = namespaceOverride !== undefined;

  const nameMessage = () => {
    switch (nameError?.kind) {
      case 'forbidden-character':
        return t('message.ontology-name-forbidden-character');
      case 'too-long':
        return t('message.ontology-name-too-long', {
          max: ONTOLOGY_NAME_MAX_LENGTH,
          count: nameError.length,
        });
      case 'id-required':
        return t('message.ontology-name-id-required');
      case 'duplicate':
        return t('message.ontology-name-duplicate', { name: nameError.name });
      default:
        return ontologies
          ? undefined
          : t('message.ontology-prefix-check-unavailable');
    }
  };

  const canCreate = isSubmittable && !isSaving;

  const namespaceHint = () => {
    if (isNamespaceTaken) {
      return t('message.ontology-namespace-in-use');
    }

    return isNamespaceInvalid && isNamespaceEdited
      ? t('message.invalid-concept-iri')
      : undefined;
  };

  const handleClose = () => {
    if (!isSaving) {
      guard(onClose);
    }
  };

  const handleCreate = async () => {
    if (!canCreate) {
      return;
    }
    setIsSaving(true);
    const { owners, reviewers } = people.getValues();
    try {
      const saved = await createOntology(
        newOntologyRequest({
          id,
          displayName: displayName.trim(),
          description,
          iri,
          namespace,
          layer,
          owners,
          reviewers,
        })
      );
      markSaved();
      onCreated(saved);
    } catch (error) {
      const known = ontologyCreateErrorKey(error);
      showErrorToast(
        known
          ? t(`message.ontology-name-${known}`, {
              name: displayName.trim(),
              max: ONTOLOGY_NAME_MAX_LENGTH,
              count: displayName.trim().length,
            })
          : t('server.unexpected-error')
      );
      setIsSaving(false);
    }
  };

  const renderPeople = () => (
    <HookForm form={people} onSubmit={(event) => event.preventDefault()}>
      <Box direction="col" gap={4}>
        {getField({
          name: 'owners',
          label: t('label.owner-plural'),
          type: FieldTypes.USER_TEAM_SELECT_INPUT,
          props: {
            ...ownerPicker,
            multiple: true,
            filterOption: () => true,
            isDisabled: isSaving,
          },
        })}
        {getField({
          name: 'reviewers',
          label: t('label.reviewer-plural'),
          helperText: t('message.ontology-reviewers-create-hint'),
          type: FieldTypes.USER_TEAM_SELECT_INPUT,
          props: {
            ...reviewerPicker,
            multiple: true,
            filterOption: () => true,
            isDisabled: isSaving,
          },
        })}
      </Box>
    </HookForm>
  );

  const renderAdvanced = () => (
    <Box direction="col" gap={4} id="ontology-create-advanced">
      <Input
        inputDataTestId="ontology-create-id"
        label={t('label.name-slash-id')}
        size="sm"
        value={id}
        onChange={setIdOverride}
      />
      <Input
        hint={isIriInvalid ? t('message.invalid-concept-iri') : undefined}
        inputDataTestId="ontology-create-iri"
        isInvalid={isIriInvalid}
        label={t('label.ontology-iri')}
        size="sm"
        value={iri}
        onChange={setIriOverride}
      />
      <Input
        hint={namespaceHint() ?? t('message.ontology-identifiers-locked')}
        inputDataTestId="ontology-create-namespace"
        isInvalid={Boolean(namespaceHint())}
        label={t('label.namespace')}
        size="sm"
        value={namespace}
        onChange={setNamespaceOverride}
      />
      <Box direction="col" gap={1}>
        <Typography size="text-sm" weight="medium">
          {t('label.layer')}
        </Typography>
        <Tabs
          className="tw:w-auto"
          selectedKey={layer}
          onSelectionChange={(key) => setLayer(key as Layer)}>
          <Tabs.List
            aria-label={t('label.layer')}
            size="sm"
            type="button-border">
            {Object.values(Layer).map((value) => (
              <Tabs.Item id={value} key={value}>
                {value}
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>
      </Box>
    </Box>
  );

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isSaving}
      isKeyboardDismissDisabled={isSaving}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}>
      <Modal>
        <Dialog
          showCloseButton
          dividers="scroll"
          width={520}
          onClose={handleClose}>
          <Dialog.Header className="tw:pr-12" title={t('label.new-ontology')}>
            <Typography color="secondary" size="text-sm">
              {t('message.ontology-create-subtitle')}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <Box data-testid="ontology-create-dialog" direction="col" gap={4}>
              <Input
                isRequired
                hint={nameMessage()}
                inputDataTestId="ontology-create-name"
                isInvalid={Boolean(nameError)}
                label={t('label.ontology-display-name')}
                placeholder={t('message.ontology-create-name-placeholder')}
                size="sm"
                value={displayName}
                onChange={setDisplayName}
              />
              <TextArea
                data-testid="ontology-create-description"
                label={t('label.description')}
                placeholder={t(
                  'message.ontology-create-description-placeholder'
                )}
                size="sm"
                value={description}
                onChange={setDescription}
              />
              {renderPeople()}
              {status.isError ? (
                <Alert
                  rightContent={
                    <Button
                      color="secondary"
                      size="xs"
                      onPress={() => void status.refetch()}>
                      {t('label.retry')}
                    </Button>
                  }
                  variant="error">
                  {t('message.ontology-base-uri-load-failed')}
                </Alert>
              ) : null}
              <OntologyAdvancedToggle
                controls="ontology-create-advanced"
                isOpen={isAdvancedOpen}
                testId="ontology-create-advanced-toggle"
                onToggle={() => setIsAdvancedOpen((open) => !open)}
              />
              {isAdvancedOpen ? renderAdvanced() : null}
            </Box>
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="ontology-create-cancel"
              isDisabled={isSaving}
              onPress={handleClose}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="ontology-create-submit"
              isDisabled={!canCreate}
              isLoading={isSaving}
              onPress={() => void handleCreate()}>
              {t('label.create-ontology')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyCreateDialog;

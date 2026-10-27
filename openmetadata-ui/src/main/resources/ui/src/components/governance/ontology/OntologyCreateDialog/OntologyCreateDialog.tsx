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
  Input,
  Modal,
  ModalOverlay,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { createOntology } from '../../../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../../../rest/rdfAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  derivePrefix,
  isValidPrefix,
  newOntologyRequest,
  ontologyIris,
} from '../OntologyCreateForm/OntologyCreateForm.utils';

const RDF_STATUS_QUERY_KEY = 'ontology-rdf-status';

interface OntologyCreateDialogProps {
  readonly ontologies: readonly Ontology[];
  readonly onClose: () => void;
  readonly onCreated: (ontology: Ontology) => void;
}

const OntologyCreateDialog = ({
  ontologies,
  onClose,
  onCreated,
}: OntologyCreateDialogProps) => {
  const { t } = useTranslation();
  const currentUserId = useApplicationStore((store) => store.currentUser?.id);
  const [name, setName] = useState('');
  const [prefixOverride, setPrefixOverride] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const status = useQuery({
    queryKey: [RDF_STATUS_QUERY_KEY],
    queryFn: fetchRdfConfig,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const baseUri = status.data?.baseUri ?? '';
  const prefix = prefixOverride.trim() || derivePrefix(name);
  const isPrefixValid = isValidPrefix(prefix);
  const preview = baseUri ? ontologyIris(baseUri, prefix).namespace : '';
  const isPrefixTaken =
    isPrefixValid && ontologies.some(({ namespace }) => namespace === preview);
  const canCreate =
    Boolean(name.trim()) &&
    isPrefixValid &&
    !isPrefixTaken &&
    Boolean(baseUri) &&
    !isSaving;

  const getPrefixHint = () => {
    if (!isPrefixValid) {
      return t('message.invalid-ontology-prefix');
    }

    return isPrefixTaken ? t('message.ontology-prefix-in-use') : undefined;
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  const handleCreate = async () => {
    if (!canCreate) {
      return;
    }
    setIsSaving(true);
    try {
      onCreated(
        await createOntology(
          newOntologyRequest(
            { name: name.trim(), description, baseUri, prefix },
            currentUserId
          )
        )
      );
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
      setIsSaving(false);
    }
  };

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
          dividers="scroll"
          title={t('label.create-entity', { entity: t('label.ontology') })}
          width={480}
          onClose={handleClose}>
          <Dialog.Content>
            <Box data-testid="ontology-create-dialog" direction="col" gap={4}>
              <Input
                isRequired
                inputDataTestId="ontology-create-name"
                label={t('label.name')}
                placeholder={t('message.ontology-create-name-placeholder')}
                size="sm"
                value={name}
                onChange={setName}
              />
              <Input
                hint={getPrefixHint()}
                inputDataTestId="ontology-create-prefix"
                isInvalid={!isPrefixValid || isPrefixTaken}
                label={t('label.namespace-prefix')}
                placeholder={derivePrefix(name)}
                size="sm"
                value={prefixOverride}
                onChange={setPrefixOverride}
              />
              {status.isError ? (
                <Alert variant="error">
                  {t('message.ontology-base-uri-load-failed')}
                  <Button
                    color="secondary"
                    size="xs"
                    onPress={() => void status.refetch()}>
                    {t('label.retry')}
                  </Button>
                </Alert>
              ) : (
                <Typography
                  color="secondary"
                  data-testid="ontology-create-iri-preview"
                  size="text-xs">
                  {preview}
                </Typography>
              )}
              <TextArea
                data-testid="ontology-create-description"
                label={t('label.description')}
                size="sm"
                value={description}
                onChange={setDescription}
              />
            </Box>
          </Dialog.Content>
          <Dialog.Footer>
            <Typography className="tw:mr-auto" color="secondary" size="text-xs">
              {t('message.ontology-create-lands-in-edit')}
            </Typography>
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
              {t('label.create')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyCreateDialog;

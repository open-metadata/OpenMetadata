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
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology, Stage } from '../../../../generated/entity/data/ontology';
import {
  deleteOntology,
  listOntologyConcepts,
  listOntologyReleases,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';

interface OntologyDeleteDialogProps {
  readonly ontology: Ontology;
  readonly onClose: () => void;
  readonly onDeleted: (ontology: Ontology) => void;
}

const OntologyDeleteDialog = ({
  ontology,
  onClose,
  onDeleted,
}: OntologyDeleteDialogProps) => {
  const { t } = useTranslation();
  const name = getEntityName(ontology);
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const isInReview =
    ontology.publicationStatus?.latest?.stage === Stage.InReview;
  const counts = useQuery({
    queryKey: ['ontology-delete-counts', ontology.id],
    queryFn: async () => {
      const [concepts, releases] = await Promise.all([
        listOntologyConcepts({
          limit: 1,
          ontology: ontology.fullyQualifiedName,
        }),
        listOntologyReleases(ontology.id, { limit: 1 }),
      ]);

      return {
        concepts: concepts.paging.total,
        releases: releases.paging.total,
      };
    },
    retry: false,
    gcTime: 0,
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOntology(ontology.id);
      onDeleted(ontology);
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
      setIsDeleting(false);
    }
  };

  const renderCounts = () => {
    if (counts.isError) {
      return (
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-delete-counts-unavailable')}
        </Typography>
      );
    }

    return (
      <ul
        className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-1 tw:p-0 tw:text-sm"
        data-testid="ontology-delete-counts">
        {counts.data ? (
          <>
            <li>{`${t('label.concept-plural')}: ${counts.data.concepts}`}</li>
            <li>{`${t('label.release-plural')}: ${counts.data.releases}`}</li>
          </>
        ) : (
          <li>
            <Loader size="x-small" />
          </li>
        )}
      </ul>
    );
  };

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isDeleting}
      isKeyboardDismissDisabled={isDeleting}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isDeleting) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog
          dividers="scroll"
          title={t('label.delete-entity', {
            entity: t('label.ontology').toLocaleLowerCase(),
          })}
          width={480}
          onClose={onClose}>
          <Dialog.Content>
            <Box data-testid="ontology-delete-dialog" direction="col" gap={4}>
              <Typography size="text-sm">
                {t('message.ontology-delete-removes', { name })}
              </Typography>
              {isInReview ? (
                <Alert
                  data-testid="ontology-delete-withdraws-review"
                  variant="warning">
                  {t('message.ontology-delete-withdraws-review')}
                </Alert>
              ) : null}
              {renderCounts()}
              <Input
                isRequired
                hint={t('message.ontology-delete-type-name', { name })}
                inputDataTestId="ontology-delete-confirm-name"
                label={t('label.name')}
                size="sm"
                value={typedName}
                onChange={setTypedName}
              />
            </Box>
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="ontology-delete-cancel"
              isDisabled={isDeleting}
              onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="ontology-delete-confirm"
              isDisabled={typedName !== name}
              isLoading={isDeleting}
              onPress={() => void handleDelete()}>
              {t('label.delete')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyDeleteDialog;

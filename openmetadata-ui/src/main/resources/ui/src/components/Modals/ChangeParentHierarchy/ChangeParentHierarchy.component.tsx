/*
 *  Copyright 2024 Collate.
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
  Checkbox,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SOCKET_EVENTS } from '../../../constants/constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import { EntityType } from '../../../enums/entity.enum';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { moveGlossaryTerm } from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { EntityStatusClass } from '../../../utils/EntityStatusUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { GlossaryPickerValue } from '../../common/GlossaryTermPicker/GlossaryTagSuggestionUtils';
import GlossaryTermPicker from '../../common/GlossaryTermPicker/GlossaryTermPicker';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import {
  ChangeParentHierarchyProps,
  MoveGlossaryTermWebsocketResponse,
} from './ChangeParentHierarchy.interface';

const MAX_BUFFERED_EVENTS = 100;

const MoveJobStatus = ({
  moveJob,
}: {
  moveJob?: MoveGlossaryTermWebsocketResponse;
}) => {
  if (!moveJob?.jobId) {
    return null;
  }

  return (
    <Alert variant={moveJob.error ? 'error' : 'success'}>
      {moveJob.error ?? moveJob.message}
    </Alert>
  );
};

const ChangeParentHierarchy = ({
  selectedData,
  onCancel,
}: ChangeParentHierarchyProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { socket } = useWebSocketConnector();
  const [loadingState, setLoadingState] = useState({
    isSaving: false,
  });
  const [confirmCheckboxChecked, setConfirmCheckboxChecked] = useState(false);
  const [selectedParent, setSelectedParent] =
    useState<GlossaryPickerValue | null>(null);
  const [moveJob, setMoveJob] = useState<MoveGlossaryTermWebsocketResponse>();
  const submittedJobId = useRef<string>();
  const awaitingResponse = useRef(false);
  const bufferedEvents = useRef(
    new Map<string, MoveGlossaryTermWebsocketResponse>()
  );

  const hasReviewers = Boolean(
    selectedData.reviewers && selectedData.reviewers.length > 0
  );

  const handleParentSelection = (options: GlossaryPickerValue[]) => {
    setSelectedParent(options[0] ?? null);
  };

  const handleMoveSuccess = useCallback(
    (response: MoveGlossaryTermWebsocketResponse) => {
      setLoadingState((prev) => ({ ...prev, isSaving: false }));
      setMoveJob(undefined);

      // Redirect to the new fully qualified name path if available
      if (response.fullyQualifiedName) {
        const glossaryPath = getGlossaryPath(response.fullyQualifiedName);
        navigate(glossaryPath);
      } else {
        onCancel();
      }
    },
    [onCancel, navigate]
  );

  const handleMoveJobUpdate = useCallback(
    (response: MoveGlossaryTermWebsocketResponse) => {
      setMoveJob(response);

      if (response.status === 'COMPLETED') {
        handleMoveSuccess(response);
      } else if (response.status === 'FAILED') {
        showErrorToast(response.error ?? t('label.failed'));
        setLoadingState((prev) => ({ ...prev, isSaving: false }));
      }
    },
    [handleMoveSuccess]
  );

  const handleSubmit = async () => {
    if (!selectedParent?.entity) {
      return;
    }

    try {
      setLoadingState((prev) => ({ ...prev, isSaving: true }));
      awaitingResponse.current = true;
      const parent = selectedParent.entity;
      const response = await moveGlossaryTerm(selectedData.id, {
        id: parent.id,
        type: (parent as GlossaryTerm).glossary
          ? EntityType.GLOSSARY_TERM
          : EntityType.GLOSSARY,
        fullyQualifiedName: parent.fullyQualifiedName,
      });

      submittedJobId.current = response.jobId;
      awaitingResponse.current = false;

      const early = bufferedEvents.current.get(response.jobId);
      bufferedEvents.current.clear();
      if (early) {
        handleMoveJobUpdate(early);

        return;
      }

      const jobData: MoveGlossaryTermWebsocketResponse = {
        jobId: response.jobId,
        message: response.message,
        status: 'COMPLETED',
      };

      setMoveJob(jobData);
    } catch (error) {
      awaitingResponse.current = false;
      showErrorToast(error as AxiosError);
      setLoadingState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.MOVE_GLOSSARY_TERM_CHANNEL, (moveResponse) => {
        if (moveResponse) {
          const data: MoveGlossaryTermWebsocketResponse =
            JSON.parse(moveResponse);

          if (submittedJobId.current && data.jobId === submittedJobId.current) {
            handleMoveJobUpdate(data);
          } else if (
            awaitingResponse.current &&
            data.jobId &&
            bufferedEvents.current.size < MAX_BUFFERED_EVENTS
          ) {
            bufferedEvents.current.set(data.jobId, data);
          }
        }
      });
    }

    return () => {
      if (socket) {
        socket.off(SOCKET_EVENTS.MOVE_GLOSSARY_TERM_CHANNEL);
      }
    };
  }, [socket, handleMoveJobUpdate]);

  // Save stays disabled until a parent is picked, standing in for the old
  // required-field rule.
  const isSaveDisabled =
    !selectedParent || (hasReviewers && !confirmCheckboxChecked);

  return (
    <ModalOverlay
      isOpen
      isDismissable={false}
      // The library overlay is `tw:z-50`, which loses to antd overlays
      // (z-index 1000) still present on the glossary page.
      style={{ zIndex: 'var(--om-z-modal)' }}>
      <Modal>
        <Dialog
          aria-label={t('label.change-entity', { entity: t('label.parent') })}
          data-testid="change-parent-hierarchy-modal"
          width={520}>
          <Dialog.Header>
            <Typography
              as="h3"
              className="tw:text-primary"
              size="text-md"
              weight="semibold">
              {t('label.change-entity', { entity: t('label.parent') })}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <MoveJobStatus moveJob={moveJob} />
            <GlossaryTermPicker
              required
              selectGlossaries
              data-testid="change-parent-select"
              // A term cannot be moved under itself.
              excludeFqns={[selectedData.fullyQualifiedName ?? '']}
              label={t('label.select-field', { field: t('label.parent') })}
              multiple={false}
              placeholder={t('label.select-field', {
                field: t('label.parent'),
              })}
              value={selectedParent ? [selectedParent] : []}
              onChange={(_terms, nodes) => handleParentSelection(nodes)}
            />

            {hasReviewers && (
              <Checkbox
                data-testid="confirm-status-checkbox"
                isSelected={confirmCheckboxChecked}
                label={
                  <span>
                    <Transi18next
                      i18nKey="message.entity-transfer-confirmation-message"
                      renderElement={<strong />}
                      values={{
                        from: getEntityName(selectedData),
                      }}
                    />
                    <span className="tw:ml-1 tw:inline-block">
                      <StatusBadge
                        className="p-x-xs p-y-xss"
                        dataTestId=""
                        label={EntityStatus.InReview}
                        status={EntityStatusClass[EntityStatus.InReview]}
                      />
                    </span>
                  </span>
                }
                onChange={setConfirmCheckboxChecked}
              />
            )}
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" size="md" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save-button"
              isDisabled={isSaveDisabled}
              isLoading={loadingState.isSaving}
              size="md"
              onClick={handleSubmit}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ChangeParentHierarchy;

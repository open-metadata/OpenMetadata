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

import { Checkbox, Form, Modal } from 'antd';
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
import Banner from '../../common/Banner/Banner';
import { GlossaryPickerValue } from '../../common/GlossaryTermPicker/GlossaryTagSuggestionUtils';
import GlossaryTermPicker from '../../common/GlossaryTermPicker/GlossaryTermPicker';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import {
  ChangeParentHierarchyProps,
  MoveGlossaryTermWebsocketResponse,
} from './ChangeParentHierarchy.interface';

const MAX_BUFFERED_EVENTS = 100;

// `Form.Item` injects a string value; the picker takes `TagLabel[]`.
const ParentPicker = ({
  excludeFqn,
  placeholder,
  selected,
  onParentSelected,
  onChange,
}: {
  excludeFqn: string;
  placeholder: string;
  selected: GlossaryPickerValue | null;
  onParentSelected: (nodes: GlossaryPickerValue[]) => void;
  onChange?: (value?: string) => void;
}) => (
  <GlossaryTermPicker
    selectGlossaries
    data-testid="change-parent-select"
    // A term cannot be moved under itself.
    excludeFqns={[excludeFqn]}
    multiple={false}
    placeholder={placeholder}
    value={selected ? [selected] : []}
    onChange={(terms, nodes) => {
      onParentSelected(nodes);
      onChange?.(terms[0]?.tagFQN);
    }}
  />
);

const ChangeParentHierarchy = ({
  selectedData,
  onCancel,
}: ChangeParentHierarchyProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
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
    if (options.length > 0) {
      const selectedOption = options[0];
      setSelectedParent(selectedOption);
      form.setFieldsValue({ parent: selectedOption.tagFQN });
    } else {
      setSelectedParent(null);
      form.setFieldsValue({ parent: undefined });
    }
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

  return (
    <Modal
      open
      cancelText={t('label.cancel')}
      closable={false}
      data-testid="change-parent-hierarchy-modal"
      maskClosable={false}
      okButtonProps={{
        form: 'change-parent-hierarchy-modal',
        htmlType: 'submit',
        loading: loadingState.isSaving,
        disabled: hasReviewers && !confirmCheckboxChecked,
      }}
      okText={t('label.save')}
      title={t('label.change-entity', { entity: t('label.parent') })}
      onCancel={onCancel}>
      <Form
        form={form}
        id="change-parent-hierarchy-modal"
        layout="vertical"
        onFinish={handleSubmit}>
        {moveJob?.jobId && (
          <div className="m-b-md">
            <Banner
              className="border-radius"
              isLoading={loadingState.isSaving}
              message={moveJob.error ?? moveJob.message ?? ''}
              type={moveJob.error ? 'error' : 'success'}
            />
          </div>
        )}
        <Form.Item
          label={t('label.select-field', {
            field: t('label.parent'),
          })}
          name="parent"
          rules={[
            {
              required: true,
              message: t('label.field-required', {
                field: t('label.parent'),
              }),
            },
          ]}>
          <ParentPicker
            excludeFqn={selectedData.fullyQualifiedName ?? ''}
            placeholder={t('label.select-field', {
              field: t('label.parent'),
            })}
            selected={selectedParent}
            onParentSelected={handleParentSelection}
          />
        </Form.Item>

        {hasReviewers && (
          <div className="m-t-md">
            <Checkbox
              checked={confirmCheckboxChecked}
              className="text-grey-700"
              data-testid="confirm-status-checkbox"
              onChange={(e) => setConfirmCheckboxChecked(e.target.checked)}>
              <span>
                <Transi18next
                  i18nKey="message.entity-transfer-confirmation-message"
                  renderElement={<strong />}
                  values={{
                    from: getEntityName(selectedData),
                  }}
                />
                <span className="d-inline-block m-l-xss">
                  <StatusBadge
                    className="p-x-xs p-y-xss"
                    dataTestId=""
                    label={EntityStatus.InReview}
                    status={EntityStatusClass[EntityStatus.InReview]}
                  />
                </span>
              </span>
            </Checkbox>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default ChangeParentHierarchy;

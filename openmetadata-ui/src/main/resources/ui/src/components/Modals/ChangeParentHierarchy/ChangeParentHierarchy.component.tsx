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
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import TreeAsyncSelectList from '../../../components/common/AsyncSelectList/TreeAsyncSelectList';
import { SOCKET_EVENTS } from '../../../constants/constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import { EntityType } from '../../../enums/entity.enum';
import { TagSource } from '../../../generated/entity/data/container';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { moveGlossaryTerm } from '../../../rest/glossaryAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { StatusClass } from '../../../utils/GlossaryUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Banner from '../../common/Banner/Banner';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import {
  ChangeParentHierarchyProps,
  MoveGlossaryTermWebsocketResponse,
} from './ChangeParentHierarchy.interface';

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
    useState<DefaultOptionType | null>(null);
  const [moveJob, setMoveJob] = useState<MoveGlossaryTermWebsocketResponse>();

  const hasReviewers = Boolean(
    selectedData.reviewers && selectedData.reviewers.length > 0
  );

  const handleTagSelection = (
    option: DefaultOptionType | DefaultOptionType[]
  ) => {
    // Handle both single option and array of options
    const tags = Array.isArray(option) ? option : [option];

    if (tags.length > 0) {
      const selectedOption = tags[0];
      setSelectedParent(selectedOption);
      form.setFieldsValue({ parent: selectedOption.value as string });
    } else {
      setSelectedParent(null);
      form.setFieldsValue({ parent: undefined });
    }
  };

  const handleTreeAsyncSelectCancel = () => {
    // Reset the selected parent when user cancels the tree selection
    setSelectedParent(null);
    form.setFieldsValue({ parent: undefined });
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
    if (!selectedParent?.data) {
      return;
    }

    try {
      setLoadingState((prev) => ({ ...prev, isSaving: true }));
      const parent = selectedParent.data as Glossary | GlossaryTerm;
      const response = await moveGlossaryTerm(selectedData.id, {
        id: parent.id,
        type: (parent as GlossaryTerm).glossary
          ? EntityType.GLOSSARY_TERM
          : EntityType.GLOSSARY,
        fullyQualifiedName: parent.fullyQualifiedName,
      });

      const jobData: MoveGlossaryTermWebsocketResponse = {
        jobId: response.jobId,
        message: response.message,
        status: 'COMPLETED',
      };

      setMoveJob(jobData);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setLoadingState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // WebSocket listener for move job updates
  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.MOVE_GLOSSARY_TERM_CHANNEL, (moveResponse) => {
        if (moveResponse) {
          const moveResponseData = JSON.parse(moveResponse);
          handleMoveJobUpdate(moveResponseData);
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
          <TreeAsyncSelectList
            hasNoActionButtons
            isParentSelectable
            data-testid="change-parent-select"
            filterOptions={[selectedData.fullyQualifiedName ?? '']}
            isMultiSelect={false}
            open={false}
            placeholder={t('label.select-field', {
              field: t('label.parent'),
            })}
            tagType={TagSource.Glossary}
            onCancel={handleTreeAsyncSelectCancel}
            onChange={handleTagSelection}
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
                    status={StatusClass[EntityStatus.InReview]}
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

/*
 *  Copyright 2023 Collate.
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

import { WarningOutlined } from '@ant-design/icons';
import { Checkbox, Modal } from 'antd';
import { isUndefined } from 'lodash';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { EntityStatusClass } from '../../../utils/EntityStatusUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { GlossaryTermMoveConfirmationModalProps } from './GlossaryTermTab.interface';

const getTransferTargetName = (
  movedGlossaryTerm: GlossaryTermMoveConfirmationModalProps['movedGlossaryTerm'],
  activeGlossary: GlossaryTermMoveConfirmationModalProps['activeGlossary']
) =>
  movedGlossaryTerm?.to?.name ??
  (activeGlossary && getEntityName(activeGlossary));

const GlossaryTermMoveConfirmationModal = ({
  isModalOpen,
  isTableLoading,
  hasReviewers,
  confirmCheckboxChecked,
  onConfirmCheckboxChange,
  movedGlossaryTerm,
  activeGlossary,
  onDragConfirmationModalClose,
  onChangeGlossaryTerm,
  t,
}: GlossaryTermMoveConfirmationModalProps) => {
  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      confirmLoading={isTableLoading}
      data-testid="confirmation-modal"
      maskClosable={false}
      okButtonProps={{ disabled: hasReviewers && !confirmCheckboxChecked }}
      okText={t('label.move')}
      open={isModalOpen}
      title={
        <>
          <WarningOutlined className="m-r-xs warning-icon" />
          {t('label.move-the-entity', {
            entity: t('label.glossary-term'),
          })}
        </>
      }
      onCancel={onDragConfirmationModalClose}
      onOk={onChangeGlossaryTerm}>
      <Transi18next
        i18nKey="message.entity-transfer-message"
        renderElement={<strong />}
        values={{
          from: movedGlossaryTerm?.from.name,
          to: getTransferTargetName(movedGlossaryTerm, activeGlossary),
          entity: isUndefined(movedGlossaryTerm?.to)
            ? ''
            : t('label.term-lowercase'),
        }}
      />
      {hasReviewers && (
        <div className="m-t-md">
          <Checkbox
            checked={confirmCheckboxChecked}
            className="text-grey-700"
            data-testid="confirm-status-checkbox"
            onChange={(e) => onConfirmCheckboxChange(e.target.checked)}>
            <span>
              <Transi18next
                i18nKey="message.entity-transfer-confirmation-message"
                renderElement={<strong />}
                values={{
                  from: movedGlossaryTerm?.from.name,
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
    </Modal>
  );
};

export default GlossaryTermMoveConfirmationModal;

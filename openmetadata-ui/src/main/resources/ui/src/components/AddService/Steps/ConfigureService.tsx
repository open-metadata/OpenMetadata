/*
 *  Copyright 2022 Collate.
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

import { t } from 'i18next';
import React, { useRef } from 'react';
import { errorMsg, requiredField } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from '../../common/rich-text-editor/RichTextEditor.interface';
import { Field } from '../../Field/Field';
import { ConfigureServiceProps } from './Steps.interface';

const ConfigureService = ({
  serviceName,
  description,
  showError,
  handleValidation,
  onBack,
  onNext,
}: ConfigureServiceProps) => {
  const markdownRef = useRef<EditorContentRef>();

  const validationErrorMsg = (): string => {
    if (showError.name) {
      return t('message.field-text-is-required', {
        fieldText: t('label.service-name'),
      });
    }
    if (showError.duplicateName) {
      return t('message.entity-already-exists', {
        entity: t('label.service-name'),
      });
    }
    if (showError.delimit) {
      return t('message.service-with-delimiters-not-allowed');
    }
    if (showError.nameWithSpace) {
      return t('message.service-with-space-not-allowed');
    }
    if (showError.nameLength) {
      return t('message.service-name-length');
    }
    if (showError.specialChar) {
      return t('message.special-character-not-allowed');
    }

    return '';
  };

  return (
    <div data-testid="configure-service-container">
      <Field>
        <label className="tw-block tw-form-label" htmlFor="serviceName">
          {requiredField(`${t('label.service-name')}:`)}
        </label>

        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="service-name"
          id="serviceName"
          name="serviceName"
          placeholder={t('label.service-name')}
          type="text"
          value={serviceName}
          onChange={handleValidation}
        />
        {errorMsg(validationErrorMsg())}
      </Field>
      <Field>
        <label className="tw-block tw-form-label" htmlFor="description">
          {`${t('label.description')}:`}
        </label>
        <RichTextEditor initialValue={description} ref={markdownRef} />
      </Field>

      <Field className="tw-flex tw-justify-end tw-mt-10">
        <Button
          className="tw-mr-2"
          data-testid="back-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onBack}>
          <span>{t('label.back')}</span>
        </Button>

        <Button
          data-testid="next-button"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={() => onNext(markdownRef.current?.getEditorContent() || '')}>
          <span>{t('label.next')}</span>
        </Button>
      </Field>
    </div>
  );
};

export default ConfigureService;

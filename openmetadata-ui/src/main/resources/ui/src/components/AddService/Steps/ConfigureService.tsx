/*
 *  Copyright 2021 Collate
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

import { EditorContentRef } from 'Models';
import React, { useRef } from 'react';
import { errorMsg, requiredField } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
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

  return (
    <div data-testid="configure-service-container">
      <Field>
        <label className="tw-block tw-form-label" htmlFor="serviceName">
          {requiredField('Service Name:')}
        </label>

        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="service-name"
          id="serviceName"
          name="serviceName"
          placeholder="service name"
          type="text"
          value={serviceName}
          onChange={handleValidation}
        />

        {showError.name && errorMsg('Service name is required.')}
        {showError.duplicateName && errorMsg('Service name already exist.')}
      </Field>
      <Field>
        <label className="tw-block tw-form-label" htmlFor="description">
          Description:
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
          <span>Back</span>
        </Button>

        <Button
          data-testid="next-button"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={() => onNext(markdownRef.current?.getEditorContent() || '')}>
          <span>Next</span>
        </Button>
      </Field>
    </div>
  );
};

export default ConfigureService;

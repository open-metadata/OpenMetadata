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
    <div>
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
        <RichTextEditor
          data-testid="description"
          initialValue={description}
          ref={markdownRef}
        />
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

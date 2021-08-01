import React, { useRef, useState } from 'react';
import { TagsCategory } from '../../../pages/tags/tagsTypes';
import { Button } from '../../buttons/Button/Button';
type FormModalProp = {
  onCancel: () => void;
  onSave: (data: TagsCategory) => void;
  form: React.ElementType;
  header: string;
  initialData: TagsCategory;
};
type FormRef = {
  fetchMarkDownData: () => string;
};
const FormModal = ({
  onCancel,
  onSave,
  form: Form,
  header,
  initialData,
}: FormModalProp) => {
  const formRef = useRef<FormRef>();
  const [data, setData] = useState<TagsCategory>(initialData);

  const onSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      ...data,
      description: formRef?.current?.fetchMarkDownData() || '',
    });
  };

  return (
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop" onClick={() => onCancel()} />
      <div className="tw-modal-container tw-overflow-y-auto tw-max-h-screen">
        <form action="." method="POST" onSubmit={onSubmitHandler}>
          <div className="tw-modal-header">
            <p className="tw-modal-title tw-text-grey-body">{header}</p>
          </div>
          <div className="tw-modal-body">
            <Form initialData={initialData} ref={formRef} saveData={setData} />
          </div>
          <div className="tw-modal-footer">
            <Button
              size="regular"
              theme="primary"
              variant="link"
              onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="regular"
              theme="primary"
              type="submit"
              variant="contained">
              Save
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
};

export default FormModal;

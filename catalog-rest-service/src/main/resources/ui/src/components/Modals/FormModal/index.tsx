/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { Team } from 'Models';
import React, { useRef, useState } from 'react';
import { TagsCategory } from '../../../pages/tags/tagsTypes';
import { Button } from '../../buttons/Button/Button';
type FormData = TagsCategory | Team;
type FormModalProp = {
  onCancel: () => void;
  onSave: (data: TagsCategory) => void;
  form: React.ElementType;
  header: string;
  initialData: FormData;
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
  const [data, setData] = useState<FormData>(initialData);

  const onSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      ...data,
      description: formRef?.current?.fetchMarkDownData() || '',
    });
  };

  return (
    <dialog className="tw-modal" data-testid="modal-container">
      <div className="tw-modal-backdrop" onClick={() => onCancel()} />
      <div className="tw-modal-container tw-overflow-y-auto tw-max-h-screen">
        <form action="." method="POST" onSubmit={onSubmitHandler}>
          <div className="tw-modal-header">
            <p
              className="tw-modal-title tw-text-grey-body"
              data-testid="header">
              {header}
            </p>
          </div>
          <div className="tw-modal-body">
            <Form initialData={initialData} ref={formRef} saveData={setData} />
          </div>
          <div className="tw-modal-footer" data-testid="cta-container">
            <Button
              size="regular"
              theme="primary"
              variant="link"
              onClick={onCancel}>
              Cancel
            </Button>
            <Button
              data-testid="saveButton"
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

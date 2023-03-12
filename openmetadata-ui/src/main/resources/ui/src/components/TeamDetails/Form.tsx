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

/* eslint-disable @typescript-eslint/ban-types */

import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import { t } from 'i18next';
import { FormErrorData } from 'Models';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Team } from '../../generated/entity/teams/team';
import { errorMsg } from '../../utils/CommonUtils';

type FormProp = {
  saveData: (value: object) => void;
  initialData: Team;
  errorData?: FormErrorData;
};
type EditorContentRef = {
  getEditorContent: () => string;
};
const Form: React.FC<FormProp> = forwardRef(
  ({ saveData, initialData, errorData }: FormProp, ref): JSX.Element => {
    const [data, setData] = useState<Team>({
      name: initialData.name,
      description: initialData.description,
      displayName: initialData.displayName,
      id: initialData.id || '',
      href: initialData.href || '',
      owns: initialData.owns || [],
      users: initialData.users || [],
    });

    const isMounting = useRef<boolean>(true);
    const markdownRef = useRef<EditorContentRef>();

    const onChangeHadler = (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
      e.persist();
      setData((prevState) => {
        return {
          ...prevState,
          [e.target.name]: e.target.value,
        };
      });
    };
    useImperativeHandle(ref, () => ({
      fetchMarkDownData() {
        return markdownRef.current?.getEditorContent();
      },
    }));

    useEffect(() => {
      if (!isMounting.current) {
        saveData({
          ...data,
          name: data.name.trim(),
          displayName: data.displayName?.trim(),
          description: data.description?.trim(),
        });
      }
    }, [data]);

    // alwyas Keep this useEffect at the end...
    useEffect(() => {
      isMounting.current = false;
    }, []);

    return (
      <div className="tw-w-full tw-flex ">
        <div className="tw-flex tw-w-full">
          <div className="tw-w-full">
            <div className="tw-mb-4">
              <label className="tw-form-label required-field">
                {t('label.name')}
              </label>
              <input
                autoComplete="off"
                className="tw-form-inputs tw-form-inputs-padding"
                data-testid="name"
                name="name"
                placeholder="Name"
                type="text"
                value={data.name}
                onChange={onChangeHadler}
              />
              {errorData?.name && errorMsg(errorData.name)}
            </div>
            <div className="tw-mb-4">
              <label className="tw-form-label required-field">
                {t('label.display-name')}
              </label>
              <input
                autoComplete="off"
                className="tw-form-inputs tw-form-inputs-padding"
                data-testid="displayName"
                name="displayName"
                placeholder="Display name"
                type="text"
                value={data.displayName}
                onChange={onChangeHadler}
              />
              {errorData?.displayName && errorMsg(errorData.displayName)}
            </div>
            <div>
              <label className="tw-form-label">{t('label.description')}</label>
              <RichTextEditor
                initialValue={data.description ?? ''}
                ref={markdownRef}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);
Form.displayName = 'TeamsForm';

export default Form;

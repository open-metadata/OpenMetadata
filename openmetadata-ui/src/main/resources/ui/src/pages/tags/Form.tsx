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

import { Space, Switch } from 'antd';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import { FormErrorData } from 'Models';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { errorMsg } from '../../utils/CommonUtils';

type CustomClassification = {
  description: CreateClassification['description'];
  name: CreateClassification['name'];
  mutuallyExclusive: CreateClassification['mutuallyExclusive'];
};

type FormProp = {
  saveData: (value: CreateClassification) => void;
  initialData: CustomClassification;
  errorData?: FormErrorData;
  showHiddenFields: boolean;
};
type EditorContentRef = {
  getEditorContent: () => string;
};
const Form: React.FC<FormProp> = forwardRef(
  (
    { saveData, initialData, errorData, showHiddenFields }: FormProp,
    ref
  ): JSX.Element => {
    const { t } = useTranslation();
    const [data, setData] = useState<CustomClassification>({
      name: initialData.name,
      description: initialData.description,
      mutuallyExclusive: initialData.mutuallyExclusive,
    });

    const isMounting = useRef<boolean>(true);
    const markdownRef = useRef<EditorContentRef>();

    const onChangeHandler = (
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
          ...(data as CreateClassification),
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
                className="tw-text-sm tw-appearance-none tw-border tw-border-main
                tw-rounded tw-w-full tw-py-2 tw-px-3 tw-text-grey-body  tw-leading-tight
                focus:tw-outline-none focus:tw-border-focus hover:tw-border-hover tw-h-10"
                data-testid="name"
                name="name"
                placeholder={t('label.name')}
                type="text"
                value={data.name}
                onChange={onChangeHandler}
              />
              {errorData?.name && errorMsg(errorData.name)}
            </div>
            <div>
              <label className="tw-form-label">{t('label.description')}</label>
              <RichTextEditor
                initialValue={data.description}
                ref={markdownRef}
              />
            </div>

            {showHiddenFields && (
              <div>
                <Space align="end" className="m-y-md">
                  <label
                    className="tw-form-label m-b-0 tw-mb-1"
                    data-testid="mutually-exclusive-label"
                    htmlFor="mutuallyExclusive">
                    {t('label.mutually-exclusive')}
                  </label>
                  <Switch
                    checked={data.mutuallyExclusive}
                    data-testid="mutually-exclusive-button"
                    id="mutuallyExclusive"
                    onChange={(value) =>
                      setData((prevState) => ({
                        ...prevState,
                        mutuallyExclusive: value,
                      }))
                    }
                  />
                </Space>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export default Form;

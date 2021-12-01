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

import { Team } from 'Models';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import MarkdownWithPreview from '../../components/common/editor/MarkdownWithPreview';

type FormProp = {
  saveData: (value: {}) => void;
  initialData: Team;
};
type EditorContentRef = {
  getEditorContent: () => string;
};
const Form: React.FC<FormProp> = forwardRef(
  ({ saveData, initialData }: FormProp, ref): JSX.Element => {
    const [data, setData] = useState<Team>({
      name: initialData.name,
      description: initialData.description,
      displayName: initialData.displayName,
      id: initialData.id || '',
      href: initialData.href || '',
      owns: initialData.owns || [],
      users: initialData.users || [],
    });

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
      saveData({
        ...data,
      });
    }, [data]);

    return (
      <div className="tw-w-full tw-flex ">
        <div className="tw-flex tw-w-full">
          <div className="tw-w-full">
            <div className="tw-mb-4">
              <label className="tw-form-label required-field">Name</label>
              <input
                required
                autoComplete="off"
                className="tw-form-inputs tw-px-3 tw-py-1"
                name="name"
                placeholder="Name"
                type="text"
                value={data.name}
                onChange={onChangeHadler}
              />
            </div>
            <div className="tw-mb-4">
              <label className="tw-form-label required-field">
                Display name
              </label>
              <input
                required
                autoComplete="off"
                className="tw-form-inputs tw-px-3 tw-py-1"
                name="displayName"
                placeholder="Display name"
                type="text"
                value={data.displayName}
                onChange={onChangeHadler}
              />
            </div>
            <div>
              <label className="tw-form-label required-field">
                Description
              </label>
              <MarkdownWithPreview ref={markdownRef} value={data.description} />
            </div>
          </div>
        </div>
      </div>
    );
  }
);
Form.displayName = 'TeamsForm';

export default Form;

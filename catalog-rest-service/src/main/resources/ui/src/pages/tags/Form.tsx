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

import PropTypes from 'prop-types';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { MarkdownWithPreview } from '../../components/common/editor/MarkdownWithPreview';
import { TagsCategory } from './tagsTypes';
type FormProp = {
  saveData: (value: {}) => void;
  initialData: TagsCategory;
};
type MarkdownRef = {
  fetchUpdatedHTML: () => string;
};
const Form: React.FC<FormProp> = forwardRef(
  ({ saveData, initialData }, ref): JSX.Element => {
    const [data, setData] = useState<TagsCategory>({
      name: initialData.name,
      description: initialData.description,
      categoryType: initialData.categoryType,
    });
    const markdownRef = useRef<MarkdownRef>();
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
        return markdownRef.current?.fetchUpdatedHTML();
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
            {initialData.categoryType && (
              <div className="tw-mb-4">
                <label className="tw-form-label required-field">
                  Select Category Type
                </label>
                <select
                  required
                  className="tw-text-sm tw-appearance-none tw-border tw-border-gray-300 
                tw-rounded tw-w-full tw-py-2 tw-px-3 tw-text-grey-body  tw-leading-tight 
                focus:tw-outline-none focus:tw-border-gray-500 tw-h-10 tw-bg-white"
                  name="categoryType"
                  value={data.categoryType}
                  onChange={onChangeHadler}>
                  <option value="DESCRIPTIVE">Descriptive </option>
                  <option value="CLASSIFICATION">Classification</option>
                </select>
              </div>
            )}
            <div className="tw-mb-4">
              <label className="tw-form-label required-field">Name</label>
              <input
                required
                autoComplete="off"
                className="tw-text-sm tw-appearance-none tw-border tw-border-gray-300 
                tw-rounded tw-w-full tw-py-2 tw-px-3 tw-text-grey-body  tw-leading-tight 
                focus:tw-outline-none focus:tw-border-gray-500 tw-h-10"
                name="name"
                placeholder="Name"
                type="text"
                value={data.name}
                onChange={onChangeHadler}
              />
            </div>
            <div>
              <label className="tw-form-label required-field">
                Description
              </label>
              <MarkdownWithPreview
                editorRef={(Ref: MarkdownRef) => (markdownRef.current = Ref)}
                placeholder="Description"
                value={data.description}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

Form.propTypes = {
  saveData: PropTypes.func.isRequired,
  initialData: PropTypes.shape({
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    categoryType: PropTypes.string.isRequired,
  }).isRequired,
};

export default Form;

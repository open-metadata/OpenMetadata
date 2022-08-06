/*
 *  Copyright 2022 Collate
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

import { Form, InputNumber, Select } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import 'codemirror/addon/fold/foldgutter.css';
import React, { useMemo, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { ProfilerSettingsModalProps } from '../TableProfiler.interface';
import '../tableProfiler.less';

const options = {
  tabSize: JSON_TAB_SIZE,
  indentUnit: JSON_TAB_SIZE,
  indentWithTabs: true,
  lineNumbers: true,
  lineWrapping: true,
  styleActiveLine: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  foldGutter: true,
  gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  mode: {
    name: CSMode.SQL,
  },
};
const labelCol = {
  span: 24,
  style: {
    paddingBottom: '0px',
  },
};
const ProfilerSettingsModal: React.FC<ProfilerSettingsModalProps> = ({
  columnProfile,
  visible,
  onVisibilityChange,
}) => {
  const [sqlQuery, setSqlQuery] = useState('');

  const selectOptions = useMemo(() => {
    return columnProfile.map(({ name }) => ({
      label: name,
      value: name,
    }));
  }, [columnProfile]);

  return (
    <Modal
      title="Settings"
      visible={visible}
      width={630}
      onCancel={() => onVisibilityChange(false)}>
      <Form.Item label="Profile Sample %" labelCol={labelCol}>
        <InputNumber
          addonAfter="%"
          className="tw-w-full"
          max={100}
          min={0}
          placeholder="Enter Profile Sample %"
        />
      </Form.Item>
      <Form.Item label="Profile Sample Query" labelCol={labelCol}>
        <CodeMirror
          className="profiler-setting-sql-editor"
          options={options}
          value={sqlQuery}
          onBeforeChange={(_Editor, _EditorChange, value) => {
            setSqlQuery(value);
          }}
          onChange={(_Editor, _EditorChange, value) => {
            setSqlQuery(value);
          }}
        />
      </Form.Item>
      <p>Enable column profile</p>
      <Form.Item
        className="tw-text-xs tw-mb-0"
        label="Include:"
        labelCol={labelCol}>
        <Select
          allowClear
          className="tw-w-full"
          mode="tags"
          options={selectOptions}
          placeholder="Select columns to include"
          size="middle"
          // onChange={(value) => console.log(value)}
        />
      </Form.Item>
      <Form.Item className="tw-text-xs" label="Exclude:" labelCol={labelCol}>
        <Select
          allowClear
          className="tw-w-full"
          mode="tags"
          options={selectOptions}
          placeholder="Select columns to exclude"
          size="middle"
          // onChange={(value) => console.log(value)}
        />
      </Form.Item>
    </Modal>
  );
};

export default ProfilerSettingsModal;

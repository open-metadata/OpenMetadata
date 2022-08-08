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
import { AxiosError } from 'axios';
import 'codemirror/addon/fold/foldgutter.css';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import {
  getTableProfilerConfig,
  putTableProfileConfig,
} from '../../../axiosAPIs/tableAPI';
import { JSON_TAB_SIZE } from '../../../constants/constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { TableProfilerConfig } from '../../../generated/entity/data/table';
import jsonData from '../../../jsons/en';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Loader from '../../Loader/Loader';
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
  tableId,
  columnProfile,
  visible,
  onVisibilityChange,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [profileSample, setProfileSample] = useState<number>();
  const [excludeCol, setExcludeCol] = useState<string[]>([]);
  const [includeCol, setIncludeCol] = useState<string[]>([]);

  const selectOptions = useMemo(() => {
    return columnProfile.map(({ name }) => ({
      label: name,
      value: name,
    }));
  }, [columnProfile]);

  const fetchProfileConfig = async () => {
    setIsLoading(true);
    try {
      const response = await getTableProfilerConfig(tableId);
      if (response) {
        const { tableProfilerConfig } = response;
        if (tableProfilerConfig) {
          const includeCol =
            tableProfilerConfig.includeColumns?.map(
              ({ columnName }) => columnName as string
            ) || [];
          setSqlQuery(tableProfilerConfig.profileQuery || '');
          setProfileSample(tableProfilerConfig.profileSample);
          setExcludeCol(tableProfilerConfig.excludeColumns || []);
          setIncludeCol(includeCol);
        }
      } else {
        throw jsonData['api-error-messages'][
          'fetch-table-profiler-config-error'
        ];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-table-profiler-config-error']
      );
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    const profileConfig: TableProfilerConfig = {
      excludeColumns: excludeCol.length > 0 ? excludeCol : undefined,
      profileQuery: !isEmpty(sqlQuery) ? sqlQuery : undefined,
      profileSample: !isUndefined(profileSample) ? profileSample : undefined,
      includeColumns:
        includeCol.length > 0
          ? includeCol.map((col) => ({ columnName: col }))
          : undefined,
    };
    try {
      const data = await putTableProfileConfig(tableId, profileConfig);
      if (data) {
        showSuccessToast(
          jsonData['api-success-messages']['update-profile-congif-success']
        );
        onVisibilityChange(false);
      } else {
        throw jsonData['api-error-messages']['update-profiler-config-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-profiler-config-error']
      );
    }
  };

  useEffect(() => {
    fetchProfileConfig();
  }, []);

  return (
    <Modal
      destroyOnClose
      maskClosable={false}
      okText="Save"
      title="Settings"
      visible={visible}
      width={630}
      onCancel={() => onVisibilityChange(false)}
      onOk={handleSave}>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <Form.Item label="Profile Sample %" labelCol={labelCol}>
            <InputNumber
              addonAfter="%"
              className="tw-w-full"
              max={100}
              min={0}
              placeholder="Enter Profile Sample %"
              value={profileSample}
              onChange={(value) => {
                setProfileSample(value);
              }}
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
              defaultValue={includeCol}
              mode="tags"
              options={selectOptions}
              placeholder="Select columns to include"
              size="middle"
              onChange={(value) => setIncludeCol(value)}
            />
          </Form.Item>
          <Form.Item
            className="tw-text-xs"
            label="Exclude:"
            labelCol={labelCol}>
            <Select
              allowClear
              className="tw-w-full"
              defaultValue={excludeCol}
              mode="tags"
              options={selectOptions}
              placeholder="Select columns to exclude"
              size="middle"
              onChange={(value) => setExcludeCol(value)}
            />
          </Form.Item>
        </>
      )}
    </Modal>
  );
};

export default ProfilerSettingsModal;

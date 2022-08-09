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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Modal, Select, Slider } from 'antd';
import { AxiosError } from 'axios';
import 'codemirror/addon/fold/foldgutter.css';
import { isEmpty, isEqual, isUndefined, startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import {
  getTableProfilerConfig,
  putTableProfileConfig,
} from '../../../axiosAPIs/tableAPI';
import {
  codeMirrorOption,
  DEFAULT_INCLUDE_PROFILE,
  PROFILER_METRIC,
} from '../../../constants/entity.constants';
import {
  ColumnProfilerConfig,
  TableProfilerConfig,
} from '../../../generated/entity/data/table';
import jsonData from '../../../jsons/en';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Loader from '../../Loader/Loader';
import { ProfilerSettingsModalProps } from '../TableProfiler.interface';
import '../tableProfiler.less';

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
  const [includeCol, setIncludeCol] = useState<ColumnProfilerConfig[]>(
    DEFAULT_INCLUDE_PROFILE
  );

  const selectOptions = useMemo(() => {
    return columnProfile.map(({ name }) => ({
      label: name,
      value: name,
    }));
  }, [columnProfile]);
  const metricsOptions = useMemo(() => {
    return PROFILER_METRIC.map((metric) => ({
      label: startCase(metric),
      value: metric,
    }));
  }, [columnProfile]);

  const fetchProfileConfig = async () => {
    setIsLoading(true);
    try {
      const response = await getTableProfilerConfig(tableId);
      if (response) {
        const { tableProfilerConfig } = response;
        if (tableProfilerConfig) {
          setSqlQuery(tableProfilerConfig.profileQuery || '');
          setProfileSample(tableProfilerConfig.profileSample);
          setExcludeCol(tableProfilerConfig.excludeColumns || []);
          setIncludeCol(
            tableProfilerConfig.includeColumns || DEFAULT_INCLUDE_PROFILE
          );
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
      includeColumns: !isEqual(includeCol, DEFAULT_INCLUDE_PROFILE)
        ? includeCol
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
      cancelButtonProps={{
        type: 'link',
      }}
      data-testid="profiler-settings-modal"
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
          <div className="tw-pb-4" data-testid="profile-sample-container">
            <p>Profile Sample %</p>
            <div className="tw-px-2 tw-mb-1.5">
              <Slider
                className="profiler-slider"
                marks={{ 0: '0%', 100: '100%' }}
                max={100}
                min={0}
                value={profileSample}
                onChange={(value) => {
                  setProfileSample(value);
                }}
              />
            </div>
          </div>
          <div className="tw-pb-4" data-testid="sql-editor-container">
            <p className="tw-mb-1.5">Profile Sample Query</p>
            <CodeMirror
              className="profiler-setting-sql-editor"
              data-testid="profiler-setting-sql-editor"
              options={codeMirrorOption}
              value={sqlQuery}
              onBeforeChange={(_Editor, _EditorChange, value) => {
                setSqlQuery(value);
              }}
              onChange={(_Editor, _EditorChange, value) => {
                setSqlQuery(value);
              }}
            />
          </div>
          <p className="tw-mb-4">Enable column profile</p>
          <Form
            autoComplete="off"
            initialValues={{
              includeColumns: includeCol,
            }}
            layout="vertical"
            name="dynamic_form_nest_item"
            onValuesChange={(_, data) => {
              setIncludeCol(data.includeColumns);
            }}>
            <Form.List name="includeColumns">
              {(fields, { add, remove }) => (
                <>
                  <div className="tw-flex tw-items-center tw-mb-1.5">
                    <p className="w-form-label tw-text-xs tw-mr-3">Include:</p>
                    <Button
                      className="include-columns-add-button"
                      icon={<PlusOutlined />}
                      size="small"
                      type="primary"
                      onClick={() => add()}
                    />
                  </div>
                  {fields.map(({ key, name, ...restField }) => (
                    <div className="tw-flex tw-gap-2 tw-w-full" key={key}>
                      <Form.Item
                        className="tw-w-11/12 tw-mb-4"
                        {...restField}
                        name={[name, 'columnName']}>
                        <Select
                          className="tw-w-full"
                          data-testid="exclude-column-select"
                          options={selectOptions}
                          placeholder="Select columns to include"
                          size="middle"
                        />
                      </Form.Item>
                      <Form.Item
                        className="tw-w-11/12 tw-mb-4"
                        {...restField}
                        name={[name, 'metrics']}>
                        <Select
                          allowClear
                          className="tw-w-full"
                          data-testid="exclude-column-select"
                          mode="tags"
                          options={metricsOptions}
                          placeholder="Select metrics"
                          size="middle"
                        />
                      </Form.Item>
                      <Button
                        icon={
                          <SVGIcons
                            alt="delete"
                            className="tw-w-4"
                            icon={Icons.DELETE}
                          />
                        }
                        type="text"
                        onClick={() => remove(name)}
                      />
                    </div>
                  ))}
                </>
              )}
            </Form.List>
          </Form>

          <div className="tw-pb-4" data-testid="exclude-column-container">
            <p className="tw-text-xs tw-mb-1.5">Exclude:</p>
            <Select
              allowClear
              className="tw-w-full"
              data-testid="exclude-column-select"
              mode="tags"
              options={selectOptions}
              placeholder="Select columns to exclude"
              size="middle"
              value={excludeCol}
              onChange={(value) => setExcludeCol(value)}
            />
          </div>
        </>
      )}
    </Modal>
  );
};

export default ProfilerSettingsModal;

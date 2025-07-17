/*
 *  Copyright 2024 Collate.
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
import { UploadOutlined } from '@ant-design/icons';
import { WidgetProps } from '@rjsf/utils';
import { Button, UploadProps } from 'antd';
import Upload, { UploadChangeParam, UploadFile } from 'antd/lib/upload';
import { AxiosError } from 'axios';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileUploadEnum } from '../../../../../enums/File.enum';
import { showErrorToast } from '../../../../../utils/ToastUtils';

const FileUploadWidget: FC<WidgetProps> = ({
  onChange,
  onFocus,
  disabled,
  ...rest
}) => {
  const { t } = useTranslation();

  const defaultValue = useMemo((): UploadFile[] => {
    if (rest.value) {
      return [
        {
          uid: rest.value,
          name: rest.value,
          status: FileUploadEnum.DONE,
        },
      ];
    }

    return [];
  }, [rest.value]);

  const handleChange = async (info: UploadChangeParam) => {
    try {
      if (info.file.status === FileUploadEnum.REMOVED) {
        onChange(undefined);

        return;
      }

      const fileData = info.file.response?.result;
      if (fileData) {
        onChange(fileData);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRequestUpload: UploadProps['customRequest'] = (options) => {
    const reader = new FileReader();
    reader.readAsText(options.file as Blob);
    reader.addEventListener('load', (e) => {
      options?.onSuccess?.(e.target);
    });
    reader.addEventListener('error', () => {
      throw t('server.unexpected-error');
    });
  };

  return (
    <Upload
      {...rest}
      accept={rest.schema.accept}
      className="file-widget-wrapper d-block p-b-xs"
      customRequest={handleRequestUpload}
      data-testid="upload-file-widget"
      defaultFileList={defaultValue}
      listType="text"
      maxCount={1}
      multiple={false}
      onChange={handleChange}>
      <Button
        data-testid="upload-file-widget-content"
        disabled={disabled}
        icon={<UploadOutlined />}
        size="small"
        onFocus={() => onFocus(rest.id, rest.value)}>
        {t('message.upload-file')}
      </Button>
    </Upload>
  );
};

export default FileUploadWidget;

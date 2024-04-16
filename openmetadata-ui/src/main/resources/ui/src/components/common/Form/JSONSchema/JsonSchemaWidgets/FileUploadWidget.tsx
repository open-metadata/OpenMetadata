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
import { WidgetProps } from '@rjsf/utils';
import { Space, Typography, UploadProps } from 'antd';
import { UploadChangeParam, UploadFile } from 'antd/lib/upload';
import Dragger from 'antd/lib/upload/Dragger';
import { AxiosError } from 'axios';
import { isArray } from 'lodash';
import React, { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ImportIcon } from '../../../../../assets/svg/ic-drag-drop.svg';
import { FileUploadEnum } from '../../../../../enums/File.enum';
import { Transi18next } from '../../../../../utils/CommonUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import './widget.less';

const FileUploadWidget: FC<WidgetProps> = ({ onChange, onFocus, ...rest }) => {
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
    <Dragger
      {...rest}
      accept={rest.schema.accept}
      className="file-widget-wrapper"
      customRequest={handleRequestUpload}
      data-testid="upload-file-widget"
      defaultFileList={defaultValue}
      listType="text"
      maxCount={1}
      multiple={false}
      onChange={handleChange}>
      <Space
        align="center"
        className="w-full justify-center"
        data-testid="upload-file-widget-content"
        direction="vertical"
        size={12}
        onClick={() => onFocus(rest.id, rest.value)}>
        <ImportIcon height={60} width={60} />
        <Typography.Text className="font-medium text-md">
          <Transi18next
            i18nKey="message.drag-and-drop-or-browse-files-here"
            renderElement={<span className="text-primary browse-text" />}
            values={{
              text: t('label.browse'),
              type: isArray(rest.schema.accept)
                ? rest.schema.accept.map((type) => type).join(', ')
                : rest.schema.accept,
            }}
          />
        </Typography.Text>
      </Space>
    </Dragger>
  );
};

export default FileUploadWidget;

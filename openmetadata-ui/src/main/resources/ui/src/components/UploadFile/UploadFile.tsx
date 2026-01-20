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
import { Space, Typography, UploadProps } from 'antd';
import Dragger from 'antd/lib/upload/Dragger';
import { AxiosError } from 'axios';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ImportIcon } from '../../assets/svg/ic-drag-drop.svg';
import { Transi18next } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import './upload-file.less';
import { UploadFileProps } from './UploadFile.interface';

const UploadFile: FC<UploadFileProps> = ({
  disabled,
  fileType,
  beforeUpload,
  onCSVUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const { t } = useTranslation();

  const handleUpload: UploadProps['customRequest'] = useCallback(
    (options: UploadRequestOption) => {
      setUploading(true);
      try {
        const reader = new FileReader();
        reader.onload = onCSVUploaded;
        reader.onerror = () => {
          throw t('server.unexpected-error');
        };
        reader.readAsText(options.file as Blob);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setUploading(false);
      }
    },
    [onCSVUploaded]
  );

  return uploading ? (
    <Loader />
  ) : (
    <Dragger
      accept={fileType}
      beforeUpload={beforeUpload}
      className="file-dragger-wrapper"
      customRequest={handleUpload}
      data-testid="upload-file-widget"
      disabled={disabled}
      multiple={false}
      showUploadList={false}>
      <Space
        align="center"
        className="w-full justify-center"
        direction="vertical"
        size={42}>
        <ImportIcon height={86} width={86} />
        <Typography.Text>
          <Transi18next
            i18nKey="message.drag-and-drop-or-browse-csv-files-here"
            renderElement={<span className="browse-text" />}
            values={{
              text: t('label.browse'),
            }}
          />
        </Typography.Text>
      </Space>
    </Dragger>
  );
};

export default UploadFile;

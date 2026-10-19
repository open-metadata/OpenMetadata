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
import { FileUploadDropZone } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import { UploadFileProps } from './UploadFile.interface';

const UploadFile: FC<UploadFileProps> = ({
  acceptedFileDescription,
  disabled,
  fileType,
  beforeUpload,
  onCSVUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const processing = useRef(false);
  const { t } = useTranslation();
  const handleUpload = useCallback(
    async (files: FileList) => {
      const file = files[0];
      if (!file || processing.current) {
        return;
      }
      processing.current = true;
      setUploading(true);
      const finish = () => {
        processing.current = false;
        setUploading(false);
      };
      try {
        const result = await beforeUpload?.(file, Array.from(files));
        if (result === false || typeof result === 'string') {
          finish();

          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          finish();
          onCSVUploaded(event, file);
        };
        reader.onerror = () => {
          finish();
          showErrorToast(new Error(t('server.unexpected-error')) as AxiosError);
        };
        // beforeUpload may transform the contents while callers still need the
        // original file's name for the import preview and downloaded report.
        reader.readAsText(result instanceof Blob ? result : file);
      } catch (error) {
        finish();
        showErrorToast(error as AxiosError);
      }
    },
    [beforeUpload, onCSVUploaded, t]
  );
  if (uploading) {
    return <Loader />;
  }

  return (
    <FileUploadDropZone
      accept={fileType}
      allowsMultiple={false}
      clickToUploadLabel={t('label.click-to-browse')}
      data-testid="upload-file-widget"
      hint={
        acceptedFileDescription ??
        t('message.accepts-file-up-to-size', { fileType, size: '10 MB' })
      }
      input-data-testid="upload-file-input"
      isDisabled={disabled}
      orDragAndDropLabel={t('label.or-drag-and-drop')}
      onDropFiles={handleUpload}
    />
  );
};

export default UploadFile;

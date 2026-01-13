/*
 *  Copyright 2025 Collate.
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
import Icon from '@ant-design/icons';
import { Typography } from 'antd';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFileIcon } from '../../../../../utils/BlockEditorUtils';
import { FileType } from '../../../BlockEditor.interface';

interface AttachmentPlaceholderProps {
  fileType: FileType;
}

const AttachmentPlaceholder: FC<AttachmentPlaceholderProps> = ({
  fileType,
}) => {
  const { t } = useTranslation();

  const FileIcon = useMemo(() => getFileIcon(fileType), [fileType]);

  return (
    <div
      className="image-placeholder"
      contentEditable={false}
      data-testid="image-placeholder">
      <Icon component={FileIcon} />
      <Typography>
        {t('label.add-an-file-type', {
          fileType: t(`label.${fileType}`),
        })}
      </Typography>
    </div>
  );
};

export default AttachmentPlaceholder;

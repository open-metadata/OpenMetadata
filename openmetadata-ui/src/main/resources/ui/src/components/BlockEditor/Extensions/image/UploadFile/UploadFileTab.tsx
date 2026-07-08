import { InboxOutlined } from '@ant-design/icons';
import { Upload, UploadProps } from 'antd';
import { RcFile } from 'antd/lib/upload';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { AssetType } from '../../../../../generated/attachments/asset';
import { uploadAsset } from '../../../../../rest/assetAPI';
import { getAcceptedFileTypes } from '../../../../../utils/BlockEditorUtils';
import EntityLink from '../../../../../utils/EntityLink';
import { useEntityAttachment } from '../../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import { ImagePopoverContentProps } from '../ImageComponent.interface';


const UploadFileTab = ({
  updateAttributes,
  onPopupVisibleChange,
  onUploadingChange,
  fileType,
}: ImagePopoverContentProps) => {
  const { entityType, entityFqn = '' } = useEntityAttachment();
  const { t } = useTranslation();

  const uploadProps: UploadProps = {
    accept: getAcceptedFileTypes(fileType),
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    multiple: false,
    customRequest: async (e) => {
      // Type assertion to ensure file is RcFile
      const file = e.file as RcFile;

      if (isUndefined(entityType) || isUndefined(entityFqn)) {
        e?.onError?.(new Error(t('message.image-upload-after-asset-creation')));

        return;
      }

      try {
        const response = await uploadAsset(file,  EntityLink.getEntityLink(
            entityType,
            entityFqn,
            entityType === EntityType.KNOWLEDGE_PAGE ? undefined : 'description'
          ), AssetType.Inline);

        onUploadingChange(true);
        updateAttributes({
          src: response.url,
          alt: file.name,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
        onUploadingChange(false);
        e?.onSuccess?.(response);
        onPopupVisibleChange(false);
      } catch (error) {
        e?.onError?.(error as Error);
      }
    },
  };

  return (
    <Upload.Dragger {...uploadProps}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">
        {t('label.click-or-drag-entity-to-this-area-to-upload', {
          entity: fileType,
        })}
      </p>
    </Upload.Dragger>
  );
};

export default UploadFileTab;

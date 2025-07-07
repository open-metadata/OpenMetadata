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
import { EditorView } from '@tiptap/pm/view';
import { AxiosError } from 'axios';
import { isString, isUndefined, noop } from 'lodash';
import { createContext, ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { FileType } from '../../../BlockEditor/BlockEditor.interface';
import imageClassBase from '../../../BlockEditor/Extensions/image/ImageClassBase';

export interface EntityAttachmentType {
  entityType: EntityType;
  entityFqn?: string;
  handleFileUpload: (
    file: File,
    view: EditorView,
    pos: number,
    showInlineAlert?: boolean
  ) => Promise<void>;
  errorMessage?: string;
  handleErrorMessage: (error?: string) => void;
  allowImageUpload: boolean;
  allowFileUpload: boolean;
}

interface EntityAttachmentProps {
  children: ReactNode;
  entityType: EntityType;
  entityFqn?: string;
  allowFileUpload?: boolean;
}

const EntityAttachmentContext = createContext<EntityAttachmentType>(
  {} as EntityAttachmentType
);

export const useEntityAttachment = () => useContext(EntityAttachmentContext);

export const EntityAttachmentProvider = ({
  children,
  entityType,
  entityFqn,
  allowFileUpload = false,
}: EntityAttachmentProps) => {
  const { t } = useTranslation();
  const { onImageUpload = noop, allowImageUpload = false } =
    imageClassBase.getBlockEditorAttachmentProps() ?? {};
  const [errorMessage, setErrorMessage] = useState<string>();

  const handleErrorMessage = (error?: string) => {
    setErrorMessage(error);
  };

  // Handle file upload logic
  const handleFileUpload = async (
    file: File,
    view: EditorView,
    pos: number,
    showInlineAlert?: boolean
  ) => {
    if (!onImageUpload) {
      return;
    }

    const fileType = file.type;
    const isImage = fileType.startsWith(FileType.IMAGE);

    if (isImage && !allowImageUpload) {
      return;
    }

    if (!isImage && !allowFileUpload) {
      showInlineAlert
        ? setErrorMessage(t('message.only-image-files-supported'))
        : showErrorToast(t('message.only-image-files-supported'));

      return;
    }

    try {
      // Get the current state
      const { state } = view;
      const { tr } = state;

      // Create the temporary node
      const tempNode = state.schema.nodes.fileAttachment.create({
        url: '',
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        isUploading: true,
        uploadProgress: 0,
        tempFile: file,
        isImage,
        alt: file.name,
      });

      // Create and dispatch the transaction for the temporary node
      const tempTr = tr.insert(pos, tempNode);
      view.dispatch(tempTr);

      // Start the upload using the existing onImageUpload function
      const url = await onImageUpload(file, entityType, entityFqn);

      // Get the current state after upload
      const currentState = view.state;
      const currentTr = currentState.tr;

      // Find the position of the temporary node
      let tempNodePos = -1;
      currentState.doc.descendants((node, pos) => {
        if (node.attrs.isUploading && node.attrs.tempFile === file) {
          tempNodePos = pos;
        }
      });

      // If we can't find the temporary node, it might have been removed
      // In this case, we'll insert the final node at the original position
      if (tempNodePos === -1) {
        const finalNode = currentState.schema.nodes.fileAttachment.create({
          url,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          isUploading: false,
          uploadProgress: 100,
          isImage,
          alt: file.name,
        });

        currentTr.insert(pos, finalNode);
        view.dispatch(currentTr);

        return;
      }

      // Create the final node
      const finalNode = currentState.schema.nodes.fileAttachment.create({
        url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        isUploading: false,
        uploadProgress: 100,
        isImage,
        alt: file.name,
      });

      // Replace the temporary node with the final node at the correct position
      currentTr.replaceWith(tempNodePos, tempNodePos + 1, finalNode);
      view.dispatch(currentTr);
    } catch (error) {
      const errorMessage = (error as AxiosError<{ message: string }>).response
        ?.data?.message;

      // Get the current state for error handling
      const currentState = view.state;
      const currentTr = currentState.tr;

      // Find the position of the temporary node
      let tempNodePos = -1;
      currentState.doc.descendants((node, pos) => {
        if (node.attrs.isUploading && node.attrs.tempFile === file) {
          tempNodePos = pos;
        }
      });

      if (tempNodePos !== -1) {
        // Remove the temporary node on error
        currentTr.delete(tempNodePos, tempNodePos + 1);
        view.dispatch(currentTr);
      }

      showInlineAlert
        ? setErrorMessage(
            !isUndefined(errorMessage) && isString(errorMessage)
              ? errorMessage
              : t('label.failed-to-upload-file')
          )
        : showErrorToast(error as AxiosError, t('label.failed-to-upload-file'));
    }
  };

  const value: EntityAttachmentType = {
    entityType,
    entityFqn,
    handleFileUpload,
    errorMessage,
    handleErrorMessage,
    allowImageUpload,
    allowFileUpload,
  };

  return (
    <EntityAttachmentContext.Provider value={value}>
      {children}
    </EntityAttachmentContext.Provider>
  );
};

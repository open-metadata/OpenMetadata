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
import { Typography } from '@mui/material';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { omit } from 'lodash';
import imageClassBase from '../components/BlockEditor/Extensions/image/ImageClassBase';
import { CoverImageFileValue } from '../components/common/CoverImageUpload/CoverImageUpload.interface';
import { ERROR_MESSAGE } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { getIsErrorMatch } from './CommonUtils';
import {
  showNotistackError,
  showNotistackSuccess,
  showNotistackWarning,
} from './NotistackUtils';

/**
 * Options for uploading cover image after entity creation
 */
export interface UploadCoverImageOptions<T> {
  coverImageData?: CoverImageFileValue;
  createdEntity: T;
  entityType: EntityType;
  onUpdate: (entity: T, coverImageUrl: string, position?: string) => Promise<T>;
}

/**
 * Uploads cover image and updates entity after creation
 *
 * This function:
 * 1. Uploads the file with the real entity FQN (if cover image exists)
 * 2. Calls the provided onUpdate callback to let consumer update the entity
 * 3. Handles errors gracefully (entity remains created even if upload fails)
 *
 * @param options - Configuration for upload and update
 * @returns Object containing the entity and upload failure status
 *
 * @example
 * ```typescript
 * const createdDomain = await addDomains(formData);
 *
 * const { entity: finalDomain, uploadFailed } = await handleCoverImageUpload({
 *   coverImageData: extractCoverImageData(formData),
 *   createdEntity: createdDomain,
 *   entityType: EntityType.DOMAIN,
 *   onUpdate: async (domain, coverImageUrl, position) => {
 *     const updated = {
 *       ...domain,
 *       style: {
 *         ...domain.style,
 *         coverImage: coverImageUrl,
 *         ...(position !== undefined && { coverImagePosition: position }),
 *       },
 *     };
 *     const jsonPatch = compare(domain, updated);
 *     return await patchDomains(domain.id, jsonPatch);
 *   },
 * });
 * ```
 */
export async function handleCoverImageUpload<T>(
  options: UploadCoverImageOptions<T>
): Promise<{ entity: T; uploadFailed: boolean }> {
  const { coverImageData, createdEntity, entityType, onUpdate } = options;

  // No cover image to upload
  if (!coverImageData?.file) {
    return { entity: createdEntity, uploadFailed: false };
  }

  // Check if upload functionality is available
  const { onImageUpload } =
    imageClassBase.getBlockEditorAttachmentProps() ?? {};
  if (!onImageUpload) {
    return { entity: createdEntity, uploadFailed: false };
  }

  try {
    // Upload cover image with real FQN
    const uploadedUrl = await onImageUpload(
      coverImageData.file,
      entityType,
      (createdEntity as { fullyQualifiedName: string }).fullyQualifiedName
    );

    // Let consumer handle the update logic
    const updatedEntity = await onUpdate(
      createdEntity,
      uploadedUrl,
      coverImageData.position?.y
    );

    return { entity: updatedEntity, uploadFailed: false };
  } catch (uploadError) {
    // Return original entity (without cover image)
    // Note: Warning notification will be shown by caller
    return { entity: createdEntity, uploadFailed: true };
  }
}

/**
 * Options for creating an entity with cover image upload
 */
export interface CreateEntityWithCoverImageOptions<TFormData, TEntity> {
  formData: TFormData;
  entityType: EntityType;
  entityLabel: string;
  entityPluralLabel: string;
  createEntity: (cleanFormData: TFormData) => Promise<TEntity>;
  patchEntity: (entityId: string, patch: Operation[]) => Promise<TEntity>;
  onSuccess: (entity: TEntity) => void | Promise<void>;
  enqueueSnackbar: (
    message: React.ReactNode,
    options?: Record<string, unknown>
  ) => void;
  closeSnackbar: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/**
 * Generic function to create an entity with cover image upload
 *
 * This function handles the complete 3-step flow:
 * 1. Extract cover image from form data
 * 2. Create entity without cover image
 * 3. Upload cover image with real FQN and update entity
 * 4. Show success/error messages
 * 5. Call success callback
 *
 * @param options - Configuration for entity creation
 * @returns The created entity (with cover image if provided)
 *
 * @example
 * ```typescript
 * await createEntityWithCoverImage({
 *   formData,
 *   entityType: EntityType.DOMAIN,
 *   entityLabel: t('label.domain'),
 *   entityPluralLabel: 'domains',
 *   createEntity: addDomains,
 *   patchEntity: patchDomains,
 *   onSuccess: () => {
 *     closeDrawer();
 *     refetch();
 *   },
 *   enqueueSnackbar,
 *   closeSnackbar,
 *   t,
 * });
 * ```
 */
export async function createEntityWithCoverImage<TFormData, TEntity>(
  options: CreateEntityWithCoverImageOptions<TFormData, TEntity>
): Promise<TEntity> {
  const {
    formData,
    entityType,
    entityLabel,
    entityPluralLabel,
    createEntity,
    patchEntity,
    onSuccess,
    enqueueSnackbar,
    closeSnackbar,
    t,
  } = options;

  try {
    // Step 1: Extract cover image data
    const coverImageData = (
      formData as TFormData & { coverImage?: CoverImageFileValue }
    ).coverImage;

    // Step 2: Remove coverImage from formData before API call
    const cleanFormData = omit(
      formData as Record<string, unknown>,
      'coverImage'
    ) as TFormData;

    // Step 3: Create entity
    const createdEntity = await createEntity(cleanFormData);

    // Step 4: Upload cover image and update (only if file exists)
    let finalEntity: TEntity = createdEntity;
    let uploadFailed = false; // Default to false (no upload needed)

    if (coverImageData?.file) {
      const result = await handleCoverImageUpload({
        coverImageData,
        createdEntity,
        entityType,
        onUpdate: async (
          entity,
          coverImageUrl,
          position?
        ): Promise<Awaited<TEntity>> => {
          // Build updated entity with cover image as nested object (matches backend CoverImage interface)
          const entityRecord = entity as Record<string, unknown>;
          const updatedEntity = {
            ...entity,
            style: {
              ...(entityRecord.style as Record<string, unknown>),
              coverImage: {
                url: coverImageUrl,
                ...(position !== undefined && {
                  position: position, // Store percentage string directly (e.g., "-16%")
                }),
              },
            },
          };
          const jsonPatch = compare(entityRecord, updatedEntity);

          const patchResult = await patchEntity(
            entityRecord.id as string,
            jsonPatch
          );

          return patchResult as Awaited<TEntity>;
        },
      });

      finalEntity = result.entity as TEntity;
      uploadFailed = result.uploadFailed;
    }

    // Step 5: Show appropriate notification based on upload status
    if (uploadFailed) {
      // Entity created but upload failed - show warning
      showNotistackWarning(
        enqueueSnackbar,
        <Typography sx={{ fontWeight: 600 }} variant="body2">
          {t('message.entity-created-but-cover-image-failed', {
            entity: entityLabel,
          })}
        </Typography>,
        closeSnackbar
      );
    } else {
      // Entity created successfully (with or without cover image)
      showNotistackSuccess(
        enqueueSnackbar,
        <Typography sx={{ fontWeight: 600 }} variant="body2">
          {t('server.create-entity-success', { entity: entityLabel })}
        </Typography>,
        closeSnackbar
      );
    }

    // Step 6: Call success callback
    await onSuccess(finalEntity);

    return finalEntity;
  } catch (error) {
    // Error handling
    showNotistackError(
      enqueueSnackbar,
      getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist) ? (
        <Typography sx={{ fontWeight: 600 }} variant="body2">
          {t('server.entity-already-exist', {
            entity: entityLabel,
            entityPlural: entityPluralLabel,
            name: (formData as { name?: string }).name,
          })}
        </Typography>
      ) : (
        (error as AxiosError)
      ),
      t('server.add-entity-error', {
        entity: entityLabel.toLowerCase(),
      }),
      { vertical: 'top', horizontal: 'center' },
      closeSnackbar
    );

    throw error;
  }
}

/*
 *  Copyright 2026 Collate.
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
/**
 * Represents an uploaded asset record (e.g. an image, pdf or attachment) for an entity.
 */
export interface Asset {
    /**
     * Type of the asset.
     */
    assetType?: AssetType;
    /**
     * MIME type of the asset.
     */
    contentType?: string;
    /**
     * When `true` indicates the entity has been marked for permanent deletion.
     */
    deleted?: boolean;
    /**
     * Link to the entity that this asset belongs to.
     */
    entityLink: string;
    /**
     * File extension of the asset.
     */
    extension?: string;
    /**
     * The original file name of the asset.
     */
    fileName: string;
    /**
     * Fully qualified name of a data asset the attachment belongsTo`.
     */
    fullyQualifiedName?: string;
    /**
     * Unique identifier of the asset.
     */
    id: string;
    /**
     * File size in bytes.
     */
    size?: number;
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * URL where the asset is accessible.
     */
    url?: string;
}

/**
 * Type of the asset.
 *
 * This schema defines the type used for describing different types of Attachments.
 */
export enum AssetType {
    External = "External",
    Inline = "Inline",
}

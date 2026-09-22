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
 * Schema for creating a new asset record after file upload. The asset record will be
 * updated with the URL and status once the upload is complete.
 */
export interface CreateAsset {
    /**
     * Type of the asset.
     */
    assetType?: AssetType;
    /**
     * MIME type of the asset.
     */
    contentType?: string;
    /**
     * Link to the entity that this asset belongs to.
     */
    entityLink: string;
    /**
     * The original file name of the asset.
     */
    fileName: string;
    /**
     * File size in bytes.
     */
    size?: number;
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

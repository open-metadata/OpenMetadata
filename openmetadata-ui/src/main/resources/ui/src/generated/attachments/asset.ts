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
     * SHA-256 of the file's bytes, hex-encoded. Two uploads with the same checksum hold the
     * same file.
     */
    checksum?: string;
    /**
     * MIME type of the asset.
     */
    contentType?: string;
    /**
     * Structure and statistics of a tabular file, absent until the Query Runner has read it.
     */
    dataProfile?: TabularProfile;
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

/**
 * Structure and statistics of a tabular file, absent until the Query Runner has read it.
 *
 * How the Query Runner reads a tabular file, taken once after the upload by the worker that
 * later queries it.
 */
export interface TabularProfile {
    /**
     * Why the file could not be read, when the read failed. A profile with an error has no
     * relations.
     */
    error?:     string;
    readAt?:    number;
    relations?: TabularRelation[];
}

/**
 * One relation the Query Runner registers from a tabular file: the file itself for a CSV,
 * one per sheet for a workbook.
 */
export interface TabularRelation {
    columns?: TabularColumn[];
    /**
     * Relation name, as registered for a file uploaded under its own name.
     */
    name:      string;
    rowCount?: number;
}

/**
 * One column of a tabular file with the statistics the Query Runner read for it, kept as
 * the worker wrote them.
 */
export interface TabularColumn {
    approxUnique?: string;
    avg?:          string;
    dataType?:     string;
    /**
     * Exact number of distinct values.
     */
    distinctCount?:  number;
    max?:            string;
    min?:            string;
    name:            string;
    nullPercentage?: string;
    /**
     * The most frequent values of a text column with their counts, most frequent first; at most
     * fifty, so a small domain is listed in full.
     */
    topValues?: TabularValueCount[];
    /**
     * Number of non-null values.
     */
    valuesCount?: number;
}

/**
 * One value of a column and how many rows carry it.
 */
export interface TabularValueCount {
    count: number;
    value: string;
}

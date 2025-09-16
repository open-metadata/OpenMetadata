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
/**
 * SharePoint Connection Config
 */
export interface SharePointConnection {
    /**
     * Application (client) ID from Azure Active Directory
     */
    clientId: string;
    /**
     * Application (client) secret from Azure Active Directory
     */
    clientSecret:         string;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * SharePoint drive ID. If not provided, default document library will be used
     */
    driveId?: string;
    /**
     * SharePoint site name
     */
    siteName?: string;
    /**
     * SharePoint site URL
     */
    siteUrl:                     string;
    supportsMetadataExtraction?: boolean;
    /**
     * Directory (tenant) ID from Azure Active Directory
     */
    tenantId: string;
    /**
     * Service Type
     */
    type?: SharePointType;
}

/**
 * Service Type
 *
 * SharePoint service type
 */
export enum SharePointType {
    SharePoint = "SharePoint",
}

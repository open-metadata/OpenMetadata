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


 /**
 * PowerBIReportServer Connection Config
 */
export interface PowerBIReportServerConnection {
    /**
     * Dashboard URL for PowerBI Report Server.
     */
    hostPort: string;
    /**
     * Password to connect to PowerBI report server.
     */
    password:                    string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: PowerBIReportServerType;
    /**
     * Username to connect to PowerBI report server.
     */
    username: string;
    /**
     * Web Portal Virtual Directory Name.
     */
    webPortalVirtualDirectory?: string;
}

/**
 * Service Type
 *
 * PowerBIReportServer service type
 */
export enum PowerBIReportServerType {
    PowerBIReportServer = "PowerBIReportServer",
}

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
 * Username and password credentials for SAP S/4HANA.
 */
export interface BasicAuth {
    /**
     * Authentication type identifier.
     */
    authType?: AuthType;
    /**
     * Password to authenticate with SAP S/4HANA.
     */
    password: string;
    /**
     * Username to authenticate with SAP S/4HANA.
     */
    username: string;
}

/**
 * Authentication type identifier.
 */
export enum AuthType {
    Basic = "basic",
}

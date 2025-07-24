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
 * Apache Ranger Connection Config
 */
export interface RangerConnection {
    /**
     * Authentication type to connect to Apache Ranger.
     */
    authType: AuthenticationType;
    /**
     * Apache Ranger Admin URL.
     */
    hostPort: string;
    /**
     * Service Type
     */
    type?: RangerType;
}

/**
 * Authentication type to connect to Apache Ranger.
 */
export interface AuthenticationType {
    /**
     * Password to connect to Apache Ranger.
     */
    password?: string;
    /**
     * Username to connect to Apache Ranger. This user should have privileges to read all
     * policies and metadata in Ranger.
     */
    username?: string;
    /**
     * Path to the keytab file for Kerberos authentication.
     */
    keytabPath?: string;
    /**
     * Kerberos principal for authentication. Used with keytab file.
     */
    principal?: string;
}

/**
 * Service Type
 *
 * Apache Ranger service type
 */
export enum RangerType {
    Ranger = "Ranger",
}

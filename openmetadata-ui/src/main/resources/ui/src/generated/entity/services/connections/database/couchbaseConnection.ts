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
 * Couchbase Connection Config
 */
export interface CouchbaseConnection {
    /**
     * Couchbase connection Bucket options.
     */
    bucket?: string;
    /**
     * Hostname of the Couchbase service.
     */
    hostport: string;
    /**
     * Password to connect to Couchbase.
     */
    password: string;
    /**
     * Couchbase driver scheme options.
     */
    scheme?:                     CouchbaseScheme;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: CouchbaseType;
    /**
     * Username to connect to Couchbase. This user should have privileges to read all the
     * metadata in Couchbase.
     */
    username: string;
}

/**
 * Couchbase driver scheme options.
 */
export enum CouchbaseScheme {
    Couchbase = "couchbase",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum CouchbaseType {
    Couchbase = "Couchbase",
}

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
 * MlFlow Connection Config
 */
export interface MlflowConnection {
    /**
     * Mlflow Model registry backend. E.g.,
     * mysql+pymysql://mlflow:password@localhost:3307/experiments
     */
    registryUri:                 string;
    supportsMetadataExtraction?: boolean;
    /**
     * Mlflow Experiment tracking URI. E.g., http://localhost:5000
     */
    trackingUri: string;
    /**
     * Service Type
     */
    type?: MlflowType;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum MlflowType {
    Mlflow = "Mlflow",
}

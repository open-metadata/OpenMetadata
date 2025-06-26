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
 * This schema defines the configuration for a Spark Engine runner.
 */
export interface SparkEngineConfig {
    /**
     * Additional Spark configuration properties as key-value pairs.
     */
    config?: { [key: string]: any };
    /**
     * Spark Connect Remote URL.
     */
    remote: string;
    type:   Type;
}

export enum Type {
    Spark = "Spark",
}

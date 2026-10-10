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
 * Deployment attributes of a service, set once on the service rather than tagged onto each
 * asset it ingests. Policy conditions can match on them to control who sees a service's
 * assets.
 */
export interface ServiceAttributes {
    /**
     * Deployment or cluster identifier the source system belongs to, for example
     * `prod-cluster-01`.
     */
    deployment?:  string;
    environment?: Environment;
    /**
     * Geographic region the source system is hosted in, for example `us-east-1` or
     * `europe-west2`.
     */
    region?: string;
}

/**
 * Environment the source system runs in. A closed set so policies and filters can rely on
 * it; use tags on the service for anything outside it.
 */
export enum Environment {
    Development = "Development",
    Other = "Other",
    Production = "Production",
    QA = "QA",
    Sandbox = "Sandbox",
    Staging = "Staging",
    UAT = "UAT",
}

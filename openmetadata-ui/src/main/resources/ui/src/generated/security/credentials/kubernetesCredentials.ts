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
 * Credentials for a Kubernetes cluster
 */
export interface KubernetesCredentials {
    /**
     * Whether the Kubernetes secrets manager is running in the same cluster where the
     * OpenMetadata services are running
     */
    inCluster?: boolean;
    /**
     * The path to the kubeconfig file
     */
    kubeconfigPath?: string;
    /**
     * The namespace of the Kubernetes cluster
     */
    namespace?: string;
}

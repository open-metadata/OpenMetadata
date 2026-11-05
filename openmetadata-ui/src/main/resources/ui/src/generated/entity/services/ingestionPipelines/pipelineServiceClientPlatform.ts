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
 * Values the server itself reports as the `platform` of a Pipeline Service Client response,
 * independently of any client. That field stays a free string, since every pipeline service
 * client reports its own platform name. `disabled` means no pipeline service client is
 * configured: the status is still a 200, so the platform is the only thing that tells a
 * caller that deploying or running a pipeline will do nothing.
 */
export enum PipelineServiceClientPlatform {
    Disabled = "disabled",
}

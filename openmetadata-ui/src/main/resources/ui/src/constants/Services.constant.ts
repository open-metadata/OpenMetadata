/*
 *  Copyright 2022 Collate.
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
 * @deprecated This file previously contained 93 eager image imports that bloated the bundle.
 *
 * All exports have been moved to modular files. Update your imports:
 *
 * UI Schemas:
 * - import { COMMON_UI_SCHEMA, DEF_UI_SCHEMA } from './ServiceUISchema.constant';
 *
 * Service Types & Constants:
 * - import { SERVICE_TYPES, BETA_SERVICES } from './ServiceType.constant';
 *
 * Service Icons (lazy-loaded):
 * - import { getServiceIcon } from '../utils/ServiceIconUtils';
 * - const icon = await getServiceIcon('mysql');
 */

export * from './ServiceType.constant';
export * from './ServiceUISchema.constant';

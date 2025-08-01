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
 * Add a Custom Property to the selected assets.
 */
export interface AddCustomProperties {
    /**
     * Owners to apply
     */
    customProperties: any;
    /**
     * Update the Custom Property even if it is defined in the asset. By default, we will only
     * apply the owners to assets without the given Custom Property informed.
     */
    overwriteMetadata?: boolean;
    /**
     * Application Type
     */
    type: AddCustomPropertiesActionType;
}

/**
 * Application Type
 *
 * Add Custom Properties Action Type.
 */
export enum AddCustomPropertiesActionType {
    AddCustomPropertiesAction = "AddCustomPropertiesAction",
}

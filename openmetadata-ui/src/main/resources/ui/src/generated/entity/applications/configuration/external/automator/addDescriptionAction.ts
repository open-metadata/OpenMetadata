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
 * Apply Tags to the selected assets.
 */
export interface AddDescriptionAction {
    /**
     * Apply the description to the children of the selected assets that match the criteria.
     * E.g., columns, tasks, topic fields,...
     */
    applyToChildren?: string[];
    /**
     * Description to apply
     */
    description: string;
    /**
     * Update the description even if they are already defined in the asset. By default, we'll
     * only add the descriptions to assets without the description set.
     */
    overwriteMetadata?: boolean;
    /**
     * Application Type
     */
    type: AddDescriptionActionType;
}

/**
 * Application Type
 *
 * Add Description Action Type.
 */
export enum AddDescriptionActionType {
    AddDescriptionAction = "AddDescriptionAction",
}

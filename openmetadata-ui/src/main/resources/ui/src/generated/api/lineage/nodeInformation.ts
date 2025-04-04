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
 * A general object to hold any object.
 */
export interface NodeInformation {
    /**
     * Entity object.
     */
    entity?: any;
    paging?: LayerPaging;
    [property: string]: any;
}

/**
 * Type used for cursor based pagination information in GET list responses.
 */
export interface LayerPaging {
    /**
     * Count of entities downstream current layer entity.
     */
    entityDownstreamCount?: number;
    /**
     * Count of entities upstream current layer entity.
     */
    entityUpstreamCount?: number;
}

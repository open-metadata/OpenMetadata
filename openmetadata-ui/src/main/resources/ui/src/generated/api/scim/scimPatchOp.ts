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
 * SCIM PatchOp request as per RFC 7644
 */
export interface ScimPatchOp {
    Operations: Operation[];
    schemas:    string[];
}

export interface Operation {
    op:     Op;
    path?:  string;
    value?: any[] | boolean | number | { [key: string]: any } | string;
    [property: string]: any;
}

export enum Op {
    Add = "add",
    Remove = "remove",
    Replace = "replace",
}

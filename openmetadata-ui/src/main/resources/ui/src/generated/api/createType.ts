/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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
 * Create a Type to be used for extending entities.
 */
export interface CreateType {
  category?: Category;
  /**
   * Optional description of the type.
   */
  description: string;
  /**
   * Display Name that identifies this Type.
   */
  displayName?: string;
  /**
   * Unique name that identifies a Type.
   */
  name: string;
  /**
   * Namespace or group to which this type belongs to.
   */
  nameSpace: string;
  /**
   * JSON schema encoded as string. This will be used to validate the type values.
   */
  schema: string;
}

/**
 * Metadata category to which a type belongs to.
 */
export enum Category {
  Entity = 'entity',
  Field = 'field',
}

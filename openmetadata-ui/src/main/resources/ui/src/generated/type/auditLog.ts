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
 * This schema defines the Audit Log type to capture the audit trail of POST, PUT, and PATCH
 * API operations.
 */
export interface AuditLog {
  /**
   * Identifier of entity that was modified by the operation.
   */
  entityId: string;
  /**
   * Type of Entity that is modified by the operation.
   */
  entityType: string;
  /**
   * HTTP Method used in a call.
   */
  method: Method;
  /**
   * Requested API Path.
   */
  path: string;
  /**
   * HTTP response code for the api requested.
   */
  responseCode: number;
  /**
   * Timestamp when the API call is made in Unix epoch time milliseconds in Unix epoch time
   * milliseconds.
   */
  timestamp?: number;
  /**
   * Name of the user who made the API request.
   */
  userName: string;
}

/**
 * HTTP Method used in a call.
 */
export enum Method {
  Delete = 'DELETE',
  Patch = 'PATCH',
  Post = 'POST',
  Put = 'PUT',
}

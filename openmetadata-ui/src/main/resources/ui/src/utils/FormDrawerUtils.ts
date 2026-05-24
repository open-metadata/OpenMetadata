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
 * Awaits the submit handler, then closes the drawer and runs the optional
 * post-success callback. If the submit handler throws or rejects,
 * `closeDrawer` and `onSuccess` are skipped — the drawer stays open
 * for the user to retry (the error is caught by the drawer footer).
 */
export const submitAndClose = async <T>(
  data: T,
  handler: (data: T) => Promise<void>,
  closeDrawer: () => void,
  onSuccess?: () => void
): Promise<void> => {
  await handler(data);
  closeDrawer();
  onSuccess?.();
};

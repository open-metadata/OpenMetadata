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
 * Width of the Form Hint column, per the approved design. HookForm's
 * `fieldDocDisplay="panel"` renders the column at this width.
 */
export const FORM_HINT_COLUMN_WIDTH = 380;

/**
 * Width of the form column beside the Form Hint. The approved design pairs a
 * 1024px modal with a 642px form, but the real Data Quality form needs the
 * ~772px it had before the hint moved inside the modal — at 642px its
 * test-level cards wrap. Widths are derived from this so the form column stays
 * the same whether the hint is shown or hidden; only the hint appears or
 * disappears.
 */
export const FORM_COLUMN_WIDTH = 772;

/** Width of a form modal or drawer while its Form Hint column is shown. */
export const FORM_WIDTH_WITH_HINT = FORM_COLUMN_WIDTH + FORM_HINT_COLUMN_WIDTH;

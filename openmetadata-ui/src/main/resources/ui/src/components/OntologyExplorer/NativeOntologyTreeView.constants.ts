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
/** Each level indents by the core Tree's default step, so the hierarchy reads as before. */
export const TREE_INDENT_PER_LEVEL = 22;

/** Deeper levels share the last indent rather than pushing rows off the card. */
export const TREE_MAX_INDENT_LEVEL = 15;

/**
 * Past this many rows only the rows on screen are mounted. A full window (2,048 rows, see
 * ADR:2026-10-24-ontology-studio-bounds-tree-windows-and-count-workers) mounted every row and
 * took seconds to open and to select a row in on FIBO.
 */
export const TREE_VIRTUALIZATION_THRESHOLD = 200;

/** The handoff's row height, used to place rows before they are measured. */
export const TREE_ROW_HEIGHT = 56;

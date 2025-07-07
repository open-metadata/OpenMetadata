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

export interface HeaderCardProps {
  /**
   * The title to display in the header
   */
  title: string;

  /**
   * The description text below the title
   */
  description: string;

  /**
   * The label for the add button
   */
  addLabel?: string;

  /**
   * Callback function when add button is clicked
   */
  onAdd?: () => void;

  /**
   * Whether the add button should be disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS class names
   */
  className?: string;

  /**
   * Custom background gradient (optional)
   */
  gradient?: string;

  /**
   * Whether to show the add button
   */
  showAddButton?: boolean;
}

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

// Keeping CSS variables intact lets React Flow repaint its SVG edges when the
// root theme changes without rebuilding workflow nodes, edges, or layout state.
export const WORKFLOW_EDGE_THEME = {
  customBackground: 'var(--tw-color-utility-brand-50)',
  customLabel: 'var(--tw-color-utility-brand-600)',
  // React Flow embeds marker colors in SVG URL ids, so fallback delimiters
  // would make the generated marker reference browser-dependent.
  edge: 'var(--om-color-border-hover)',
  labelBorder: 'var(--tw-background-color-primary)',
  negativeBackground: 'var(--tw-color-utility-error-50)',
  negativeLabel: 'var(--tw-color-utility-error-600)',
  positiveBackground: 'var(--tw-color-utility-success-50)',
  positiveLabel: 'var(--tw-color-utility-success-600)',
  warningBackground: 'var(--tw-color-utility-warning-50)',
  warningLabel: 'var(--tw-color-utility-warning-600)',
} as const;

export const getWorkflowConditionTheme = (condition: string) => {
  const normalizedCondition = condition.trim().toLowerCase();

  if (normalizedCondition === 'true' || normalizedCondition === 'approve') {
    return {
      backgroundColor: WORKFLOW_EDGE_THEME.positiveBackground,
      labelColor: WORKFLOW_EDGE_THEME.positiveLabel,
    };
  }

  if (normalizedCondition === 'reject') {
    return {
      backgroundColor: WORKFLOW_EDGE_THEME.negativeBackground,
      labelColor: WORKFLOW_EDGE_THEME.negativeLabel,
    };
  }

  if (normalizedCondition === 'false') {
    return {
      backgroundColor: WORKFLOW_EDGE_THEME.warningBackground,
      labelColor: WORKFLOW_EDGE_THEME.warningLabel,
    };
  }

  return {
    backgroundColor: WORKFLOW_EDGE_THEME.customBackground,
    labelColor: WORKFLOW_EDGE_THEME.customLabel,
  };
};

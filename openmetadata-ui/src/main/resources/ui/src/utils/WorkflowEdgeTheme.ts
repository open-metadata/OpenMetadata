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
  customBackground: 'var(--om-color-bg-brand, #EFF8FF)',
  customLabel: 'var(--om-color-fg-brand, #1570EF)',
  // React Flow embeds marker colors in SVG URL ids, so fallback delimiters
  // would make the generated marker reference browser-dependent.
  edge: 'var(--om-color-border-primary)',
  labelBorder: 'var(--om-color-bg-primary, #FFFFFF)',
  negativeBackground: 'var(--om-color-bg-error, #FEF3F2)',
  negativeLabel: 'var(--om-color-fg-error, #D92D20)',
  positiveBackground: 'var(--om-color-bg-success, #ECFDF3)',
  positiveLabel: 'var(--om-color-fg-success, #079455)',
  warningBackground: 'var(--om-color-bg-warning, #FFFAEB)',
  warningLabel: 'var(--om-color-fg-warning, #DC6803)',
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

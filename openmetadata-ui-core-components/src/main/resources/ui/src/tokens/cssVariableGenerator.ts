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

import type { ThemeColors } from '../types';
import { createSemanticTokens, SemanticTokens } from './semanticTokens';

type ColorPaletteKey = 'brand' | 'gray' | 'blueGray' | 'blue' | 'blueLight' |
  'indigo' | 'purple' | 'pink' | 'rose' | 'orange' | 'error' | 'warning' | 'success' | 'info';

const PALETTE_KEYS: ColorPaletteKey[] = [
  'brand', 'gray', 'blueGray', 'blue', 'blueLight',
  'indigo', 'purple', 'pink', 'rose', 'orange',
  'error', 'warning', 'success', 'info'
];

const SHADE_KEYS = ['25', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

export function generateCSSVariables(
  colors: ThemeColors,
  semantic: SemanticTokens
): Record<string, string> {
  const variables: Record<string, string> = {};

  // Primitive color tokens
  variables['--om-color-white'] = colors.white;
  variables['--om-color-page'] = colors.page;
  variables['--om-color-surface'] = colors.surface;
  variables['--om-color-surface-raised'] = colors.surfaceRaised;

  // Generate palette variables
  for (const paletteKey of PALETTE_KEYS) {
    const palette = colors[paletteKey];
    if (palette && typeof palette === 'object') {
      for (const shade of SHADE_KEYS) {
        const value = (palette as Record<string, string>)[shade];
        if (value) {
          variables[`--om-color-${paletteKey}-${shade}`] = value;
        }
      }
      // Handle custom gray shades
      if (paletteKey === 'gray') {
        if ((palette as Record<string, string>)['725']) {
          variables['--om-color-gray-725'] = (palette as Record<string, string>)['725'];
        }
        if ((palette as Record<string, string>)['750']) {
          variables['--om-color-gray-750'] = (palette as Record<string, string>)['750'];
        }
      }
      // Handle custom blueGray shades
      if (paletteKey === 'blueGray') {
        const customShades = ['40', '75', '125', '150', '250'];
        for (const shade of customShades) {
          const value = (palette as Record<string, string>)[shade];
          if (value) {
            variables[`--om-color-blueGray-${shade}`] = value;
          }
        }
      }
    }
  }

  // Semantic surface tokens
  variables['--om-surface-default'] = semantic.surface.default;
  variables['--om-surface-body'] = semantic.surface.body;
  variables['--om-surface-raised'] = semantic.surface.raised;
  variables['--om-surface-hover'] = semantic.surface.hover;
  variables['--om-surface-selected'] = semantic.surface.selected;
  variables['--om-surface-disabled'] = semantic.surface.disabled;
  variables['--om-surface-card'] = semantic.surface.card;
  variables['--om-surface-input'] = semantic.surface.input;
  variables['--om-surface-overlay'] = semantic.surface.overlay;
  variables['--om-surface-header'] = semantic.surface.header;
  variables['--om-surface-sidebar'] = semantic.surface.sidebar;

  // Semantic text tokens
  variables['--om-text-primary'] = semantic.text.primary;
  variables['--om-text-secondary'] = semantic.text.secondary;
  variables['--om-text-tertiary'] = semantic.text.tertiary;
  variables['--om-text-disabled'] = semantic.text.disabled;
  variables['--om-text-inverse'] = semantic.text.inverse;
  variables['--om-text-link'] = semantic.text.link;

  // Semantic border tokens
  variables['--om-border-default'] = semantic.border.default;
  variables['--om-border-light'] = semantic.border.light;
  variables['--om-border-strong'] = semantic.border.strong;
  variables['--om-border-focus'] = semantic.border.focus;
  variables['--om-border-subtle'] = semantic.border.subtle;

  // Semantic status tokens
  variables['--om-status-success'] = semantic.status.success;
  variables['--om-status-success-bg'] = semantic.status.successBg;
  variables['--om-status-success-border'] = semantic.status.successBorder;
  variables['--om-status-warning'] = semantic.status.warning;
  variables['--om-status-warning-bg'] = semantic.status.warningBg;
  variables['--om-status-warning-border'] = semantic.status.warningBorder;
  variables['--om-status-error'] = semantic.status.error;
  variables['--om-status-error-bg'] = semantic.status.errorBg;
  variables['--om-status-error-border'] = semantic.status.errorBorder;
  variables['--om-status-info'] = semantic.status.info;
  variables['--om-status-info-bg'] = semantic.status.infoBg;
  variables['--om-status-info-border'] = semantic.status.infoBorder;

  // Semantic interactive tokens
  variables['--om-interactive-primary'] = semantic.interactive.primary;
  variables['--om-interactive-primary-hover'] = semantic.interactive.primaryHover;
  variables['--om-interactive-primary-active'] = semantic.interactive.primaryActive;

  return variables;
}

export function injectCSSVariables(
  colors: ThemeColors,
  mode: 'light' | 'dark'
): void {
  const semantic = createSemanticTokens(colors, mode);
  const variables = generateCSSVariables(colors, semantic);

  const root = document.documentElement;

  for (const [key, value] of Object.entries(variables)) {
    root.style.setProperty(key, value);
  }

  // Also set Ant Design compatible variables for legacy components
  root.style.setProperty('--ant-primary-color', colors.brand[600]);
  root.style.setProperty('--ant-success-color', colors.success[600]);
  root.style.setProperty('--ant-warning-color', colors.warning[600]);
  root.style.setProperty('--ant-error-color', colors.error[600]);
  root.style.setProperty('--ant-info-color', colors.info[500]);
}

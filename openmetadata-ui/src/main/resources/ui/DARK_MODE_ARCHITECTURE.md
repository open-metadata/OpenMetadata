# Dark Mode Architecture - Implementation Plan

## Problem Statement

The codebase has 190+ hardcoded hex colors scattered across .less files. This makes dark mode implementation difficult because:
- Less variables are **compile-time** values
- CSS custom properties are **runtime** values
- antd v4 uses Less functions (`fade()`, `darken()`) that require compile-time color values

## Recommended Architecture: Design Token System

### Single Source of Truth

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESIGN TOKENS (TypeScript)                    │
│              src/styles/tokens/designTokens.ts                   │
├─────────────────────────────────────────────────────────────────┤
│  Light Mode Tokens          │  Dark Mode Tokens                 │
│  surface.default: #ffffff   │  surface.default: #0d1117         │
│  surface.raised: #f8f9fc    │  surface.raised: #161b22          │
│  text.primary: #181d27      │  text.primary: #e6edf3            │
│  border.default: #eaecf5    │  border.default: #30363d          │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│   CSS Custom Properties Injection      │
│   (AntDConfigProvider / App.tsx)       │
│   --om-surface-default: <value>        │
│   --om-text-primary: <value>           │
└───────────────┬───────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
┌───────────────┐ ┌─────────────────┐
│  MUI Theme    │ │  Less/CSS       │
│  (TypeScript) │ │  var(--om-*)    │
└───────────────┘ └─────────────────┘
```

### Implementation Steps

## Phase 1: Create Design Token System (1-2 days)

### Step 1.1: Create Token Definition File

**File: `src/styles/tokens/designTokens.ts`**

```typescript
export interface DesignTokens {
  surface: {
    default: string;    // Main background (white/dark)
    raised: string;     // Cards, elevated elements
    overlay: string;    // Modals, popovers
    hover: string;      // Hover states
    selected: string;   // Selected items
  };
  text: {
    primary: string;    // Main content
    secondary: string;  // Less emphasized
    tertiary: string;   // Supporting text
    disabled: string;   // Disabled text
    link: string;       // Links
    inverse: string;    // Text on dark backgrounds
  };
  border: {
    default: string;    // Standard borders
    light: string;      // Subtle borders
    strong: string;     // Emphasized borders
  };
  // Status colors don't change between themes
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

export const lightTokens: DesignTokens = {
  surface: {
    default: '#ffffff',
    raised: '#f8f9fc',
    overlay: '#ffffff',
    hover: '#f8f8f8',
    selected: '#eff8ff',
  },
  text: {
    primary: '#181d27',
    secondary: '#414651',
    tertiary: '#757575',
    disabled: '#a4a7ae',
    link: '#1570ef',
    inverse: '#ffffff',
  },
  border: {
    default: '#eaecf5',
    light: '#f0f0f0',
    strong: '#d5d7da',
  },
  status: {
    success: '#17b26a',
    warning: '#f79009',
    error: '#f04438',
    info: '#1570ef',
  },
};

export const darkTokens: DesignTokens = {
  surface: {
    default: '#0d1117',
    raised: '#161b22',
    overlay: '#21262d',
    hover: '#30363d',
    selected: '#388bfd26',
  },
  text: {
    primary: '#e6edf3',
    secondary: '#8b949e',
    tertiary: '#6e7681',
    disabled: '#484f58',
    link: '#58a6ff',
    inverse: '#0d1117',
  },
  border: {
    default: '#30363d',
    light: '#21262d',
    strong: '#6e7681',
  },
  status: {
    success: '#3fb950',
    warning: '#d29922',
    error: '#f85149',
    info: '#58a6ff',
  },
};
```

### Step 1.2: Create CSS Variable Injector

**File: `src/styles/tokens/injectTokens.ts`**

```typescript
import { DesignTokens, lightTokens, darkTokens } from './designTokens';

function flattenTokens(tokens: DesignTokens, prefix = '--om'): Record<string, string> {
  const result: Record<string, string> = {};

  function flatten(obj: any, path: string) {
    for (const key in obj) {
      const newPath = path ? `${path}-${key}` : `${prefix}-${key}`;
      if (typeof obj[key] === 'object') {
        flatten(obj[key], newPath);
      } else {
        result[newPath] = obj[key];
      }
    }
  }

  flatten(tokens, '');
  return result;
}

export function injectDesignTokens(mode: 'light' | 'dark'): void {
  const tokens = mode === 'dark' ? darkTokens : lightTokens;
  const cssVars = flattenTokens(tokens);
  const root = document.documentElement;

  for (const [property, value] of Object.entries(cssVars)) {
    root.style.setProperty(property, value);
  }
}
```

### Step 1.3: Integrate with App.tsx

```typescript
// In App.tsx
import { injectDesignTokens } from './styles/tokens/injectTokens';

useEffect(() => {
  injectDesignTokens(themeMode);
}, [themeMode]);
```

## Phase 2: Update Variables.less (Already Done)

Add semantic token references at the end of variables.less:

```less
// Theme-aware semantic tokens
@om-surface-default: ~'var(--om-surface-default)';
@om-surface-raised: ~'var(--om-surface-raised)';
@om-text-primary: ~'var(--om-text-primary)';
@om-text-secondary: ~'var(--om-text-secondary)';
@om-border-default: ~'var(--om-border-default)';
```

## Phase 3: Migration Script (Automated)

Create a script to find and replace hardcoded colors:

**File: `scripts/migrate-to-tokens.js`**

```javascript
const fs = require('fs');
const glob = require('glob');

const COLOR_MAPPINGS = [
  // Surface colors
  { pattern: /@white(?![a-z-])/g, replacement: '@om-surface-default', description: '@white → surface' },
  { pattern: /@grey-9(?![0-9])/g, replacement: '@om-surface-raised', description: '@grey-9 → raised surface' },
  { pattern: /@grey-1(?![0-9])/g, replacement: '@om-surface-hover', description: '@grey-1 → hover surface' },

  // Text colors
  { pattern: /@text-color(?!-)/g, replacement: '@om-text-primary', description: '@text-color → primary text' },
  { pattern: /@grey-900/g, replacement: '@om-text-primary', description: '@grey-900 → primary text' },
  { pattern: /@grey-700/g, replacement: '@om-text-secondary', description: '@grey-700 → secondary text' },

  // Border colors
  { pattern: /@border-color(?![0-9-])/g, replacement: '@om-border-default', description: '@border-color → border' },
  { pattern: /@grey-15/g, replacement: '@om-border-default', description: '@grey-15 → border' },

  // Hardcoded hex values
  { pattern: /#fff(?:fff)?(?![0-9a-f])/gi, replacement: '@om-surface-default', description: '#fff → surface' },
  { pattern: /#f8f9fc/gi, replacement: '@om-surface-raised', description: '#f8f9fc → raised surface' },
  { pattern: /#eaecf5/gi, replacement: '@om-border-default', description: '#eaecf5 → border' },
];

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = [];

  for (const mapping of COLOR_MAPPINGS) {
    const matches = content.match(mapping.pattern);
    if (matches) {
      content = content.replace(mapping.pattern, mapping.replacement);
      changes.push(`${mapping.description}: ${matches.length} occurrences`);
    }
  }

  if (changes.length > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}:`);
    changes.forEach(c => console.log(`  - ${c}`));
  }
}

// Run migration
const lessFiles = glob.sync('src/**/*.less');
lessFiles.forEach(migrateFile);
```

## Phase 4: Add Linting Rules (Prevent Future Issues)

**File: `.stylelintrc.json`**

```json
{
  "plugins": ["stylelint-declaration-strict-value"],
  "rules": {
    "scale-unlimited/declaration-strict-value": [
      ["/color/", "background-color", "border-color", "fill", "stroke"],
      {
        "ignoreValues": [
          "inherit", "transparent", "currentColor", "none",
          "initial", "unset", "/^var\\(--/"
        ],
        "disableFix": true,
        "message": "Use design tokens: @om-surface-*, @om-text-*, @om-border-*"
      }
    ]
  }
}
```

## Phase 5: Component Migration Priority

### High Priority (Core UI)
1. `variables.less` - ✅ Done (semantic tokens added)
2. `AntDConfigProvider.tsx` - ✅ Done (CSS variables injection)
3. `theme.less` - ✅ Done (dark mode overrides)
4. `nav-bar.less` - Navbar styling
5. `left-sidebar.less` - Left navigation
6. `entity-summary-panel.less` - Entity details

### Medium Priority (Common Components)
7. `popover-card.less`
8. `custom-node.less` (Lineage)
9. `table.less`
10. `card.less`
11. `global-search-bar.less`

### Low Priority (Feature-specific)
12. Activity Feed components
13. Data Insight components
14. Settings pages

## Architecture Benefits

1. **Single Source of Truth**: All colors defined in `designTokens.ts`
2. **Type Safety**: TypeScript interfaces ensure consistency
3. **Runtime Theme Switching**: CSS custom properties enable instant theme changes
4. **Gradual Migration**: Can migrate components incrementally
5. **Linting**: Prevents future hardcoded colors
6. **Framework Agnostic**: Works with Less, CSS, MUI, antd

## Compatibility Notes

### antd v4 Less Functions
Some antd components use Less functions like `fade(@color, 50%)`. These won't work with CSS variables directly. Solutions:
1. Use theme.less overrides for these specific cases
2. Or wait for antd v5 migration (uses CSS-in-JS)

### Migration Timeline
- Phase 1-2: 1-2 days (infrastructure)
- Phase 3: 1-2 days (automated migration)
- Phase 4: 0.5 day (linting)
- Phase 5: 3-5 days (manual review and fixes)
- Total: ~1-2 weeks for comprehensive implementation

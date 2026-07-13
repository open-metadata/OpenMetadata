# Persona App Mode Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin pick a Classic-or-AI app mode per Persona; when a user's default persona has a mode, force-write it into `useAppModeStore` on login (falling back to localStorage → `DEFAULT_APP_MODE` when unset). Gate the whole feature on `useAppRoutesRegistry` having any non-default mode.

**Architecture:** Extend `PersonaPreferences` JSON schema with an optional `appMode: string`. Build `SettingsAppModePage` as a sibling of `SettingsNavigationPage`, wired through `CustomizablePage.tsx`. Add a new hook `useSyncAppModeFromPersona` mounted in `AppRouter` that reads the default persona's `UICustomization` doc and calls `writeAppMode(personaAppMode)` when set. Gate visibility everywhere on `useAppRoutesRegistry(s => Object.keys(s.routes).length > 0)`.

**Tech Stack:** TypeScript · React · Zustand · Ant Design · Jest · react-i18next · JSON Schema (backend model generation via `mvn install openmetadata-spec` + FE regen via `make generate`).

**Design spec:** [`docs/superpowers/specs/2026-07-13-persona-app-mode-preference-design.md`](../specs/2026-07-13-persona-app-mode-preference-design.md).

## Global Constraints

- No hardcoded `"ai"`, `"askCollate"`, or `isDesktopApp` references in OM core. All mode names come from `useAppRoutesRegistry` at runtime.
- Every user-visible string goes through `useTranslation()` / i18n keys; add new keys to `openmetadata-ui/src/main/resources/ui/src/locale/languages/en-us/en-us.json` and run `yarn i18n` before commit.
- Every new file gets the Apache 2.0 header (use `yarn license-header-fix <files>`).
- All colors come from tokens documented in `openmetadata-ui/src/main/resources/ui/docs/colors.md`; no raw hex.
- Do not use `any`. Import types from `generated/` — never inline the shapes.
- Import order: external → `generated/`/`constants/`/`hooks/` → relative → assets → types. Run `yarn organize-imports:cli`, then `yarn lint:fix`, then `yarn pretty:base --write` on touched files before every commit.
- Before every commit that touches `.ts` / `.tsx` / `.json` under `openmetadata-ui/.../ui/src/`, run the ui-checkstyle sequence:
  ```bash
  cd openmetadata-ui/src/main/resources/ui
  yarn organize-imports:cli <changed files>
  yarn lint:fix
  yarn pretty:base --write <changed files>
  yarn license-header-fix <changed files>
  npx tsc --noEmit
  ```
- After schema edits under `openmetadata-spec/`, run `mvn install -pl openmetadata-spec -am -DskipTests` then `source env/bin/activate && make generate` from the repo root to refresh generated types (`openmetadata-ui/.../generated/type/personaPreferences.ts` and `.../generated/system/ui/uiCustomization.ts`).
- Tests use `it()` not `test()`; blank lines around `describe/it/beforeEach`; assertions use `expect(…).toBe(…)` etc.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `openmetadata-spec/src/main/resources/json/schema/type/personaPreferences.json` | Add optional `appMode: string` field | 1 |
| `openmetadata-ui/.../ui/src/generated/type/personaPreferences.ts` | Regenerated FE type (do not hand-edit) | 1 |
| `openmetadata-ui/.../ui/src/hooks/useSyncAppModeFromPersona.ts` | Effect hook: force-write persona's `appMode` into `useAppModeStore` | 2 |
| `openmetadata-ui/.../ui/src/hooks/useSyncAppModeFromPersona.test.ts` | Unit tests for the hook | 2 |
| `openmetadata-ui/.../ui/src/components/AppRouter/AppRouter.tsx` | Mount `useSyncAppModeFromPersona` | 2 |
| `openmetadata-ui/.../ui/src/pages/SettingsAppModePage/SettingsAppModePage.tsx` | Admin editor page (Classic / AI picker) | 3 |
| `openmetadata-ui/.../ui/src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx` | Component tests | 3 |
| `openmetadata-ui/.../ui/src/pages/CustomizablePage/CustomizablePage.tsx` | Add `handleAppModeSave` + `'app-mode'` switch case | 4 |
| `openmetadata-ui/.../ui/src/utils/PersonaClassBase.ts` | Add `'app-mode'` category with icon | 5 |
| `openmetadata-ui/.../ui/src/components/Settings/Persona/CustomizeUI/CustomizeUI.tsx` | Filter out `'app-mode'` when no non-default mode registered | 5 |
| `openmetadata-ui/.../ui/src/pages/Persona/PersonaDetailsPage/PersonaDetailsPage.tsx` | Same runtime filter for direct-URL routing | 5 |
| `openmetadata-ui/.../ui/src/locale/languages/en-us/en-us.json` | New i18n keys (title, description, options, toasts) — synced to 16 other locale files via `yarn i18n` | 6 |

---

## Task 1: Schema — add `appMode` to `PersonaPreferences`

**Files:**
- Modify: `openmetadata-spec/src/main/resources/json/schema/type/personaPreferences.json`
- Regenerated: `openmetadata-ui/src/main/resources/ui/src/generated/type/personaPreferences.ts` (do not edit by hand)
- Regenerated: `openmetadata-ui/src/main/resources/ui/src/generated/system/ui/uiCustomization.ts` (do not edit by hand)

**Interfaces:**
- Consumes: nothing (foundation).
- Produces: `PersonaPreferences.appMode?: string` — the optional field consumed by every later task.

- [ ] **Step 1: Add the field to the JSON schema**

Edit `openmetadata-spec/src/main/resources/json/schema/type/personaPreferences.json`; add `appMode` to `properties` right after `landingPageSettings`:

```json
{
  "$id": "https://open-metadata.org/schema/type/personaPreferences.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PersonaPreferences",
  "description": "User-specific preferences for a persona that override default persona UI customization. These are limited customizations that users can apply to personalize their experience while still inheriting the base persona configuration.",
  "type": "object",
  "javaType": "org.openmetadata.schema.type.PersonaPreferences",
  "properties": {
    "personaId": {
      "description": "UUID of the persona these preferences belong to.",
      "$ref": "basic.json#/definitions/uuid"
    },
    "personaName": {
      "description": "Name of the persona for quick reference and linking.",
      "type": "string"
    },
    "landingPageSettings": {
      "description": "User's personal customizations for the landing page.",
      "type": "object",
      "properties": {
        "headerColor": {
          "description": "Custom header background color for the landing page.",
          "type": "string"
        },
        "headerImage": {
          "description": "Reference to a custom header background image (reserved for future use).",
          "type": "string"
        }
      },
      "additionalProperties": false
    },
    "appMode": {
      "description": "App mode this persona forces on login (e.g. 'default', 'ai'). When unset, the user's own localStorage value (or the built-in default) takes over.",
      "type": "string"
    }
  },
  "required": ["personaId", "personaName"],
  "additionalProperties": false
}
```

- [ ] **Step 2: Regenerate Java + Python + TS models**

Run from repo root:

```bash
mvn install -pl openmetadata-spec -am -DskipTests
source env/bin/activate
make generate
```

Expected: `openmetadata-ui/src/main/resources/ui/src/generated/type/personaPreferences.ts` now has `appMode?: string;`. Confirm with:

```bash
rtk grep -n "appMode" openmetadata-ui/src/main/resources/ui/src/generated/type/personaPreferences.ts
```

Expected output: one line ending in `appMode?: string;`.

- [ ] **Step 3: Commit**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn license-header-fix ../../../../../../openmetadata-spec/src/main/resources/json/schema/type/personaPreferences.json || true
cd -
git add openmetadata-spec/src/main/resources/json/schema/type/personaPreferences.json openmetadata-ui/src/main/resources/ui/src/generated/type/personaPreferences.ts openmetadata-ui/src/main/resources/ui/src/generated/system/ui/uiCustomization.ts
git commit -m "feat(spec): add appMode to PersonaPreferences

Optional string field on persona-level UI preferences that lets an admin
force a specific app mode (e.g. 'ai') on login. Regenerates Java, Python,
and TypeScript models."
```

---

## Task 2: Runtime — `useSyncAppModeFromPersona` hook + mount in `AppRouter`

**Files:**
- Create: `openmetadata-ui/src/main/resources/ui/src/hooks/useSyncAppModeFromPersona.ts`
- Create: `openmetadata-ui/src/main/resources/ui/src/hooks/useSyncAppModeFromPersona.test.ts`
- Modify: `openmetadata-ui/src/main/resources/ui/src/components/AppRouter/AppRouter.tsx`

**Interfaces:**
- Consumes:
  - `PersonaPreferences.appMode?: string` (Task 1).
  - `useAppModeStore` / `writeAppMode(mode: string): void` from `hooks/useAppMode.ts`.
  - `DEFAULT_APP_MODE` from `constants/appMode.constants.ts`.
  - `useAppRoutesRegistry` from `hooks/useAppRoutesRegistry.ts` (state shape: `{ routes: Record<string, ComponentType> }`).
  - `useApplicationStore` from `hooks/useApplicationStore.ts` — reads `currentUser.defaultPersona: { id: string; name: string } | undefined`.
  - `getDocumentByFQN(fqn: string)` from `rest/DocStoreAPI.ts` — returns a `Document` with `.data.personaPreferences: PersonaPreferences[]` (note: the current codebase spelling is `personPreferences` on some Document references but the generated schema uses `personaPreferences` — reference the schema-typed `UICustomization.personaPreferences`).
  - `EntityType.PERSONA` from `enums/entity.enum.ts`.
- Produces: `useSyncAppModeFromPersona(): void` — a side-effecting hook mounted once per session (in `AppRouter`).

- [ ] **Step 1: Write the failing test**

Create `openmetadata-ui/src/main/resources/ui/src/hooks/useSyncAppModeFromPersona.test.ts`:

```ts
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

import { renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_APP_MODE } from '../constants/appMode.constants';
import { useApplicationStore } from './useApplicationStore';
import { useAppModeStore } from './useAppMode';
import { useAppRoutesRegistry } from './useAppRoutesRegistry';
import { useSyncAppModeFromPersona } from './useSyncAppModeFromPersona';

jest.mock('../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
}));

const { getDocumentByFQN } = jest.requireMock('../rest/DocStoreAPI') as {
  getDocumentByFQN: jest.Mock;
};

const seedPersona = (id?: string, name?: string) => {
  useApplicationStore.setState({
    currentUser: id
      ? ({
          id: 'user-1',
          name: 'user-1',
          defaultPersona: { id, name: name ?? 'p', type: 'persona' },
        } as unknown as ReturnType<typeof useApplicationStore.getState>['currentUser'])
      : undefined,
  });
};

const seedRegistry = (hasAi: boolean) => {
  useAppRoutesRegistry.setState({
    routes: hasAi ? { ai: (() => null) as never } : {},
  });
};

describe('useSyncAppModeFromPersona', () => {
  beforeEach(() => {
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
    seedRegistry(false);
    seedPersona(undefined);
    getDocumentByFQN.mockReset();
  });

  it('does nothing when no non-default app mode is registered', async () => {
    seedRegistry(false);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockResolvedValue({
      data: {
        personaPreferences: [
          { personaId: 'persona-1', personaName: 'analytics', appMode: 'ai' },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(getDocumentByFQN).not.toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('does nothing when the user has no default persona', async () => {
    seedRegistry(true);
    seedPersona(undefined);

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(getDocumentByFQN).not.toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('force-writes persona.appMode into useAppModeStore when present', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockResolvedValue({
      data: {
        personaPreferences: [
          { personaId: 'persona-1', personaName: 'analytics', appMode: 'ai' },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(getDocumentByFQN).toHaveBeenCalledWith('persona.analytics');
      expect(useAppModeStore.getState().currentMode).toBe('ai');
    });
  });

  it('leaves store alone when persona has no appMode', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockResolvedValue({
      data: {
        personaPreferences: [
          { personaId: 'persona-1', personaName: 'analytics' },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(getDocumentByFQN).toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('swallows fetch errors and leaves the store unchanged', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockRejectedValue(new Error('boom'));

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn test src/hooks/useSyncAppModeFromPersona.test.ts --watch=false
```

Expected: FAIL with `Cannot find module './useSyncAppModeFromPersona'`.

- [ ] **Step 3: Create the hook implementation**

Create `openmetadata-ui/src/main/resources/ui/src/hooks/useSyncAppModeFromPersona.ts`:

```ts
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

import { useEffect } from 'react';
import { EntityType } from '../enums/entity.enum';
import { Document } from '../generated/entity/docStore/document';
import {
  PersonaPreferences,
  UICustomization,
} from '../generated/system/ui/uiCustomization';
import { getDocumentByFQN } from '../rest/DocStoreAPI';
import { useApplicationStore } from './useApplicationStore';
import { writeAppMode } from './useAppMode';
import { useAppRoutesRegistry } from './useAppRoutesRegistry';

const resolveAppMode = (
  doc: Document | undefined,
  personaId: string
): string | undefined => {
  const preferences = (doc?.data as UICustomization | undefined)
    ?.personaPreferences;

  return preferences?.find(
    (entry: PersonaPreferences) => entry.personaId === personaId
  )?.appMode;
};

/**
 * On login (and whenever the user's default persona changes), fetch that
 * persona's UICustomization document and, if it defines an `appMode`, force
 * that mode into `useAppModeStore` via `writeAppMode`. When the persona has
 * no `appMode`, the store keeps its persisted localStorage value (which
 * itself defaults to DEFAULT_APP_MODE).
 *
 * No-ops when no non-default app mode is registered in `useAppRoutesRegistry`
 * — OM core stays mode-agnostic and only offers this pathway when a plugin
 * (e.g. Collate) registers additional routes.
 */
export const useSyncAppModeFromPersona = (): void => {
  const defaultPersonaId = useApplicationStore(
    (state) => state.currentUser?.defaultPersona?.id
  );
  const defaultPersonaName = useApplicationStore(
    (state) => state.currentUser?.defaultPersona?.name
  );
  const hasNonDefaultMode = useAppRoutesRegistry(
    (state) => Object.keys(state.routes).length > 0
  );

  useEffect(() => {
    if (!hasNonDefaultMode || !defaultPersonaId || !defaultPersonaName) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        const doc = await getDocumentByFQN(
          `${EntityType.PERSONA}.${defaultPersonaName}`
        );
        if (cancelled) {
          return;
        }
        const mode = resolveAppMode(doc, defaultPersonaId);
        if (mode) {
          writeAppMode(mode);
        }
      } catch {
        // Fetch failure is non-fatal: fall back to the existing
        // localStorage-backed mode. Do not toast here — this runs on
        // every login and would surface as noise for users without
        // customization docs.
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [defaultPersonaId, defaultPersonaName, hasNonDefaultMode]);
};
```

- [ ] **Step 4: Run the tests**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn test src/hooks/useSyncAppModeFromPersona.test.ts --watch=false
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Mount the hook in `AppRouter`**

Edit `openmetadata-ui/src/main/resources/ui/src/components/AppRouter/AppRouter.tsx`:

Add the import next to the other hook imports (line ~20):

```ts
import { useSyncAppModeFromPersona } from '../../hooks/useSyncAppModeFromPersona';
```

Inside the `AppRouter` component body, after the existing `useAppMode()` call (line ~82), add:

```ts
useSyncAppModeFromPersona();
```

- [ ] **Step 6: Run existing `AppRouter` tests to confirm no regression**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn test src/components/AppRouter/AppRouter.test.tsx --watch=false
```

Expected: all existing tests still PASS (the hook no-ops without a registered mode / default persona).

- [ ] **Step 7: Run the checkstyle sequence**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn organize-imports:cli src/hooks/useSyncAppModeFromPersona.ts src/hooks/useSyncAppModeFromPersona.test.ts src/components/AppRouter/AppRouter.tsx
yarn lint:fix
yarn pretty:base --write src/hooks/useSyncAppModeFromPersona.ts src/hooks/useSyncAppModeFromPersona.test.ts src/components/AppRouter/AppRouter.tsx
yarn license-header-fix src/hooks/useSyncAppModeFromPersona.ts src/hooks/useSyncAppModeFromPersona.test.ts
npx tsc --noEmit
```

Expected: clean exit; no formatter diff on rerun.

- [ ] **Step 8: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/hooks/useSyncAppModeFromPersona.ts openmetadata-ui/src/main/resources/ui/src/hooks/useSyncAppModeFromPersona.test.ts openmetadata-ui/src/main/resources/ui/src/components/AppRouter/AppRouter.tsx
git commit -m "feat(ui): sync app mode from default persona on login

Adds useSyncAppModeFromPersona hook that fetches the default persona's
UICustomization doc and force-writes its appMode into useAppModeStore
via writeAppMode. No-ops when useAppRoutesRegistry has no non-default
mode, keeping OM core mode-agnostic."
```

---

## Task 3: Editor page — `SettingsAppModePage`

**Files:**
- Create: `openmetadata-ui/src/main/resources/ui/src/pages/SettingsAppModePage/SettingsAppModePage.tsx`
- Create: `openmetadata-ui/src/main/resources/ui/src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx`

**Interfaces:**
- Consumes:
  - `PersonaPreferences` (Task 1) via `useCustomizeStore().document`.
  - `useCustomizeStore` selectors and `Document`/`UICustomization` types.
  - `DEFAULT_APP_MODE` from `constants/appMode.constants.ts`.
  - `useAppRoutesRegistry` for enumerating registered modes.
- Produces:
  - Named export `SettingsAppModePage: FC<{ onSave: (appMode: string) => Promise<void> }>` — consumed by `CustomizablePage` in Task 4. `onSave` receives the newly-chosen mode string (e.g. `"default"` or `"ai"`).

- [ ] **Step 1: Write the failing test**

Create `openmetadata-ui/src/main/resources/ui/src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx`:

```tsx
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

import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_APP_MODE } from '../../constants/appMode.constants';
import { useAppRoutesRegistry } from '../../hooks/useAppRoutesRegistry';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';
import { SettingsAppModePage } from './SettingsAppModePage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader',
  () => ({
    CustomizablePageHeader: ({
      onSave,
      onReset,
      disableSave,
    }: {
      onSave: () => void;
      onReset: () => void;
      disableSave: boolean;
    }) => (
      <div>
        <button
          data-testid="save-btn"
          disabled={disableSave}
          onClick={onSave}>
          save
        </button>
        <button data-testid="reset-btn" onClick={onReset}>
          reset
        </button>
      </div>
    ),
  })
);

const personaId = 'persona-1';

const seedDoc = (appMode?: string) => {
  useCustomizeStore.setState({
    document: {
      id: 'doc-1',
      name: 'persona.analytics',
      fullyQualifiedName: 'persona.analytics',
      entityType: 'persona' as never,
      data: {
        personaPreferences: [
          { personaId, personaName: 'analytics', appMode },
        ],
      },
    } as never,
    personaDetails: { id: personaId } as never,
  });
};

describe('SettingsAppModePage', () => {
  beforeEach(() => {
    useAppRoutesRegistry.setState({
      routes: { ai: (() => null) as never },
    });
    seedDoc(undefined);
  });

  it('renders Classic + registered non-default modes as options', () => {
    render(<SettingsAppModePage onSave={jest.fn()} />);

    expect(screen.getByTestId('app-mode-option-default')).toBeInTheDocument();
    expect(screen.getByTestId('app-mode-option-ai')).toBeInTheDocument();
  });

  it('selects the persisted appMode from the store on mount', () => {
    seedDoc('ai');
    render(<SettingsAppModePage onSave={jest.fn()} />);

    const aiOption = screen.getByTestId('app-mode-option-ai') as HTMLInputElement;

    expect(aiOption.checked).toBe(true);
  });

  it('falls back to DEFAULT_APP_MODE when no appMode is persisted', () => {
    render(<SettingsAppModePage onSave={jest.fn()} />);

    const defaultOption = screen.getByTestId(
      `app-mode-option-${DEFAULT_APP_MODE}`
    ) as HTMLInputElement;

    expect(defaultOption.checked).toBe(true);
  });

  it('disables save when selection equals persisted value', () => {
    seedDoc('ai');
    render(<SettingsAppModePage onSave={jest.fn()} />);

    expect((screen.getByTestId('save-btn') as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('enables save and calls onSave with the selected mode', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<SettingsAppModePage onSave={onSave} />);

    fireEvent.click(screen.getByTestId('app-mode-option-ai'));
    fireEvent.click(screen.getByTestId('save-btn'));

    expect(onSave).toHaveBeenCalledWith('ai');
  });

  it('reset returns the selection to DEFAULT_APP_MODE', () => {
    seedDoc('ai');
    render(<SettingsAppModePage onSave={jest.fn()} />);

    fireEvent.click(screen.getByTestId('reset-btn'));
    const defaultOption = screen.getByTestId(
      `app-mode-option-${DEFAULT_APP_MODE}`
    ) as HTMLInputElement;

    expect(defaultOption.checked).toBe(true);
  });

  it('shows a placeholder when no non-default mode is registered', () => {
    useAppRoutesRegistry.setState({ routes: {} });
    render(<SettingsAppModePage onSave={jest.fn()} />);

    expect(
      screen.getByTestId('app-mode-unavailable-placeholder')
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Extend `CustomizeStore` typings to expose `personaDetails`**

`SettingsAppModePage` and its test need to know which persona is being edited. The existing `CustomizeStore.ts` already stores enough via `document`, but `CustomizablePage.tsx` holds `personaDetails` in local state. To keep the component decoupled from the parent, extend the store.

Edit `openmetadata-ui/src/main/resources/ui/src/pages/CustomizablePage/CustomizeStore.ts` — add `personaDetails` alongside the other fields (place next to `currentPersonaDocStore`):

Add to the `CustomizePageStore` interface:

```ts
personaDetails: { id?: string; name?: string } | null;
setPersonaDetails: (
  persona: { id?: string; name?: string } | null
) => void;
```

Add to the `create<CustomizePageStore>` object:

```ts
personaDetails: null,
setPersonaDetails: (persona) => set({ personaDetails: persona }),
```

Then in `CustomizablePage.tsx`, after the existing `setPersonaDetails(personaDetails);` local state call inside `initializeCustomizeStore` (around the `setPersonaDetails(personaDetails)` local hook), also push to the store:

```ts
useCustomizeStore.getState().setPersonaDetails(personaDetails);
```

Add a matching reset in the `useEffect` cleanup already present at the bottom of `initializeCustomizeStore` if there is one; otherwise the mount/unmount lifecycle of `CustomizablePage` handles this naturally on the next persona load.

- [ ] **Step 3: Run the test to confirm it fails**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn test src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx --watch=false
```

Expected: FAIL with `Cannot find module './SettingsAppModePage'`.

- [ ] **Step 4: Create the component**

Create `openmetadata-ui/src/main/resources/ui/src/pages/SettingsAppModePage/SettingsAppModePage.tsx`:

```tsx
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

import { Card, Col, Radio, Row, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { NavigationBlocker } from '../../components/common/NavigationBlocker/NavigationBlocker';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { DEFAULT_APP_MODE } from '../../constants/appMode.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { PersonaPreferences } from '../../generated/system/ui/uiCustomization';
import { useAppRoutesRegistry } from '../../hooks/useAppRoutesRegistry';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';

interface Props {
  onSave: (appMode: string) => Promise<void>;
}

const labelFor = (
  t: (key: string, fallback?: { defaultValue: string }) => string,
  modeKey: string
): string => {
  if (modeKey === DEFAULT_APP_MODE) {
    return t('label.app-mode-classic');
  }

  return t(`label.app-mode-${modeKey}`, {
    defaultValue: modeKey,
  });
};

export const SettingsAppModePage = ({ onSave }: Props) => {
  const { t } = useTranslation();
  const { document, personaDetails } = useCustomizeStore();
  const nonDefaultModes = useAppRoutesRegistry((state) =>
    Object.keys(state.routes)
  );

  const persistedAppMode = useMemo(() => {
    const preferences = (
      document?.data?.personaPreferences ?? []
    ) as PersonaPreferences[];

    return (
      preferences.find((entry) => entry.personaId === personaDetails?.id)
        ?.appMode ?? DEFAULT_APP_MODE
    );
  }, [document, personaDetails?.id]);

  const [selectedMode, setSelectedMode] = useState<string>(persistedAppMode);

  const options = useMemo(
    () => [DEFAULT_APP_MODE, ...nonDefaultModes],
    [nonDefaultModes]
  );

  const disableSave = selectedMode === persistedAppMode;

  const handleSave = async () => {
    await onSave(selectedMode);
  };

  const handleReset = () => {
    setSelectedMode(DEFAULT_APP_MODE);
  };

  if (nonDefaultModes.length === 0) {
    return (
      <PageLayoutV1 className="bg-grey" pageTitle="Settings App Mode Page">
        <ErrorPlaceHolder
          className="m-t-lg"
          data-testid="app-mode-unavailable-placeholder"
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography.Paragraph className="w-max-500">
            {t('message.app-mode-not-available')}
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      </PageLayoutV1>
    );
  }

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1 className="bg-grey" pageTitle="Settings App Mode Page">
        <Row gutter={[0, 20]}>
          <Col span={24}>
            <CustomizablePageHeader
              disableSave={disableSave}
              personaName={t('label.customize-your-app-mode')}
              onReset={handleReset}
              onSave={handleSave}
            />
          </Col>

          <Col span={24}>
            <Card bordered={false} title={t('label.app-mode')}>
              <Typography.Paragraph type="secondary">
                {t('message.app-mode-description')}
              </Typography.Paragraph>

              <Radio.Group
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}>
                <Space direction="vertical">
                  {options.map((mode) => (
                    <Radio
                      data-testid={`app-mode-option-${mode}`}
                      key={mode}
                      value={mode}>
                      {labelFor(t, mode)}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            </Card>
          </Col>
        </Row>
      </PageLayoutV1>
    </NavigationBlocker>
  );
};
```

- [ ] **Step 5: Add the i18n keys**

(This is a partial i18n add; the full sync happens in Task 6, but the component needs the keys immediately for tests to render human-readable labels.)

Edit `openmetadata-ui/src/main/resources/ui/src/locale/languages/en-us/en-us.json` — add the following keys in their correct alphabetical positions:

- `label.app-mode`: `"App Mode"`
- `label.app-mode-ai`: `"AI"`
- `label.app-mode-classic`: `"Classic"`
- `label.customize-your-app-mode`: `"Customize Your App Mode"`
- `message.app-mode-description`: `"Choose the default experience users of this persona see when they log in. Classic is the standard UI; AI enables the assistant-driven experience."`
- `message.app-mode-not-available`: `"App mode selection is only available when an AI-enabled plugin is installed."`

Do NOT run `yarn i18n` yet — that happens in Task 6 after Task 5 also adds keys.

- [ ] **Step 6: Run the tests**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn test src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx --watch=false
```

Expected: all 7 tests PASS.

- [ ] **Step 7: Run the checkstyle sequence**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn organize-imports:cli src/pages/SettingsAppModePage/SettingsAppModePage.tsx src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx src/pages/CustomizablePage/CustomizeStore.ts src/pages/CustomizablePage/CustomizablePage.tsx
yarn lint:fix
yarn pretty:base --write src/pages/SettingsAppModePage/SettingsAppModePage.tsx src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx src/pages/CustomizablePage/CustomizeStore.ts src/pages/CustomizablePage/CustomizablePage.tsx
yarn license-header-fix src/pages/SettingsAppModePage/SettingsAppModePage.tsx src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx
npx tsc --noEmit
```

Expected: clean exit; no formatter diff on rerun.

- [ ] **Step 8: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/pages/SettingsAppModePage/ openmetadata-ui/src/main/resources/ui/src/pages/CustomizablePage/CustomizeStore.ts openmetadata-ui/src/main/resources/ui/src/pages/CustomizablePage/CustomizablePage.tsx openmetadata-ui/src/main/resources/ui/src/locale/languages/en-us/en-us.json
git commit -m "feat(ui): add SettingsAppModePage editor

Admin-editable persona App Mode picker (Classic / AI). Options come from
useAppRoutesRegistry; renders an unavailable-placeholder when no
non-default mode is registered. Shares persona context via CustomizeStore."
```

---

## Task 4: Wire `SettingsAppModePage` into `CustomizablePage`

**Files:**
- Modify: `openmetadata-ui/src/main/resources/ui/src/pages/CustomizablePage/CustomizablePage.tsx`

**Interfaces:**
- Consumes: `SettingsAppModePage` (Task 3), `PersonaPreferences` type (Task 1).
- Produces: URL route `/customize-persona/:fqn/app-mode` renders `SettingsAppModePage` and persists the chosen mode into the persona's `UICustomization.personaPreferences[].appMode`.

- [ ] **Step 1: Add `handleAppModeSave` to `CustomizablePage`**

Edit `openmetadata-ui/src/main/resources/ui/src/pages/CustomizablePage/CustomizablePage.tsx`.

Add the import next to the existing `SettingsNavigationPage` import:

```ts
import { SettingsAppModePage } from '../SettingsAppModePage/SettingsAppModePage';
```

Add the handler right after `handleBackgroundColorUpdate` (around line 250):

```tsx
const handleAppModeSave = async (appMode: string) => {
  if (!document) {
    return;
  }
  try {
    let response: Document;
    const newDoc = cloneDeep(document);
    const existing = (newDoc.data.personaPreferences ??
      []) as PersonaPreferences[];
    const match = existing.find(
      (persona) => persona.personaId === personaDetails?.id
    );

    newDoc.data.personaPreferences = match
      ? existing.map((persona) =>
          persona.personaId === personaDetails?.id
            ? { ...persona, appMode }
            : persona
        )
      : [
          ...existing,
          {
            personaId: personaDetails?.id ?? '',
            personaName: personaDetails?.name ?? '',
            appMode,
          },
        ];

    if (document.id) {
      const jsonPatch = compare(document, newDoc);
      response = await updateDocument(document.id ?? '', jsonPatch);
    } else {
      response = await createDocument({
        ...newDoc,
        domains: newDoc.domains
          ?.map((d) => d.fullyQualifiedName)
          .filter(Boolean) as string[],
      });
    }
    setDocument(response);

    showSuccessToast(
      t('server.page-layout-operation-success', {
        operation: document.id
          ? t('label.updated-lowercase')
          : t('label.created-lowercase'),
      })
    );
  } catch {
    showErrorToast(
      t('server.page-layout-operation-error', {
        operation: document.id
          ? t('label.updating-lowercase')
          : t('label.creating-lowercase'),
      })
    );
  }
};
```

Add the switch case inside the render `switch (pageFqn)` block (immediately after `case 'navigation':`):

```tsx
case 'app-mode':
  return <SettingsAppModePage onSave={handleAppModeSave} />;
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
cd openmetadata-ui/src/main/resources/ui
npx tsc --noEmit
```

Expected: no errors. If `newDoc.data.personaPreferences` isn't typed on the generated `Document.data` union, cast to `UICustomization` inline (`(newDoc.data as UICustomization).personaPreferences`) — mirrors what `handleBackgroundColorUpdate` does today with `personPreferences`.

- [ ] **Step 3: Add a `CustomizablePage` test for the new case**

Edit `openmetadata-ui/src/main/resources/ui/src/pages/CustomizablePage/CustomizablePage.test.tsx` and add a new test inside the top-level `describe` block:

```tsx
it('renders SettingsAppModePage when pageFqn is app-mode', async () => {
  mockUseRequiredParams.mockReturnValue({ pageFqn: 'app-mode' });

  render(<CustomizablePage />, { wrapper: MemoryRouter });

  await waitFor(() => {
    expect(screen.getByTestId('app-mode-option-default')).toBeInTheDocument();
  });
});
```

(Mock names — `mockUseRequiredParams`, wrapper — come from the existing test file. Match its patterns.)

- [ ] **Step 4: Run the test**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn test src/pages/CustomizablePage/CustomizablePage.test.tsx --watch=false
```

Expected: existing suite still passes; new test passes.

- [ ] **Step 5: Run the checkstyle sequence**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn organize-imports:cli src/pages/CustomizablePage/CustomizablePage.tsx src/pages/CustomizablePage/CustomizablePage.test.tsx
yarn lint:fix
yarn pretty:base --write src/pages/CustomizablePage/CustomizablePage.tsx src/pages/CustomizablePage/CustomizablePage.test.tsx
npx tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 6: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/pages/CustomizablePage/CustomizablePage.tsx openmetadata-ui/src/main/resources/ui/src/pages/CustomizablePage/CustomizablePage.test.tsx
git commit -m "feat(ui): route /customize-persona/:fqn/app-mode

Wires SettingsAppModePage into CustomizablePage, adds handleAppModeSave
that upserts personaPreferences[].appMode on the persona's
UICustomization doc."
```

---

## Task 5: Surface the entry — `PersonaClassBase` category + runtime gate

**Files:**
- Modify: `openmetadata-ui/src/main/resources/ui/src/utils/PersonaClassBase.ts`
- Modify: `openmetadata-ui/src/main/resources/ui/src/utils/PersonaClassBase.test.ts`
- Modify: `openmetadata-ui/src/main/resources/ui/src/components/Settings/Persona/CustomizeUI/CustomizeUI.tsx`
- Modify: `openmetadata-ui/src/main/resources/ui/src/pages/Persona/PersonaDetailsPage/PersonaDetailsPage.tsx`

**Interfaces:**
- Consumes: `useAppRoutesRegistry` (existing hook).
- Produces:
  - New `'app-mode'` entry returned from `personaClassBase.getCustomizePageCategories()`.
  - Runtime filter in `CustomizeUI` and `PersonaDetailsPage` removes it when the registry has no non-default mode.

- [ ] **Step 1: Add the `'app-mode'` icon key and category to `PersonaClassBase`**

Edit `openmetadata-ui/src/main/resources/ui/src/utils/PersonaClassBase.ts`.

Extend `CustomizeIconKeys` (around line 47):

```ts
export type CustomizeIconKeys =
  | PageType
  | 'govern'
  | 'dataAssets'
  | 'navigation'
  | 'app-mode';
```

Add an import for a suitable icon at the top (reuse an existing icon rather than adding a new SVG — pick `NavigationIcon` if no better fit exists in `../assets/svg/`, and add a TODO ticket in the commit message to swap it later if desired). If the codebase already has an icon named similar to `ai-mode`, `sparkle`, `wand`, prefer that. For this plan, reuse `NavigationIcon` as a placeholder:

```ts
['app-mode']: NavigationIcon,
```

Add the new entry to `getCustomizePageCategories()` immediately after the `'navigation'` entry:

```ts
{
  key: 'app-mode',
  label: i18n.t('label.app-mode'),
  isBeta: false,
  description: i18n.t('message.app-mode-description'),
  icon: entityIcons['app-mode'],
},
```

- [ ] **Step 2: Update `PersonaClassBase.test.ts`**

Edit `openmetadata-ui/src/main/resources/ui/src/utils/PersonaClassBase.test.ts`:

Add expectations for the new key inside the existing `describe('getEntityIcons')` block:

```ts
expect(icons['app-mode']).toBeDefined();
```

Update the ordered list assertion in `describe('getCustomizePageCategories')` to include `'app-mode'` in the returned keys.

- [ ] **Step 3: Filter the entry when no non-default mode is registered — `CustomizeUI`**

Edit `openmetadata-ui/src/main/resources/ui/src/components/Settings/Persona/CustomizeUI/CustomizeUI.tsx`:

Move the module-scope constant into the component body so the hook can be used:

Before:

```tsx
const categories = getCustomizePageCategories();
```

After: remove that line, and inside the component:

```tsx
const hasNonDefaultMode = useAppRoutesRegistry(
  (state) => Object.keys(state.routes).length > 0
);
const categories = useMemo(
  () =>
    getCustomizePageCategories().filter(
      (category) => category.key !== 'app-mode' || hasNonDefaultMode
    ),
  [hasNonDefaultMode]
);
```

Add imports:

```ts
import { useMemo } from 'react';
import { useAppRoutesRegistry } from '../../../../hooks/useAppRoutesRegistry';
```

- [ ] **Step 4: Same filter in `PersonaDetailsPage`**

Edit `openmetadata-ui/src/main/resources/ui/src/pages/Persona/PersonaDetailsPage/PersonaDetailsPage.tsx`:

Replace the `getCustomizePageCategories().find(...)` lookup with a filtered variant. Around line 102 the existing code is:

```ts
const category = getCustomizePageCategories().find(
  (item) => item.key === activeKey
);
```

Change to:

```ts
const category = useMemo(
  () =>
    getCustomizePageCategories()
      .filter(
        (item) => item.key !== 'app-mode' || hasNonDefaultMode
      )
      .find((item) => item.key === activeKey),
  [activeKey, hasNonDefaultMode]
);
```

Add at the top of the component body:

```ts
const hasNonDefaultMode = useAppRoutesRegistry(
  (state) => Object.keys(state.routes).length > 0
);
```

Add imports:

```ts
import { useMemo } from 'react'; // if not already imported
import { useAppRoutesRegistry } from '../../../hooks/useAppRoutesRegistry';
```

- [ ] **Step 5: Run tests**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn test src/utils/PersonaClassBase.test.ts src/utils/Persona/PersonaUtils.test.ts src/components/Settings/Persona/CustomizeUI src/pages/Persona/PersonaDetailsPage --watch=false
```

Expected: all pass. If `PersonaUtils.test.ts` has a keys-ordered assertion, extend it to include `'app-mode'`.

- [ ] **Step 6: Checkstyle sequence**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn organize-imports:cli src/utils/PersonaClassBase.ts src/utils/PersonaClassBase.test.ts src/components/Settings/Persona/CustomizeUI/CustomizeUI.tsx src/pages/Persona/PersonaDetailsPage/PersonaDetailsPage.tsx
yarn lint:fix
yarn pretty:base --write src/utils/PersonaClassBase.ts src/utils/PersonaClassBase.test.ts src/components/Settings/Persona/CustomizeUI/CustomizeUI.tsx src/pages/Persona/PersonaDetailsPage/PersonaDetailsPage.tsx
npx tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 7: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/utils/PersonaClassBase.ts openmetadata-ui/src/main/resources/ui/src/utils/PersonaClassBase.test.ts openmetadata-ui/src/main/resources/ui/src/components/Settings/Persona/CustomizeUI/CustomizeUI.tsx openmetadata-ui/src/main/resources/ui/src/pages/Persona/PersonaDetailsPage/PersonaDetailsPage.tsx
git commit -m "feat(ui): expose App Mode as a persona customize category

Adds 'app-mode' to PersonaClassBase.getCustomizePageCategories() and
filters it out at consumer sites when no non-default mode is registered
in useAppRoutesRegistry."
```

---

## Task 6: Finalize i18n

**Files:**
- Verify: `openmetadata-ui/src/main/resources/ui/src/locale/languages/en-us/en-us.json` (keys added in Task 3)
- Regenerate: 16 other locale files under `openmetadata-ui/.../ui/src/locale/languages/`

**Interfaces:** none. This task ensures CI's i18n sync check passes.

- [ ] **Step 1: Sync locales**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn i18n
```

Expected: 16 non-en-us locale files updated with placeholder entries for the new keys.

- [ ] **Step 2: Verify JSON keys are sorted (CI enforces this)**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn lint:fix
```

Expected: exit 0, no diff on rerun.

- [ ] **Step 3: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/locale/languages/
git commit -m "chore(ui): sync i18n locales for App Mode keys"
```

---

## Task 7: End-to-end sanity check

**Files:** none modified.

**Interfaces:** none.

- [ ] **Step 1: Full frontend typecheck + lint**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn ui-checkstyle:changed
npx tsc --noEmit
```

Expected: both clean.

- [ ] **Step 2: Focused test sweep**

```bash
cd openmetadata-ui/src/main/resources/ui
yarn test \
  src/hooks/useSyncAppModeFromPersona.test.ts \
  src/hooks/useAppMode.test.ts \
  src/components/AppRouter/AppRouter.test.tsx \
  src/pages/SettingsAppModePage/SettingsAppModePage.test.tsx \
  src/pages/CustomizablePage/CustomizablePage.test.tsx \
  src/utils/PersonaClassBase.test.ts \
  --watch=false
```

Expected: all pass.

- [ ] **Step 3: Manual smoke (only if Collate plugin is available locally)**

If a local dev environment has the Collate plugin loaded (`isAskCollateInstalled` true), start the UI, log in as an admin, navigate to Settings → Personas → pick a persona → Customize UI. Verify:

1. "App Mode" category is visible.
2. Selecting AI + Save shows the success toast.
3. Reloading the page keeps the selection.
4. Logging out and logging back in as a user whose default persona is this one lands them in AI mode routes (`useAppMode()` returns `'ai'` — verifiable via `localStorage.getItem('om.appMode')` in devtools).

If no Collate plugin is available, verify the negative gate instead: the "App Mode" category is *not* visible and hitting `/customize-persona/:fqn/app-mode` directly renders the unavailable placeholder.

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin lyon
gh pr create --base main --title "feat: persona-scoped App Mode preference" --body "$(cat <<'EOF'
## Summary
- Adds optional `appMode: string` to `PersonaPreferences` (BE + FE generated types).
- New `SettingsAppModePage` under Customize UI lets admins pick Classic / AI per persona.
- `useSyncAppModeFromPersona` (mounted in `AppRouter`) force-writes `defaultPersona.appMode` into `useAppModeStore` on login; unset → localStorage → `DEFAULT_APP_MODE` fallback.
- Whole feature gated on `useAppRoutesRegistry` containing any non-default mode — OM core stays mode-agnostic.

## Design
docs/superpowers/specs/2026-07-13-persona-app-mode-preference-design.md

## Test plan
- [ ] Jest unit + component tests pass (added in this PR)
- [ ] Manual: with Collate plugin loaded, admin can set persona App Mode = AI; user with that default persona lands in AI routes on next login
- [ ] Manual: without Collate plugin, "App Mode" category is hidden and the direct URL shows the unavailable placeholder

Related to open-metadata/openmetadata-collate#4903.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Deferred to a follow-up

- **Playwright end-to-end coverage** exercising the AI-mode landing behavior can only run in a build that includes the Collate plugin. Belongs in the downstream Collate PR that already registers `"ai"` mode.
- **User-facing override** (per-user App Mode toggle in the profile menu) is out of scope; the `personaPreferences` array already has room to grow into that if needed later.
- **Dedicated App Mode icon SVG** — Task 5 reuses `NavigationIcon` as a placeholder. Design can drop a real icon into `assets/svg/` in a follow-up PR that only touches `PersonaClassBase.ts`.

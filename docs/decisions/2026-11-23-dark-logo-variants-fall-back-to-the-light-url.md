# Dark-mode logo variants are optional and fall back to the light URL

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `BrandImage.test.tsx` ("dark mode variants"), `SidebarBrand.test.tsx`, `AppearanceConfigSettingsPage.test.tsx` ("keeps the dark-mode logo URLs"), `ThemeSettings.test.tsx` ("does not block saving on a saved logo URL that fails to load")
- **Related:** open-metadata/openmetadata-collate#8792, open-metadata/OpenMetadata#38435, open-metadata/openmetadata-collate#8858

## Context
`LogoConfiguration` had one URL per logo, so a dark-ink logo disappeared on the dark theme.
`customLogoDarkUrlPath` and `customMonogramDarkUrlPath` add a dark variant. Several writers
(the Platform Settings Theme form, the classic Appearance page, Collate) and several renderers
read the same `customUiThemePreference` setting, which is saved as a full replacement.

## Decision
- Both dark keys are optional. A renderer uses a dark key only when the resolved theme is dark
  and the key is non-empty; otherwise the light key, then the build's brand default.
- The resolved theme is the `ThemeProvider` theme, or the root `dark-mode` class on pages
  rendered without it (sign-in, register, password reset). Classic mode is always light.
- Every writer of `customLogoConfig` spreads the stored value before its own keys, so a writer
  without dark-mode fields never erases them. Reset clears every key.
- In the Theme form, only logo URLs edited in the current session can block Save (invalid,
  checking, or failing to load); a stored URL that no longer loads never blocks an unrelated change.

## Consequences
- No migration: an absent dark key means "use the light URL", so existing settings render as before.
- A new writer of `customLogoConfig` must merge over the stored value, not replace it.
- A new logo surface should render through `BrandImage` (or resolve the URL the same way) to
  honour the dark variant.

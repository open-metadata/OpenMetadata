# Step

## Metadata

| | |
| --- | --- |
| **Name** | Step |
| **Category** | Navigation / progress |
| **Status** | Legacy |
| **Styles** | [`src/styles/components/step.less`](../../src/styles/components/step.less) |
| **Component** | Ant Design `Steps` (legacy) — no core-components equivalent yet |

## Overview

**Use when** guiding the user through an ordered, multi-stage flow — service
creation, ingestion setup, task-resolution incident stages.

**Don't use when** the sections are non-sequential (use [Tabs](tabs.md)) or
the flow is a single screen — a stepper adds noise without a real sequence.

## Anatomy

```
  ●───────────●───────────○───────────○
  │           │           │           │
Connect    Configure   Schedule     Review   ← titles
completed   active      pending     pending
```

Parts: **step node** (`ingestion-rounder` / `ant-steps-item-icon`),
**connector tail** (`ant-steps-item-tail`), **title**, and a completed
checkmark (`::after` content `\2713`).

## Tokens used

| Part | Token |
| --- | --- |
| Node top offset / margin | `--om-space-2_4` |
| Node stacking | `--om-z-1` |
| Checkmark offset | `--om-space-4` |
| Checkmark size | `--om-font-size-xs` |
| Checkmark weight | `--om-font-weight-black` |
| Tail padding (vertical / horizontal) | `--om-space-3_5`, `--om-space-24` |
| Title size (small) | `--om-font-size-xs` |
| Incident-tail color | `--om-legacy-color-757575` |
| Active / completed accent (semantic) | `--om-color-fg-brand` |

> Legacy `@`-vars (`@primary-color`, `@primary-1`, and per-status `@purple/@blue/@yellow/@green`) carry color in the `.less`; new work should reference semantic tokens.

## Props / API

Ant Design `Steps` (`current`, `direction`, `size`, `status`, `Steps.Step`
with `title` / `icon`). No `@openmetadata/ui-core-components` component exists —
treat as legacy; do not build new steppers against a new API.

## States

| State | Treatment |
| --- | --- |
| Active (`process`) | node border `--om-color-fg-brand`; title `--om-color-text-primary` |
| Completed (`finish`) | filled node + checkmark; title `--om-color-fg-brand` |
| Pending (`wait`) | muted node/tail; default title color |
| Error / incident status | per-status icon tint (`new`, `ack`, `assigned`, `resolved`) |

## Code example

```less
.custom-step {
  .ingestion-rounder {
    margin-top: var(--om-space-2_4);
    z-index: var(--om-z-1);
  }
  .ingestion-rounder.active {
    border-color: var(--om-color-fg-brand);
  }
  .ingestion-rounder.completed::after {
    content: '\2713';
    font-size: var(--om-font-size-xs);
    font-weight: var(--om-font-weight-black);
    margin-top: calc(-1 * var(--om-space-4));
    color: var(--om-color-fg-brand);
  }
  .ant-steps-item-tail {
    padding: var(--om-space-3_5) var(--om-space-24);
  }
}
```

## Cross-references

- [Tabs](tabs.md) · [Form](form.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Spacing](../foundations/spacing.md), [Typography](../foundations/typography.md)

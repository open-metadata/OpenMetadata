# Modal

## Metadata

| | |
| --- | --- |
| **Name** | Modal |
| **Category** | Application |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Dialog` / `Modal` / `ModalOverlay` / `DialogTrigger` |
| **Source** | [`components/application/modals`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/application/modals) |

Go-forward (UntitledUI + Tailwind, `tw:` only). Legacy overlay spec: [../components/drawer.md](../components/drawer.md).

## Overview

**Use when** an action needs focused confirmation or a short form on top of the
current context — delete confirms, create/edit dialogs, alerts.

**Don't use when** the content is a full workflow or a side panel — use a
drawer / slide-out. One modal at a time; never stack.

## Anatomy

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← ModalOverlay (scrim + blur)
▓  ┌───────────────────────┐  ▓
▓  │ Title            [✕]  │  ▓  ← Dialog.Header + CloseButton
▓  ├───────────────────────┤  ▓
▓  │ Dialog.Content        │  ▓  ← body slot
▓  ├───────────────────────┤  ▓
▓  │        [Cancel][Save] │  ▓  ← Dialog.Footer (border-t)
▓  └───────────────────────┘  ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

Parts: **overlay/scrim** (`ModalOverlay`), **positioner** (`Modal`), **panel**
(`Dialog`) with compound **`Dialog.Header`**, **`Dialog.Content`**,
**`Dialog.Footer`**, plus **close button** and **`DialogTrigger`**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Scrim | `tw:bg-overlay/70` `tw:backdrop-blur-*` |
| Panel surface | `tw:bg-primary` `tw:rounded-2xl` `tw:shadow-xl` |
| Header title | `tw:text-md` `tw:font-semibold` `tw:text-primary` |
| Content stack | `tw:flex` `tw:flex-col` `tw:gap-4` |
| Footer divider | `tw:border-t` `tw:border-secondary` |
| Footer actions | `tw:gap-3` `tw:justify-end` |
| Enter / exit anim | `tw:animate-in tw:zoom-in-95` / `tw:animate-out tw:zoom-out-95` |

## Props / API

| Member / prop | Purpose |
| --- | --- |
| `ModalOverlay` | Scrim + scroll container (`AriaModalOverlayProps`: `isDismissable`, `isOpen`) |
| `Modal` | Positioner / animated panel wrapper |
| `Dialog` | Panel; `title`, `showCloseButton`, `width` (688), `onClose`, `panelClassName` |
| `Dialog.Header` / `Dialog.Content` / `Dialog.Footer` | Title, body, footer slots |
| `DialogTrigger` | Wraps a trigger element + the modal |

## States

| State | Treatment |
| --- | --- |
| Open | `tw:animate-in tw:fade-in` scrim + `tw:zoom-in-95` panel |
| Closed | `tw:animate-out tw:fade-out` / `tw:zoom-out-95`, then unmount |
| Scrim | `tw:bg-overlay/70` + `tw:backdrop-blur-*` dims the page |
| Close hover | `CloseButton` at `tw:absolute tw:top-3 tw:right-3` |

> Focus stays trapped via React Aria; focus ring uses `outline`, never
> `tw:ring-*` — see [../../docs/colors.md §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Dialog, Modal, ModalOverlay } from '@openmetadata/ui-core-components';

<ModalOverlay isDismissable isOpen={isOpen} onOpenChange={setOpen}>
  <Modal>
    <Dialog showCloseButton title={t('label.delete')} width={480}>
      <Dialog.Content className="tw:text-sm tw:text-tertiary">
        {t('message.are-you-sure')}
      </Dialog.Content>
      <Dialog.Footer>
        <Button color="secondary">{t('label.cancel')}</Button>
        <Button color="primary-destructive">{t('label.delete')}</Button>
      </Dialog.Footer>
    </Dialog>
  </Modal>
</ModalOverlay>;
```

## Cross-references

- [Table](table.md) · [Tabs](tabs.md) · [Pagination](pagination.md)
- [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md)

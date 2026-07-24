# Radius

Border-radius scale, mirroring the upstream `--radius-*` tokens. Raw
`border-radius` values are flagged as warnings by `yarn token-audit`.

## Scale

| Token | Value | Use |
| --- | --- | --- |
| `--om-radius-none` | 0 | square |
| `--om-radius-xs` | 2px | subtle |
| `--om-radius-sm` | 4px | inputs, small controls, tags |
| `--om-radius-md` | 6px | buttons |
| `--om-radius-lg` | 8px | cards, menus, popovers |
| `--om-radius-xl` | 12px | large cards, modals |
| `--om-radius-2xl` | 16px | |
| `--om-radius-3xl` | 24px | |
| `--om-radius-full` | 9999px | pills, avatars, circular controls |

Off-scale values in use (`--om-radius-10`, `-999`, and fractional such as
`--om-radius-3_2`) exist in the generated block. `--om-radius-999` and
`--om-radius-full` both produce pills; prefer `--om-radius-full`.

## Layers

- **Layer 1** `--ds-radius-*: var(--radius-*, <raw>)`.
- **Layer 2** `--om-radius-*: var(--ds-radius-*, <raw>)`.
- **Layer 3** `border-radius: var(--om-radius-lg);`

## Do / Don't

```less
/* DO */
border-radius: var(--om-radius-lg);
border-radius: var(--om-radius-full);

/* DON'T */
border-radius: 8px;
border-radius: 50%; /* prefer --om-radius-full for pills; 50% only for true circles */
```

## Cross-references

- [Elevation](elevation.md) · [Token reference](../tokens/token-reference.md)

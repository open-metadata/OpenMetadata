# Form Utilities — the `react-hook-form` + `react-aria` form stack

> **A form is `FieldProp[]` configs + RHF state + a pure transform.**

Everything below explains that sentence. "RHF" is [`react-hook-form`](https://react-hook-form.com/) — the state library this whole stack is built on. Whenever you see `useForm`, `Control`, `RegisterOptions`, `useController`, that's RHF.

## Scope — which form API is this?

The repo has **two** parallel form APIs. This document is about the **modern** one only.

| | Modern (this doc) | Legacy (not this doc) |
|---|---|---|
| Import from | `@openmetadata/ui-core-components` | `@utils/formUtils` |
| Foundation | `react-hook-form` + `react-aria-components`, Tailwind `tw:` | Ant Design `Form`/`Form.Item` |
| Bulk renderer | `FormFields` | `generateFormFields` |
| `FieldTypes` | `TEXT`, `SELECT`, `AUTOCOMPLETE`, … | also MUI-suffixed (`TEXT_MUI`, `SELECT_MUI`, …) |
| Source | `openmetadata-ui-core-components/.../components/application/form-field/` | `openmetadata-ui/.../src/utils/formUtils.tsx` |

Both export a `getField` and a `FieldProp` — they are **not** interchangeable. **Build all new forms on the modern stack.** If you land in `formUtils.tsx` (Ant Design), you're in the legacy API.

### Canonical worked example

The best living reference is the Domain/Data Product form. Read it alongside this doc:

- **Form + transform:** [`AddDomainForm.component.tsx`](../src/components/Domain/AddDomainForm/AddDomainForm.component.tsx) — every `FieldProp`, the pure `transformDomainFormData`, and two escape hatches (`description` via `RichTextEditor`, `glossaryTerms` via `MUIGlossaryTagSuggestion`).
- **Caller wiring:** [`DomainListPage.tsx`](../src/components/DomainListing/DomainListPage.tsx) — `useForm` → `transformDomainFormData` → `useFormDrawerWithHook` + `submitAndClose`.

### Where each symbol lives

| Symbol | Import from |
|---|---|
| `getField`, `Field`, `FormFields` | `@openmetadata/ui-core-components` |
| `HookForm`, `FormField` | `@openmetadata/ui-core-components` |
| `FormItemLabel`, `HintText` | `@openmetadata/ui-core-components` |
| `FieldProp`, `FieldTypes`, `FieldPropsMap` | `@openmetadata/ui-core-components` |
| `FormSelectItem`, `HelperTextType`, `FormItemLayout` | `@openmetadata/ui-core-components` |
| layout/primitives (`Box`, `Autocomplete`, `Avatar`, `Button`, `Dot`, …) | `@openmetadata/ui-core-components` |
| `useFormDrawerWithHook` | `@components/common/atoms/drawer` |
| `submitAndClose` | `@utils/FormDrawerUtils` |

Source files (read-only sources of truth):
- `openmetadata-ui-core-components/src/main/resources/ui/src/components/application/form-field/form-field.tsx` — `Field`, `getField`, `FormFields`
- `openmetadata-ui-core-components/src/main/resources/ui/src/components/application/form-field/form-field.types.ts` — `FieldProp`, `FieldTypes`, `FieldPropsMap`, `FormSelectItem`, `HelperTextType`, `FormItemLayout`
- `openmetadata-ui-core-components/src/main/resources/ui/src/components/base/form/hook-form.tsx` — `HookForm`, `FormField`, `useFormFieldContext`
- `openmetadata-ui-core-components/src/main/resources/ui/src/components/base/select/select.tsx` — `SelectItemType` (= `FormSelectItem`)
- `openmetadata-ui/src/main/resources/ui/src/components/common/atoms/drawer/useFormDrawer.tsx` — `useFormDrawerWithHook`
- `openmetadata-ui/src/main/resources/ui/src/utils/FormDrawerUtils.ts` — `submitAndClose`

---

## 1. The four objects in the room

| Object | What it is | Owns |
|---|---|---|
| `FieldProp` | A plain TypeScript object | The description of one input: name, type, label, validation rules |
| `useForm<T>()` | An RHF hook | The form's state (values, errors, touched, dirty, submitting) |
| `<HookForm>` | A React component | The wrapper that makes `form` accessible to the fields below it |
| `getField(fieldProp)` | A function returning a `ReactNode` | Turns a config into a rendered, validated, RHF-wired input |

The relationship:

```
useForm<T>()  ──provides──►  <HookForm form={...}>  ──makes available to──►  getField(fieldProp)
   (state)                     (provider wrapper)                              (renders one field)
                                                                                      ▲
                                                                                      │
                                                       FieldProp ──describes──────────┘
                                                       (config object)
```

**None of these is the form.** The form is the composition of all four, each knowing nothing about the others except through typed boundaries:
- `FieldProp` is just data — it doesn't know which form it'll be rendered in.
- `useForm<T>()` is just state — it doesn't know which fields will read from it.
- `<HookForm>` is just a wrapper — it renders no fields itself.
- `getField()` is just a renderer — it doesn't decide validation rules, it runs them.

This separation is what lets you test the transform without rendering, swap layouts without touching fields, and add field types without touching callers.

---

## 2. What's a `FieldProp`?

A plain object. No React, no closures, no state — just a description of one input.

```ts
const nameField: FieldProp = {
  name: 'name', // RHF field name — must match a key in your FormValues
  type: FieldTypes.TEXT, // which kind of input to render
  label: t('label.name'), // visible label above the input
  required: true, // renders the red `*` next to the label
  rules: {
    // RHF validation rules (RegisterOptions)
    required: t('label.field-required', { field: t('label.name') }),
    maxLength: { value: 128, message: t('message.entity-size-in-between', {...}) },
    pattern: { value: ENTITY_NAME_REGEX, message: t('message.entity-name-validation') },
  },
  props: { 'data-testid': 'name' }, // pass-through props for the rendered input
};
```

The mental shift: **`FieldProp` is data, not a component.** It says "I want a TEXT input named `name` with these rules." It doesn't know how to render itself — `getField` does that.

### The full shape

```ts
interface FieldProp {
  name: string;
  label: ReactNode;
  type: FieldTypes;
  required?: boolean;
  rules?: RegisterOptions; // RHF validation rules
  id?: string;
  placeholder?: string;
  props?: FieldPropsMap; // typed bag of per-type props
  helperText?: ReactNode;
  helperTextType?: HelperTextType; // enum: ALERT (default) | TOOLTIP
  showHelperText?: boolean;
  hasSeparator?: boolean;
  formItemLayout?: FormItemLayout; // enum: VERTICAL (default) | HORIZONTAL
}
```

| Field | Purpose |
|---|---|
| `name` | The RHF field name. Must be a key that exists in your `FormValues`. This binds the rendered input to the form's state. |
| `label` | Visible label above the input. `ReactNode`, so strings or JSX. |
| `type` | One of the `FieldTypes` enum values (see §4). Decides which primitive is rendered. |
| `required` | Renders the red `*`. It **also** injects a `required` rule when you didn't supply one (see §5) — but with RHF's default message, so still set `rules.required`. |
| `rules` | RHF's `RegisterOptions` — `required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `validate`, `deps`, etc. |
| `id` | DOM `id`. Convention: `'root/<name>'`. Useful for `<label for>` and Playwright targeting. Also used as the `FormFields` key. |
| `placeholder` | Native placeholder text. |
| `props` | The typed `FieldPropsMap` bag — per-type config (`options` for selects, `multiple` for autocompletes, `'data-testid'` for any field). See §4. |
| `helperText` | Extra context, shown as a yellow Alert below the field or as a label tooltip. |
| `helperTextType` | `HelperTextType.ALERT` (default — yellow Alert below) or `HelperTextType.TOOLTIP` (HelpCircle icon on the label). |
| `showHelperText` | Toggle helper-text rendering without removing `helperText`. |
| `hasSeparator` | When `true`, renders a `<Divider />` after this field. |
| `formItemLayout` | `FormItemLayout.VERTICAL` (default) or `HORIZONTAL`. |

### What is `RegisterOptions`?

RHF's validation-rules object. Common keys:

```ts
rules: {
  required: 'Name is required', // or just `true`
  minLength: { value: 1, message: 'Too short' },
  maxLength: { value: 128, message: 'Too long' },
  min: { value: 0, message: 'Must be positive' }, // numeric fields
  max: { value: 100, message: 'Too large' },
  pattern: { value: /^[A-Za-z]+$/, message: 'Letters only' },
  validate: (value, formValues) => value !== 'admin' || 'Reserved name',
  deps: ['otherField'], // re-validate when another field changes
}
```

Messages can be strings or values — always translate them via `t(...)`.

---

## 3. `getField(fieldProp)` — the only function you need to call

Given a config, render the input:

```tsx
<HookForm form={form} onSubmit={form.handleSubmit(onSubmit)}>
  {getField(nameField)}
</HookForm>
```

`getField` takes a `FieldProp` and returns a `ReactNode` that renders:

```
┌────────────────────────────────────┐
│ Label "Name *"                      │
│ <input>                             │
│ Error message (when invalid)        │
│ Helper text (optional)              │
│ Divider (optional, if hasSeparator) │
└────────────────────────────────────┘
```

with all of this handled for you:
- **Two-way binding** — the input's value is bound to RHF state for `name`. Typing updates state; `form.reset()` clears the input.
- **Validation** — rules from `FieldProp.rules` run per RHF defaults (on submit; on change after the first submit). Submit is blocked if any rule fails.
- **Error display** — when `fieldState.error` is populated, a red `HintText` renders below the field automatically.
- **Accessibility** — react-aria wiring; the field is marked `aria-invalid` when invalid and the label is linked to the input.

**You wire none of it by hand.**

### Hard requirements

- `getField` **must** render inside a `<HookForm>` (or any RHF `FormProvider`). That's how `Field` locates the form via `useFormContext()`. Render it outside and it throws.
- Each `name` in a form should be unique — two `getField`s with the same `name` bind to the same state.

### `getField` vs `<Field field={...}/>`

`getField(foo)` is literally `<Field field={foo}/>`:

```tsx
export const getField = (fieldProp: FieldProp): ReactNode => <Field field={fieldProp} />;
```

The helper exists only for JSX ergonomics — stacking ten `getField(x)` calls reads better than ten `<Field field={x}/>` elements. Either works; the codebase convention is `getField`.

---

## 4. The full landscape of `FieldTypes`

What you can ask `getField` to render:

```
Text inputs       │  TEXT, PASSWORD, NUMBER
Text areas        │  TEXTAREA, DESCRIPTION, FILTER_PATTERN, CRON_EDITOR
Booleans          │  SWITCH, CHECKBOX
Range             │  SLIDER
Single selects    │  SELECT, SELECT_NATIVE
Autocomplete (11) │  AUTOCOMPLETE, MULTI_SELECT, ASYNC_SELECT, TREE_ASYNC_SELECT,
                  │  TAG_SUGGESTION, UT_TAG_SUGGESTION, GLOSSARY_TAG_SUGGESTION,
                  │  USER_TEAM_SELECT, USER_MULTI_SELECT, USER_TEAM_SELECT_INPUT,
                  │  DOMAIN_SELECT
Pickers           │  COLOR_PICKER, ICON_PICKER, COVER_IMAGE_UPLOAD
Escape            │  COMPONENT
```

The enum (from `form-field.types.ts`):

```ts
enum FieldTypes {
  TEXT, PASSWORD, NUMBER,
  SELECT, AUTOCOMPLETE, MULTI_SELECT,
  SWITCH, CHECKBOX,
  TEXTAREA, DESCRIPTION, FILTER_PATTERN,
  SLIDER,
  ASYNC_SELECT, TREE_ASYNC_SELECT,
  TAG_SUGGESTION, UT_TAG_SUGGESTION, GLOSSARY_TAG_SUGGESTION,
  USER_TEAM_SELECT, USER_MULTI_SELECT, USER_TEAM_SELECT_INPUT,
  COLOR_PICKER, ICON_PICKER, COVER_IMAGE_UPLOAD,
  DOMAIN_SELECT, CRON_EDITOR, SELECT_NATIVE,
  COMPONENT,
}
```

### What `formValues.foo` should be typed as

Match your `FormValues` interface to the shape the field stores.

| Group | `formValues.foo` type |
|---|---|
| Text / area | `string` |
| Boolean | `boolean` |
| Range | `number` |
| Single select | `FormSelectItem \| null` |
| Autocomplete (single) | `FormSelectItem \| null` |
| Autocomplete (multi) | `FormSelectItem[]` |
| Color picker | `string` (hex) |
| Icon picker | `string` (icon id or URL) |
| Cover image | `CoverImageUploadValue \| null` (file/url + optional position) |

> To carry a typed domain payload on a select/autocomplete value, **extend** `FormSelectItem` — see "The Autocomplete contract" below.

`FormSelectItem` is the option/value shape used by every select and autocomplete. It is an alias of the base `SelectItemType`:

```ts
type FormSelectItem = SelectItemType;

type SelectItemType = {
  id: string;
  label?: string;
  avatarUrl?: string;
  isDisabled?: boolean;
  supportingText?: string;
  icon?: FC | ReactNode;
};
```

Note what the base shape does **not** have: no `value`, no `placeholder`, and `label` is an optional `string` (not `ReactNode`).

### When to use which type

**Text areas — what's the difference?**
- `TEXTAREA` — generic multi-line input.
- `DESCRIPTION` — semantically a description; renders as a TextArea today. Use it to signal intent at the call site.
- `FILTER_PATTERN`, `CRON_EDITOR` — semantically for filter/cron expressions.

**Selects — which one?**
- `SELECT` — single select, closed list of options, popover-based. Most "pick one of N" cases.
- `SELECT_NATIVE` — the HTML `<select>` element. Native mobile picker behavior.
- `AUTOCOMPLETE` — single select with search/filter. Long lists or server-backed search.
- `MULTI_SELECT` — multi-select with search.

**Autocomplete flavors — why so many?**
The 11 autocomplete-backed types render the same `<Autocomplete>` underneath. The separate enum values exist for **semantic clarity at the call site** (grep for "where do we render a tag suggestion?") and for **future per-type customization**. Use the one matching your data: `TAG_SUGGESTION` (classification tags), `UT_TAG_SUGGESTION` (untyped tags), `GLOSSARY_TAG_SUGGESTION` (glossary terms), `USER_TEAM_SELECT` (users only), `USER_TEAM_SELECT_INPUT` (users + teams), `USER_MULTI_SELECT` (multi-user), `DOMAIN_SELECT` (domains), `ASYNC_SELECT` (generic server-fetched single-select), `TREE_ASYNC_SELECT` (hierarchical async via `renderItem`).

**Pickers — specialized fields with their own UX.**
- `COLOR_PICKER` — grid of color swatches. Stores a hex string.
- `ICON_PICKER` — trigger button + popover icon grid (and optional URL tab). Stores the icon id or a URL string.
- `COVER_IMAGE_UPLOAD` — drop-zone + preview + optional reposition. Stores a file/URL plus position.

**`COMPONENT` — the inline escape hatch.**
Renders `props.children` directly inside the wrapper (so you keep the label + error scaffold). For one-off inline customs that handle their own state. If you need RHF wiring inside the children, prefer the `<FormField>` escape hatch in §7.

### The Autocomplete contract

**Store the full select item, not the ID.** Your `FormValues` for an autocomplete field should be `FormSelectItem` / `FormSelectItem[]` (or an extension of it), not `string` / `string[]`. This is what keeps the transform (form values → API payload) pure — it doesn't need the options list to rebuild the API object.

The base `FormSelectItem` has no `value` field, so to carry a typed payload you **extend it in your consumer** and add `value`. The Domain form does exactly this:

```ts
// AddDomainForm.interface.ts
interface DomainFormSelectItem extends FormSelectItem {
  value: TagLabel | EntityReference | DomainType | string;
}
```

When you build options, set `value` to the domain object:

```ts
const mapTagLabelToOption = (tagLabel: TagLabel): DomainFormSelectItem => ({
  id: tagLabel.tagFQN,
  label: getTagDisplay(tagLabel.displayName || tagLabel.name) || tagLabel.tagFQN,
  supportingText: tagLabel.displayName || tagLabel.name,
  value: tagLabel, // <-- your typed payload
});
```

The transform then reads `item.value` and never touches the options list:

```ts
const tags = formData.tags.map((item) => item.value as TagLabel);
```

### Per-type props (`FieldPropsMap`)

`props` on `FieldProp` is a typed bag. Common keys, grouped by which field types use them:

**Anywhere:** `'data-testid': string`, `disabled: boolean`.

**Selects / autocompletes:**
- `options: FormSelectItem[]` (or `items`) — the choices.
- `multiple: boolean` — explicit; do not rely on auto-detection.
- `filterOption: (option, searchText) => boolean` — return `() => true` to disable local filtering (use with server-side search).
- `onFocus: FocusEventHandler` — common pattern: lazy-fetch options on first focus.
- `onSearchChange: (value: string) => void` — wire to a debounced fetcher.
- `onSelectionChange`, `onItemInserted`, `onItemCleared` — selection hooks.
- `renderItem: (item) => ReactNode` — override option rendering (e.g. add per-option test-ids).
- `size: 'sm' | 'md'`, `fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl'`.

**Color picker:** `colors?: string[]` (defaults to the entity palette), `emptyStateLabel?: string`.

**Icon picker:** `options: FormSelectItem[]`, `defaultIcon?: { component: FC }`, `backgroundColor?: string`, `allowUrl?: boolean`, `labels?: IconPickerFieldLabels`.

**Cover image:** `acceptedFileTypes?: string[]`, `maxSizeMB?: number`, `maxDimensions?: { width, height }`, `onValidationError?: (message) => void` (fires a snackbar, not an inline error), `coverImageLabels?`, `validationMessages?`, `repositionable?: boolean`, `previewHeight?: number`, `renderPreview?`.

**Pass-through:** other keys (`onChange`, `onBlur`, …) are forwarded to the underlying primitive; RHF's own change/blur handlers still fire.

---

## 5. Validation

1. **Rules go on `FieldProp.rules`** — `required`, `minLength`, `maxLength`, `pattern`, `validate`, etc. Always with translated messages.
2. **Submit is gated.** `form.handleSubmit(onSubmit)` doesn't call your `onSubmit` if any rule fails.
3. **Errors render automatically.** Red `HintText` below the field, the input is marked invalid, and the drawer scrolls to the first invalid field.

You never write `onChange={(v) => setError(...)}` or render error JSX — the config carries the rules, the wrapper renders the errors.

### When does validation run?

Per RHF defaults: **on submit** (always; submit is blocked on failure) and **on change** after the first submit attempt. Opt into blur validation with `useForm({ mode: 'onBlur' })`. Defaults are fine for most forms.

### Async validation

`rules.validate` may return a Promise — useful for server-side checks:

```ts
rules: {
  validate: async (value) => {
    const exists = await checkNameExists(value);

    return exists ? t('message.name-already-exists') : true;
  },
}
```

Return `true`/`undefined` for valid, a string for invalid. RHF awaits the promise before allowing submit.

### `required: true` vs `rules.required`

`Field` normalizes them:

```ts
const effectiveRules: RegisterOptions = { ...rules };
if (required && !effectiveRules.required) {
  effectiveRules.required = true;
}
```

So `required: true` does two things: it renders the red `*` **and** — when you didn't supply `rules.required` — injects a `required: true` rule that gates submit. The catch: that injected rule has **no message**, so the user sees RHF's default. **Always set both** for a readable error:

```ts
required: true,
rules: { required: t('label.field-required', { field: t('label.name') }) },
```

### Conditional required

Pass `rules: undefined`, not `rules: {}`:

```ts
rules: domainTypeFieldRequired
  ? { required: t('label.field-required', { field: t('label.domain-type') }) }
  : undefined,
```

### Cross-field validation

Use `rules.validate` with the second argument (full form values) and `rules.deps` to re-validate:

```ts
{
  name: 'confirmPassword',
  rules: {
    validate: (value, formValues) =>
      value === formValues.password || t('message.passwords-must-match'),
    deps: ['password'], // re-validate when `password` changes
  },
}
```

---

## 6. Composing multiple fields

Three patterns; pick by layout needs.

### `<FormFields fields={[...]}>` — the bulk renderer

Vertical stack, array order. Use when fields don't need custom layout.

```tsx
<HookForm form={form}>
  <FormFields fields={[nameField, displayNameField, descriptionField, tagsField]} />
</HookForm>
```

Signature: `const FormFields: FC<{ fields: FieldProp[] }>`. Keys come from `field.id`, then `field.name`, then the array index — set `id` or `name` (you should anyway) to avoid re-render bugs when the array changes.

### Stacked `getField()` calls — manual layout

Use when you need rows, columns, or conditional rendering (this is what `AddDomainForm` does):

```tsx
<HookForm form={form}>
  <Box gap={4}>
    <div className="tw:flex-1">{getField(nameField)}</div>
    <div className="tw:flex-1">{getField(displayNameField)}</div>
  </Box>

  {type === DATA_PRODUCT && getField(domainField)}

  <div>{getField(tagsField)}</div>
</HookForm>
```

Wrap individual `getField` calls in any layout primitive (`Box`, `div`, `section`) and interleave non-field content.

### Mixed

`getField()` and `<FormFields>` are interchangeable — mix freely:

```tsx
<HookForm form={form}>
  <FormFields fields={basicInfoFields} />
  <Divider />
  <Box gap={4}>
    <div>{getField(iconField)}</div>
    <div>{getField(colorField)}</div>
  </Box>
  <FormFields fields={classificationFields} />
</HookForm>
```

### Conditional fields — two patterns

**Filter the array** (with `<FormFields>`):

```tsx
const fields = useMemo(
  () => [
    ...baseFields,
    ...(type === DATA_PRODUCT ? [domainField] : []),
    ...(type !== DATA_PRODUCT ? [domainTypeField] : []),
  ],
  [type]
);

<FormFields fields={fields} />;
```

**Inline `&&`** (with stacked `getField` calls):

```tsx
{type === DATA_PRODUCT && !parentDomain && (
  <div data-testid="domain-select">{getField(domainField)}</div>
)}
```

### Section dividers

Use `hasSeparator: true` on a `FieldProp` to emit a `<Divider />` after that field:

```ts
{ name: 'description', label: '...', type: FieldTypes.DESCRIPTION, hasSeparator: true },
{ name: 'tags', label: '...', type: FieldTypes.TAG_SUGGESTION },
```

---

## 7. The escape hatch

For inputs that don't fit any `FieldTypes` (e.g. `RichTextEditor`, `MUIGlossaryTagSuggestion`), drop to a direct `<FormField>` with a render-prop child:

```tsx
<FormField control={form.control} name="description" rules={{ required: t('...') }}>
  {({ field, fieldState }) => (
    <Box aria-invalid={fieldState.invalid || undefined} direction="col">
      <FormItemLabel label={t('label.description')} required />
      <RichTextEditor value={field.value} onTextChange={field.onChange} />
      {fieldState.error?.message && (
        <HintText isInvalid>{fieldState.error.message}</HintText>
      )}
    </Box>
  )}
</FormField>
```

Same RHF wiring, but you replicate the label/error scaffold by hand (~10 lines). The Domain form uses this for the description editor and the glossary tag picker.

> Rule of thumb: if you write the escape hatch twice for the same widget, add a new `FieldTypes` value for it.

### The pieces you'll use

| Export | What it is | Use for |
|---|---|---|
| `<FormField>` | The lower-level RHF wrapper `<Field>` is built on. Takes `control`, `name`, `rules?` and a render-prop child. | Wiring a custom widget to RHF state. |
| `controller.field` | `{ value, onChange, onBlur, name, ref }` — the RHF binding (with `validationBehavior: 'aria'` set). | Bind your widget's value/change/blur. |
| `controller.fieldState` | `{ invalid, error, isTouched, isDirty }`. | Show errors, set `aria-invalid`. |
| `<FormItemLabel>` | The label component `<Field>` uses. `{ label, required?, tooltip? }`. | Render the same `*`-and-tooltip label. |
| `<HintText isInvalid>` | The red error-text component `<Field>` uses. | Render the same-styled error below the input. |

Replicate these four and your escape-hatch field is visually and behaviorally indistinguishable from a typed `getField` one. Note: `useFormFieldContext()` throws if called outside a `<FormField>`.

### Two escape hatches, when to use which

- **`FieldTypes.COMPONENT`** — stays inside the typed-field flow; the `<Field>` wrapper still renders label + error around your `props.children`. For simple inline customs that handle their own state.
- **Direct `<FormField>`** — full control; you hand-roll the scaffold. For widgets with their own value/change handlers that must be wired to RHF (RichTextEditor, MUI components, etc.).

---

## 8. Putting it together

```
  Caller
  ├── const form = useForm<FormValues>({ defaultValues })
  ├── const handleSubmit = (data) => { ...transform → API... }
  │
  └── <HookForm form={form} onSubmit={form.handleSubmit(handleSubmit)}>
        {getField(nameField)}
        {getField(emailField)}
        <Box gap={4}>
          <div>{getField(roleField)}</div>
          <div>{getField(teamField)}</div>
        </Box>
        <button type="submit">Save</button>
      </HookForm>
```

Caller owns state and submit. `<HookForm>` provides the wrapper (and spreads remaining props — `className`, `data-testid`, `onSubmit` — onto the underlying react-aria `<Form>`). `getField` renders each input.

---

## 9. The complete caller pattern (with drawer)

For drawer-hosted forms (every consumer of `AddDomainForm`):

```tsx
const form = useForm<FormValues>({ defaultValues: FORM_DEFAULTS });
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = useCallback(
  async (data: FormValues) => {
    const payload = transformXFormData(data);
    setIsLoading(true);
    try {
      await createEntity(payload);
    } finally {
      setIsLoading(false);
    }
  },
  [...]
);

const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithHook<FormValues>({
  title: t('label.add-entity', { entity: t('label.x') }),
  hookForm: form,
  form: (
    <YourForm
      form={form}
      onSubmit={(data) => submitAndClose(data, handleSubmit, closeDrawer, refresh)}
    />
  ),
  onSubmit: (data) => submitAndClose(data, handleSubmit, closeDrawer, refresh),
  loading: isLoading,
});
```

### The three new pieces

**`useFormDrawerWithHook<T>(config)`** — wraps the form in a drawer with Save/Cancel buttons, backed by an RHF `UseFormReturn` you own. It delegates to `hookForm.handleSubmit(...)`, so RHF manages the full submission lifecycle. On validation failure it scrolls to the first `[aria-invalid="true"]` field; on cancel it runs `hookForm.reset()` then your `onCancel`. The submit button does **not** auto-close the drawer — the consumer closes it via `submitAndClose`.

```ts
useFormDrawerWithHook<T>(
  // = Omit<FormDrawerConfig<T>, 'onSubmit'> & { hookForm; onSubmit }
  {
    title: string | ReactNode;
    hookForm: UseFormReturn<T>;
    form: ReactNode; // the actual form JSX
    onSubmit: (data: T) => Promise<void> | void;
    onCancel?: () => void;
    loading?: boolean;
    submitLabel?: string; // defaults to t('label.save')
    cancelLabel?: string; // defaults to t('label.cancel')
    submitTestId?: string; // defaults to 'save-btn'
    cancelTestId?: string; // defaults to 'cancel-btn'
    headerActions?: ReactNode;
    footerAlign?: 'left' | 'center' | 'right' | 'space-between';
    closeOnEscape?: boolean;
    // + composite-drawer config (width, className via header/body/footer, …)
  }
) => {
  formDrawer: ReactNode; // render this in your tree
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  isOpen: boolean;
  isSubmitting: boolean;
};
```

> See `useFormDrawer.tsx` for the full config type (`FormDrawerConfig<T>` + `CompositeDrawerConfig`).

**`submitAndClose(data, handler, closeDrawer, onSuccess?)`** — awaits your handler, then closes the drawer and runs `onSuccess`. If the handler throws/rejects, `closeDrawer` and `onSuccess` are skipped — the drawer stays open for retry.

```ts
export const submitAndClose = async <T>(
  data: T,
  handler: (data: T) => Promise<void>,
  closeDrawer: () => void,
  onSuccess?: () => void
): Promise<void> => {
  await handler(data);
  closeDrawer();
  onSuccess?.();
};
```

Contract: success → close + `onSuccess`. Failure → error propagates, drawer stays open. **Never call `closeDrawer()` inside your handler** — `submitAndClose` decides.

**`transformXFormData(values, /* context */)`** — a pure function you write per form. Form values → API payload. Tested in isolation; no React, no async, no side effects. It is the single point of truth for shaping — every caller runs it. The Domain form's version:

```ts
export const transformDomainFormData = (
  formData: DomainFormValues,
  type: DomainFormType,
  parentDomain?: Domain
): CreateDomain | CreateDataProduct => {
  const tags = formData.tags.map((item) => item.value as TagLabel); // extract value
  const ownersList = formData.owners.map((item) => item.value as EntityReference);
  const style: { color?: string; iconURL?: string } = {};
  if (formData.color) {
    style.color = formData.color; // package style fields
  }
  // ...strip UI-only keys, merge tags + glossary, apply context-specific rules...

  return data;
};
```

### How the three fit together

```
User clicks Save in the drawer
    ↓
useFormDrawerWithHook calls hookForm.handleSubmit(...)
    ↓
RHF validates rules → on failure, scroll to first [aria-invalid] and stop
    ↓
On success, calls your onSubmit(data: FormValues)
    ↓
You call submitAndClose(data, handleSubmit, closeDrawer, refresh)
    ↓
submitAndClose awaits handleSubmit(data)
    ↓
Inside handleSubmit: transformXFormData(data) → API call
    ↓
Success → submitAndClose closes drawer + calls refresh
Error   → submitAndClose re-throws, drawer stays open for retry
```

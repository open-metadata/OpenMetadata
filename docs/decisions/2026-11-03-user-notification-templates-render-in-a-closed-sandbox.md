# User notification templates render in a closed sandbox

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `NotificationTemplateSandboxTest`, `SystemTemplateParityTest`, `AlertingArchitectureTest.templatesCompileOnlyInTheSandbox`, `ContentPreparationTest.unsupportedCustomTemplateFallsBack`, `UnsupportedNotificationTemplatesTest`, `NotificationTemplateSandboxIT`, `SystemTemplateParityTest.everyPackagedTemplatePassesTheCheck`
- **Related:** `alerting.content.template.sandbox.TemplateSandbox`, `HandlebarsProvider`, `HandlebarsNotificationTemplateProcessor`; ADR:2026-10-26-alerting-bounds-the-work-of-each-request-and-tick

## Context

Notification templates are written by users and rendered on the server for previews, test
sends and alert delivery. Handlebars, as the library sets it up by default, is a general
purpose engine: it resolves values on any Java object it is handed, loads other templates, and
registers built-in helpers that notification templates never use. Templates that users write
should reach only the data they are given and the helpers the product documents.

## Decision

Every template a user can write is checked and rendered by one engine, `TemplateSandbox`, built
in one place (`HandlebarsProvider`). No other main code builds a Handlebars engine, compiles a
template or applies one; `AlertingArchitectureTest` fails otherwise.

The sandbox offers exactly this, and nothing else:

| Part | What the sandbox does |
|---|---|
| Data | The context is converted once to plain data (maps, lists, text, numbers, booleans) with `JsonUtils`. Paths read map keys, list items and `length`; no Java method is resolved |
| Helpers | `if`, `unless`, `each`, `with`, `lookup`, and the product helpers listed in `HandlebarsProvider`. What a product helper returns is converted to plain data too. No other built-in helper, no helper from a script, object or class, and no helper added after the sandbox is built |
| Other templates | None. There is no template loader, so partials, partial blocks and inline partials are unavailable |
| Syntax | Decorators, custom delimiters and raw blocks are refused |

The check runs on every create, update, patch, validation, preview, test send and render. It
reads the template with the Handlebars lexer itself, so it sees the template as the engine
does. Delimiter changes are refused because the lexer keeps the default delimiters after one,
which would let a check and the engine read the same text differently.

A refused template is answered the way a syntax error is: 400 on create, update and patch,
and `isValid: false` with the reason on validate, render and send, which the template editor
already shows.

Templates stored before this decision are checked by the 2.1.0 migration. A user template that
uses a refused construct is left as it is and named in the log; at delivery, an alert whose own
template is refused renders the system template for the event instead, with a warning. A system
template is what every alert falls back to, so one that an admin edited into a refused form is
reset to its packaged default, as the Reset action does; the edited version stays in its version
history and the migration names it in the log. Every packaged default passes the check, so a
system template can always render.

## Consequences

What a template can do is decided in one class and checked by tests, so adding a helper or a
data field cannot widen it by accident. A template that called a Java method through a path,
for example `{{entity.name.length}}` on text, now renders that part empty; the `length` helper
does the same job. Every shipped template renders the same text as before
(`SystemTemplateParityTest`). The check depends on the Handlebars lexer's token types, which
sit in the library's internal package; a Handlebars upgrade must keep these tests green.
Limits on the work of one render belong in the same class, beside the data and helpers it
already owns. Revisit when templates need to share fragments: that would be a registry of
named fragments inside the sandbox, never a loader.

# Observability Alerts

Observability alerts watch your data assets and notify your team the moment something happens — a failed test, a schema change, or a pipeline failure — so issues are caught before stakeholders notice them.

An alert is assembled from four parts, in this order:

1. **Source** — the kind of asset to watch
2. **Filters** — which of those assets to watch
3. **Trigger** — what has to happen to them
4. **Destination** — who gets told, and how

$$section
### Name $(id="name")

The display name for this alert. It identifies the alert in the alerts list and in its activity history, and can be changed later.

**Guidelines:**

- Describe what the alert watches, not just the asset it watches
- Include the scope if you run several similar alerts, so they stay distinguishable in the list

**Examples:**

- `Orders Table — Test Failures`
- `Schema Changes — Finance Domain`
- `Nightly Ingestion Failures`

Avoid names like `Alert 1` or `Table Alert`, which become impossible to tell apart once you have a dozen of them.
$$

$$section
### Description $(id="description")

Optional context explaining why this alert exists and who should act on it. This is shown to anyone reviewing or editing the alert later — including the person who has to decide whether it is still needed.

**Worth capturing:**

- What problem the alert is meant to catch
- Which team owns the response
- What the on-call person should do when it fires

**Example:**

> Fires when any test on the orders pipeline fails. Owned by the Data Platform team. On failure, check the nightly ingestion run first — most failures are upstream freshness, not a genuine data defect.
$$

$$section
### Source $(id="source")

The type of asset this alert watches. Choose from **Table**, **Topic**, **Container**, **Pipeline**, **Ingestion Pipeline**, **Test Case**, **Test Suite**, or **Data Contract**.

The source is the first choice because it determines everything after it — each asset type emits its own events, so the available filters and triggers change with it. Changing the source later resets the filters, triggers, and destinations you have configured.

**Examples:**

- **Test Case** — to hear about data quality failures
- **Ingestion Pipeline** — to hear when a scheduled ingestion run fails
- **Table** — to hear about schema changes or metric shifts on a dataset
$$

$$section
### Filters $(id="filters")

Filters scope the alert to the assets you care about. Without them, the alert applies to **every** asset of the selected source type — which is usually far noisier than intended.

Most sources support:

- **Entity Specific Name** — match named assets by fully qualified name
- **Owner Name** — match by the asset's owner
- **Domain** — match everything belonging to a domain
- **Filter By Updater Is Bot** — match changes made by automated processes

Test Case alerts add **Table Name a Test Case Belongs To**, so you can watch every test on a given table without listing them individually.

Each filter has an **Include** toggle. With Include **on**, an event meeting the filter condition sends the alert. With Include **off**, a matching event silences it instead.

**Examples:**

- Include *Domain = Finance* — only assets belonging to the Finance domain
- Include off, *Filter By Updater Is Bot* — silence ingestion-bot churn and only hear about human changes
- Include *Table Name = `prod.sales.orders`* — every test on the orders table

**Guidelines:**

- Start broad, then narrow once you see how often it fires
- Prefer silencing a small noisy set over enumerating everything you want included
$$

$$section
### Trigger $(id="trigger")

The events that cause this alert to fire. Filters decide **which assets** are watched; triggers decide **what has to happen** to them before anyone is notified.

The available triggers depend on the source:

- **Schema Changes** (Table, Topic, Container) — fires on added, deleted, or updated columns
- **Metric Updates** (Table) — fires when table metrics are updated
- **Pipeline Status** (Pipeline, Ingestion Pipeline) — fires when execution is `Failed` or `Pending`
- **Test Case Status** (Test Case) — fires when tests are `Failed`, `Aborted`, or `Queued`, with a variant scoped to a Test Suite

Triggers carry the same **Include** toggle as filters, so a trigger can be inverted to fire on everything *except* the selected events.

**Example:**

> Source **Test Case**, trigger *Test Case Status Updates* with status `Failed`. Pair it with a filter on *Table Name a Test Case Belongs To* so you only hear about failures on the tables you own, rather than every failing test in the platform.

Select only the events your team will act on. Every extra trigger increases how often the alert fires, and an alert that fires too often stops being read.
$$

$$section
### Destination $(id="destinations")

Where notifications are delivered when the alert fires. Each destination is two choices:

- **Destination** — *who* is notified. Either people derived from the asset (**Owners**, **Followers**, **Assignees**, **Mentions**), a fixed audience (**Users**, **Teams**, **Admins**), or **External** for an outside system.
- **Type** — *how* an External destination delivers: **Email**, **Slack**, **MS Teams**, **G Chat**, or a generic **Webhook**.

Routing to **Owners** or **Followers** keeps the alert accurate as ownership changes, without anyone editing it — a good default for alerts that follow a dataset rather than a team.

**Examples:**

- *Owners* → *Email* — tell whoever currently owns the failing asset
- *Teams: Data Platform* → *Slack* — post to the team channel regardless of ownership
- *External* → *Webhook* — forward to PagerDuty or an internal service

**Guidelines:**

- Add more than one destination when different audiences need the same event — for example the owner by email and the team in Slack
- External destinations can carry a custom notification template, configured below, to control the subject and body
$$

$$section
### Notification Template $(id="notificationTemplate")

Controls the wording of the message this alert sends — its subject line and body. The alert still fires on exactly the same events either way; only the text changes.

**The options:**

- **System Default Templates** — the built-in wording, used when you choose nothing else. Sensible for most alerts and requires no upkeep.
- **A saved template** — one already created in Notification Templates and reusable across alerts. Its name, subject, and body are shown below the picker for reference, read-only; edit it from Notification Templates to change it everywhere it is used.
- **Create Custom Template** — wording written here and belonging to this alert alone. Editing it affects no other alert.

**Writing a custom template:**

Subject and body support Handlebars placeholders, so one template adapts to whatever event fired it. Values are nested under two objects:

- `entity` — the asset the event happened to: `{{entity.name}}`, `{{entity.displayName}}`, `{{entity.fullyQualifiedName}}`, `{{entity.updatedBy}}`
- `event` — the event itself: `{{event.eventType}}`, `{{event.entityType}}`, `{{event.userName}}`, `{{event.timestamp}}`

`{{publisherName}}` (the alert's own name) and `{{emailingEntity}}` are also available at the top level.

Helpers cover what a plain value cannot — `{{buildEntityUrl entity}}` for a link back to the asset, `{{formatDate event.timestamp}}` for a readable time, and `{{camelCaseToTitle name}}` to turn a field name into a readable label. Each helper takes an argument — writing one on its own resolves to nothing. Type `{{` in either field to browse the full set.

Use **Validate** before saving. It checks Handlebars *syntax*, not whether a placeholder actually resolves — a misspelt or non-existent one passes validation and renders as empty text in the delivered message.

**Example:**

> Subject: `[{{event.eventType}}] {{entity.displayName}} needs attention`
> Body: `{{event.entityType}} {{entity.fullyQualifiedName}} changed. View it at {{buildEntityUrl entity}}.`

**Guidelines:**

- Reach for a saved template when several alerts should sound alike — it keeps the wording in one place
- Reach for a custom template when this alert needs wording nothing else shares
- Put the entity name in the subject; recipients triage on the subject line alone
$$

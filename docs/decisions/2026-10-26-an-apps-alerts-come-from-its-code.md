# An app's alerts come from its own code, and only the server records them on the app

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `AppEventSubscriptionRemovalIT`, `AppRepositoryEventSubscriptionsTest`
- **Related:** [PR #36251](https://github.com/open-metadata/OpenMetadata/pull/36251), [PR #36252](https://github.com/open-metadata/OpenMetadata/pull/36252); `AppRepository.addEventSubscription` / `deleteEventSubscription`, `ApplicationHandler`, 2.0.8 `postDataMigrationSQLScript.sql`, `migration.utils.v208.AppCreatedAlerts`

## Context

Apps used alerts (event subscriptions) in two ways. An app's own code could create the alerts it
needs, for example a consumer of the change-event stream that runs the app's own class, and record
them on the app. Separately, every install created the alerts listed in the app's marketplace
definition. A definition is data its owner can edit, and those alerts were created without the
permission check that `POST /v1/events/subscriptions` applies, so editing a definition was enough
to create any alert. No shipped app listed alerts in its definition. The app's own list was also a
copy kept in the app's JSON, which the app's owner could edit, and deleting the app deleted every
alert in that copy.

## Decision

- A marketplace definition carries no alerts. `eventSubscriptions` is not part of
  `appMarketPlaceDefinition.json` or `createAppMarketPlaceDefinitionReq.json`; a request that sends
  it is refused with a 400, and installing an app creates no alert by itself.
- An app's code creates the alerts it needs and records each with
  `AppRepository.addEventSubscription`, and drops it with `deleteEventSubscription`.
- The app→alert `CONTAINS` relationship is the only record. `App.eventSubscriptions` is filled from
  it on every read, never stored in the app's JSON or its versions, and a PATCH on it is refused
  with a 400.
- On upgrade, an alert linked to an app that is named in its stored definition, or that uses the
  default alert consumer, is treated as created from a definition: it is disabled, kept for an
  admin to review, and unlinked. Alerts an app's code created run their own consumer and stay
  enabled and linked.

## Consequences

Editing a definition or an app can no longer create an alert or reach another user's alert, while
apps that need the change-event stream keep working as before. Deleting an app still deletes the
alerts its code created, through the relationship. If declarative alerts are ever needed again,
they belong in the app's shipped code, deliver only to the app's own consumer, and are created and
protected by the server; they never come from data a user can edit.

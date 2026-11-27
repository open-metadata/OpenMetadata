# An alert names its consumer by a registered id, and every alert job is stored with ConsumerJob

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial) · v2 2026-10-14 (consumers load at startup; what a rolling update costs)
- **Deciders:** Adrià Manero
- **Guard:** `ConsumersTest`, `EventSubscriptionMapperTest`, `ConsumerIdMigrationIT`, `AlertStateIT.everyJobUsesTheConsumerJobAndCarriesNoData`, `AlertReconcilerIT.reconcilerConvertsJobsStoredWithTheNamedClass`, `.jobWhoseClassIsNotAJobIsReplacedAndTheSchedulerCarriesOn`
- **Related:** [#35030](https://github.com/open-metadata/OpenMetadata/issues/35030), [PR #35032](https://github.com/open-metadata/OpenMetadata/pull/35032), Collate [PR #7259](https://github.com/open-metadata/openmetadata-collate/pull/7259); `events.consumer.ConsumerProvider`, `Consumers`, `ConsumerJob`; v210 `ConsumerIdMigration`

## Context

`EventSubscription.className` stored the consumer's Java class name, `AlertPublisher` by default,
and the API loaded whatever class a client named with `Class.forName`, checked only by package
prefix. Quartz stored every alert job under a consumer class too. So class names were data in two
tables: moving a consumer class left alerts and jobs naming a class that no longer exists, and
Quartz puts the trigger of a job it cannot load into an error state. A stored job whose class
loads but is no longer a Quartz `Job` is worse: Quartz then acquires no trigger at all until the
job is replaced. That blocks moving the alerting classes into their packages and making consumers
plain classes.

## Decision

An alert's `className` holds the id its `ConsumerProvider` registers, never a Java class.
Providers are found with `ServiceLoader`. `alert` (`Consumers.DEFAULT`) is the consumer every
alert uses unless it names another; ids registered outside OpenMetadata carry a namespace, such as
Collate's `collate.creditUsage` and `collate.reverseMetadata`. An id never changes once released.

A provider may list aliases: the class names its consumer was stored under before ids. An alias
finds its consumer, and a create or PUT that sends one stores the id instead. A name no provider
answers to is refused with a 400. The server loads the providers when it starts, next to the alert
catalog, so two providers that answer to one name leave alerting off from the start, with that
name in the log, as a catalog that does not load does. A provider declares its consumer's kind,
which must match the kind the consumer's class declares.

Every alert job is stored with `org.openmetadata.service.events.consumer.ConsumerJob`, the
runtime's own job class. It is not a consumer; it runs the consumer the alert row names. The
2.1.0 migration rewrites each stored `className` to its id and every job in `OMAlertJobGroup` to
`ConsumerJob`, and the startup re-arm and the reconciler store again any job that names another
class. `ConsumerJob` keeps its package and name until the Quartz alert driver is retired, because
it is the one class name the database stores.

## Consequences

A consumer class can move, be renamed or stop being a Quartz job without a data migration, and
the API never loads a class a client names. The field keeps the name `className` so the wire shape
does not change; renaming it is a wire change for a later release.

During a rolling update from a release before 2.1, the old server still runs alerts. It cannot
load `ConsumerJob`, so every alert trigger it picks up goes into an error state, and a job it
stores names its consumer's class. `AbstractEventConsumer` keeps a deprecated `execute` that runs
`ConsumerJob` until 2.3, but that only helps a consumer whose class kept its name, such as
Collate's reverse metadata and credit usage consumers. The default consumer's class moved, so a
job stored under its old name does not load on the new server either. The new server's re-arm and
reconciler treat a job they cannot load as missing and store it again. So an alert can stall for
as long as the update lasts plus one reconcile round, ten minutes. Its position is kept in the
database, so it then sends everything it missed: notifications are late, never lost.

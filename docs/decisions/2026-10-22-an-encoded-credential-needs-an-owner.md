# An encoded credential is only accepted on a user path when the entity already holds it, or it points outside the managed namespace

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial); v2 2026-10-23 (the PATCH pipeline's prepare pass is a
  re-storage after the masker pass, and an HTTP request body is typed before its provenance is
  checked); v3 2026-10-27 (an own-base reference must be the exact per-field id, and provider
  identifier forms are canonicalized before classification); v4 2026-10-28 (padded provider names
  are canonicalized, an own ARN's AWS-generated suffix is accepted, a TEST_CONNECTION run of a
  named service requires EditAll on it at create and trigger alike, and the version-checked store
  encrypts); v5 2026-10-28 (the pipeline's version-checked store encrypts too, the row version is
  locked before an external vault write, the trigger re-validates a stored row, EditAll on the
  named service applies while it exists, and the workflow secrets migration runs)
- **Deciders:** reviewers of the foreign-credential-rejection PR
- **Guard:** `DBSecretsManagerTest#testEncryptRejectsAForeignFernetToken`,
  `ExternalSecretsManagerTest#testEncryptRejectsAReferenceToAnotherEntitysSecret` and
  `#testEncryptRejectsAReferenceWhoseServiceNameExtendsTheEntitysName`,
  `AWSSSMSecretsManagerTest#testEncryptRejectsAnArnReferenceToAnotherEntitysSecret`,
  `AWSSecretsManagerTest#testEncryptRejectsAnArnReferenceToAnotherEntitysSecret`,
  `PasswordEntityMaskerForeignCredentialTest` (all fail if the guards are removed);
  `ExternalSecretsManagerTest#testStoredWorkflowTriggerRejectsAnotherServicesReference`,
  `EntityRepositoryStoredVersionLockTest` and `IngestionPipelineStoredCredentialStoreTest`
  (the version-checked store and its stale-version lock);
  `SecretsManagerCredentialValidationIT` and `SecretsManagerNullSecretIT` (end-to-end over the
  service API — the latter also pins the rename PATCH and the TEST_CONNECTION echo over HTTP)
- **Related:** `SecretsManager#requireOwnCredential`, `PasswordEntityMasker#requireOwnStoredValue`

## Context

The encrypt walk accepted any value a password field arrived with. A Fernet token submitted on a
user path was decrypted with the server's own key and re-stored as the submitting entity's
credential, and a `secret:` reference was stored verbatim. Either way the entity ends up owning a
value that was never handed to it as a plain credential: the stored field resolves, at use time,
whatever the token or the reference points at — a secret stored under another entity's path — and
the hard delete follows a reference under its own base while leaving a user-supplied one, so the
entity and the vault disagree about which secrets belong to it.

No legitimate round trip feeds an encoded value into the encrypt walk from a user path: the masker
restores a masked field from the stored original, and an unmask-permitted user echoes back what the
unmask handed them — the stored value's *resolved* form. Values the server itself re-stores
(secrets-manager migrations, patch restores) are copies it already holds.

## Decision

Two layers validate, and a third classifies the callers:

1. **Encrypt (`SecretsManager#requireOwnCredential`)** — on a *strict* path (user create, bulk
   create) a Fernet token is always rejected, and a `secret:` reference only when it falls inside
   the deployment's managed namespace (`buildSecretId(true)`) and outside the entity's own
   accepted bases. A reference outside the namespace points into a vault the submitter manages
   themselves — the ingestion framework resolves those at runtime and the delete walker leaves
   them alone — so it stays allowed. *Internal re-storage* paths (`CredentialPolicy` with
   `internalReStorage`) store copies the server already holds and are exempt.
2. **Unmask (`PasswordEntityMasker#requireOwnStoredValue`)** — every user update is validated
   against the original's stored value before it reaches the internal re-storage cell: an encoded
   field survives only byte-equal to the value the field already holds, as stored or as resolved.
   A submission with nothing stored to compare against — a connection a patch adds where none was
   stored — is still walked, and an encoded value is rejected there: with no owner on record it
   cannot be the entity's own. The unmask walk covers what the encrypt walk encrypts
   (`DO_NOT_UNMASK_CLASSES` mirrors the encrypter's skip set), so a bot's JWT token — visible
   through the mask — is validated too.
3. **Callers pick the policy** — `storeEntity(update=true)` and the `SecretsManagerUpdateService`
   migrations pass internal re-storage (the update cells are safe only because the masker
   validated first); creates and bulk creates stay strict.
4. **A second prepare pass in the same request is a re-storage, not a submission** — the PUT
   create-or-update path prepares the entity twice: once at the resource boundary on the user's
   submission, and once more in the create pipeline on what the first pass encrypted. The second
   pass cannot be strict — it would reject the first pass's own encrypted output as a foreign
   credential — so `EntityRepository#createPrepared` marks it (`prepare(entity, update, reStore)`)
   and the service connection is re-stored under internal re-storage. A repository whose `prepare`
   encrypts must thread the flag; the default delegates to the 2-argument `prepare` unchanged.
   The PATCH pipeline's prepare pass carries the same mark (`preparePatched` →
   `prepareInternal(updated, true, true)`): the masker pass ahead of it (`restorePatchSecrets`)
   has already validated every encoded value against the stored copy, so the pass after it stores
   what the masker accepted. Without the mark, an edit that never touches the connection — a
   rename — would re-validate the stored reference against the *renamed* service's accepted bases
   and reject the entity's own stored credential. The mark must not reach the resource boundary:
   `EntityResource#createOrUpdate` prepares with `update == true` before deciding whether the
   request creates, so keying the softening off the `update` flag would exempt the PUT create leg.
5. **A raw HTTP request body is typed before its provenance can be checked** — a TEST_CONNECTION
   workflow submitted over HTTP reaches `WorkflowResource#unmask` with its request as raw JSON,
   not a `TestServiceConnectionRequest`. The resource converts it first; otherwise the
   stored-service lookup cannot see the request's service reference, the comparison base comes
   back null, and the echo of the tested service's own reference is rejected as a credential with
   no owner.

The comparison is lower-cased: `buildSecretId` lower-cases every id it builds, and Azure Key Vault
resolves names case-insensitively, so a case variant of a stored reference must not slip out of the
namespace. A rejection names the field and never echoes the submitted value — the value may be a
credential, and it does not belong in the logs.

## Consequences

An entity can no longer be given another entity's Fernet token or managed reference: the store
fails with a 400 naming the field. User-supplied references into the deployment's own namespace
are only accepted by the entity whose base they fall under — so a cross-cluster import that carries
references still resolves nothing in the target and is rejected; export with secrets visible and
re-import as plaintext still works. The test-before-save corner (a TEST_CONNECTION workflow with
no stored service behind it) accepts plaintext and external references and rejects managed ones,
since there is nothing to compare against. Collate-side re-storage call sites (query runner config,
context plugin connections) must use the new internal re-storage overloads or strict defaults will
reject their stored copies.

## Amendment — 2026-10-27: the accepted reference is an exact id, and provider identifier forms are canonicalized

Layer 1's reference check compared against the entity's accepted bases as a prefix (base plus a
separator). Two shapes slip past a prefix match. First, the separator is a character entity names
may contain (Azure Key Vault and Kubernetes separate ids with "-", GCP with "_"), so "test" could
borrow "test-more"'s reference: it starts with "test"'s base and separator and is not a boundary of
its own. The encrypt pass now accepts a reference under an accepted base the walk itself built
(which is every pass's root) only when it equals the whole id the walk derives for the field;
references under an accepted base the walk did not build from — the TEST_CONNECTION echo of the
tested service's stored credential, whose container chain the workflow walk cannot reconstruct —
remain subtree-matched, backed by the masker's byte-equality on every HTTP path that produces them.
A reference whose stored chain no longer matches the walk (a schema change that re-nested a field)
is now rejected on a user save; resending the plain value recovers.

Second, AWS Secrets Manager and AWS SSM resolve a secret's ARN wherever they resolve its name
(`GetSecretValue.secretId`, `GetParameter.name`), so a reference written in ARN form resolves as
the same secret while looking, to the check, like a pointer into a vault the submitter manages
themselves. Both managers now canonicalize an ARN to the native secret name before classification
(`SecretsManager#toNativeSecretName`), for the encrypt pass and the masker alike; other providers'
read calls only accept names, so their canonical form is the identity.

The secrets-manager migration that re-stores workflow values writes them back through the workflow
DAO: EntityDAO.update binds the table of the DAO it is called on, and the migration previously
called the ingestion-pipeline DAO's update with a workflow, updating zero rows and silently
dropping the re-encrypted workflow.

## Amendment — 2026-10-28: padded names, the AWS suffix, version-checked stores, and who may run a TEST_CONNECTION

Layer 1 and 2 canonicalize before they classify, but layer 3's provider hook left two shapes
unhandled, and one HTTP authorization was wider than the credential check it guarded.

First, the same backends accept a padded name wherever they accept the name: SSM removes spaces at
the beginning and end of a parameter name when it resolves one. A single space after
`secret:` therefore sent a reference to another entity's managed secret through
`isManagedSecretName` as an *external* one — outside the namespace it was not, at the padded name
it appeared to resolve. Both classification entry points (`isAcceptedReference`'s canonical name
and `isManagedSecretName`) now trim before they lowercase.

Second, AWS renames every secret it creates to `<name>-<6 random characters>`, so the ARN of the
secret a field itself stored cannot be recomputed from the field's id — the exact per-field
comparison layer 3 v3 pinned down rejects it, and every later save of such an entity fails. The
encrypt pass's own-field comparison is now provider-hooked (`matchesOwnFieldId`): the base provider
compares exactly, and the AWS Secrets Manager additionally accepts a name that is its field's id
followed by exactly six alphanumeric characters — the suffix AWS appends, which no caller can guess
and nothing else names. Other managers keep the exact comparison.

Third, the version-checked store — the store an If-Match PATCH takes — never runs `storeEntity`:
it calls `store` directly to compare versions, so the re-encryption that pass relies on never runs
and the plaintext the patch's unmask restored from a stored echo or mask is serialized as-is.
The repositories that encrypt in `storeEntity` (workflow, bot user) now run that same encryption
under internal re-storage in `storeEntityWithVersion` too.

Fourth, the TEST_CONNECTION trigger required ANY of EditAll on the named service or Create on
ingestion pipelines. A caller holding only the second could create a TEST_CONNECTION workflow
naming a service it cannot edit and trigger it: the tested service's credential is a predictable
reference on external vaults, the masker accepts its echo as the field's own, and the run connects
on the request's own host and account with that service's credential. Both the create (and
name-changing PUT, which reads the same stored connection as the echo's comparison base) and the
trigger now require EditAll on the named service; requests that name no service keep the
pipeline-create requirement on the trigger.

## Amendment — 2026-10-28 (v5): the pipeline's version-checked store, locking a shared secret, and the stored row that predates the guards

First, the pipeline's version-checked store encrypts under internal re-storage like the workflow's
and the bot user's. The v4 fix covered the repositories that encrypt in `storeEntity` (workflow,
bot user) but not `IngestionPipelineRepository`, whose If-Match PATCH restores a stored token or
mask into plaintext and would have serialized that unencrypted; the pipeline's whole
`sourceConfig` is walked.

Second, those overrides write shared secrets outside the database - the bot's vault entry is one,
not per-entity JSON - and the compare-and-swap that rejects a stale caller runs after them: two
overlapping If-Match PATCHes of the same version both pass the initial read, and the loser could
leave the vault holding its own (rejected) credential. A row lock is taken and the stored version
asserted before the external write (`EntityRepository#lockAndAssertStoredVersion`), so only the
caller whose version check passes writes the vault. The lock is the row the store's
compare-and-swap touches, so it serializes the two without a second lock protocol.

Third, the trigger validates a stored row the guards never saw. A workflow stored before this
decision existed carries whatever its submitter typed; a stored Fernet token cannot be
re-attributed, but a managed `secret:` reference can: the trigger rejects one that is not the
exact id the storing walk would have derived for the field and does not fall under the tested
service's base (`SecretsManager#rejectStoredForeignReferences`). That closes the cheap
predictable-reference borrow; the residual Fernet-token borrow on a pre-guard row is unprovable
from storage alone, and the EditAll-on-service requirement at trigger bounds who can run such a
workflow.

Fourth, EditAll on the named service is required while the service exists; a service that does
not exist yet has no stored connection to echo - the masker accepts nothing encoded for it - so
the add-service flow keeps the pipeline-create rule instead of demanding EditAll on a service
that is not there.

Fifth, the workflow secrets migration now runs: `updateEntities` re-stores workflows on a
provider switch through the fixed workflow DAO (previously unreachable).

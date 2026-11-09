# Rotating the JWT signing key

OpenMetadata signs the tokens it issues with one RSA key, set in `jwtTokenConfiguration`. This
procedure makes rotation a hard cut: stop every server before starting any with the new key,
then regenerate the bot tokens. Tokens signed by the old key stop working.

Plan for a short outage. Between the restart and the regeneration, every bot (ingestion, automation,
integrations) is rejected with 401.

## Before you start

- Pick a time when bot downtime is acceptable.
- Have shell access to the host that runs `openmetadata-ops.sh`. That host needs the servers'
  configuration and network access to the servers' API.
- `pipelineServiceClientConfiguration.metadataApiEndpoint` must be set in that configuration.
  The command reads the servers' JWKS from it and redeploys pipelines through it.

## 1. Create the new key pair

The configuration reads the private key as DER PKCS#8 and the public key as DER X.509. Use 2048 bits
or more.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private_key.pem
openssl pkcs8 -topk8 -inform PEM -outform DER -in private_key.pem -out private_key.der -nocrypt
openssl rsa -in private_key.pem -pubout -outform DER -out public_key.der
rm private_key.pem
```

Choose a new `keyId`. It must differ from the current one, so that anything caching the JWKS
fetches the new key.

## 2. Stop every server, configure the new key, and start them again

Stop every OpenMetadata server before starting any with the new key. Do not use a rolling restart
for this procedure. When `authenticationConfiguration.publicKeyUrls` (`AUTHENTICATION_PUBLIC_KEYS`)
includes an OpenMetadata URL behind a load balancer, a restarted server can fetch the old key from
a peer that has not restarted. It can cache that key for up to 24 hours and continue accepting
old user tokens and PATs. The default `localhost` JWKS URL avoids fetching another server's
old key.

Set these in the configuration of every server and of the host that runs `openmetadata-ops.sh`.
All of them must hold the same values.

| Key | Environment variable | Meaning |
|---|---|---|
| `jwtTokenConfiguration.rsaprivateKeyFilePath` | `RSA_PRIVATE_KEY_FILE_PATH` | New `private_key.der` |
| `jwtTokenConfiguration.rsapublicKeyFilePath` | `RSA_PUBLIC_KEY_FILE_PATH` | New `public_key.der` |
| `jwtTokenConfiguration.keyId` | `JWT_KEY_ID` | New key id |

Start all servers with the new configuration. Verify that each server's
`/api/v1/system/config/jwks` endpoint lists only the new `keyId`; checking the load balancer alone
does not verify every server. If you already performed a rolling restart with a shared JWKS URL,
stop all servers and start them again to clear any cached old keys. From then on:

- Users get 401 on their old sessions and sign in again.
- Holders of personal access tokens create new tokens.
- Bots are down until step 3.

## 3. Regenerate the bot tokens

```bash
./bootstrap/openmetadata-ops.sh -c <config.yaml> regenerate-bot-tokens [--expiry Unlimited] [--skip-current]
```

The command:

1. Fetches `GET <metadataApiEndpoint>/v1/system/config/jwks` and checks that it lists the
   configured `keyId` with the same public key. If not, it writes nothing, prints why and exits 2.
   There is no flag to skip this check. It reads the one server behind `metadataApiEndpoint`, so it
   cannot tell whether every server restarted. Complete step 2 first.
2. Gives every JWT bot a new token signed by the new key, and records each change in the audit
   log as an update by `admin`. A bot whose token was revoked is skipped and keeps no token, so an
   administrator's revoke survives the rotation.
3. Redeploys every ingestion pipeline with `deployed == true`, with the new ingestion-bot token.
   This runs on every run, so a re-run repairs a redeploy that failed before. When
   `pipelineServiceClientConfiguration.enabled` is `false`, it skips this step and says so.

A pipeline whose `deployed` flag is false or unset is not redeployed, even if it is running
outside OpenMetadata. For pipelines registered in OpenMetadata that need deployment regardless
of that flag, run:

```bash
./bootstrap/openmetadata-ops.sh -c <config.yaml> deploy-pipelines
```

This deploys all registered pipelines, including ones that have never been deployed. For pipelines
managed entirely outside OpenMetadata, update the copied bot token in their configuration and
redeploy them through their own scheduler.

With `--skip-current`, a bot whose stored token already verifies under the configured key, carries
the configured `keyId` and has not expired is left unchanged and reported as `ALREADY_CURRENT`. Use
it to run the command again during a rotation without replacing the tokens an earlier run gave.
Without it, the command replaces every token except a revoked one, which is what you want after a
bot token leaked, to give every bot a new expiry, or after changing the cluster name. A token the
command replaced stops working.

A bot changed by someone else while the command ran is reported as `FAILED` ("changed concurrently,
re-run"). Run the command again. During a key rotation, add `--skip-current`, so only the bots that
failed get new tokens. After a leaked token, leave it out: the leaked token still verifies under
the configured key, so `--skip-current` would keep it.

A new token that the configured public key does not verify is never stored. Each bot is then
reported as `FAILED` ("Private key does not match the public key"). Check that
`RSA_PRIVATE_KEY_FILE_PATH` and `RSA_PUBLIC_KEY_FILE_PATH` point at the two halves of one key pair.

| Exit code | Meaning |
|---|---|
| 0 | No bot and no pipeline failed |
| 1 | A bot or a pipeline failed, or the command could not run. See the table and log |
| 2 | The JWKS does not list the configured key, could not be read, or `metadataApiEndpoint` is not set. Nothing was written |

The report lists each bot as `REGENERATED`, `ALREADY_CURRENT` (only with `--skip-current`),
`SKIPPED` (no bot user, not JWT, or token revoked) or `FAILED`.

A bot works again as soon as its new token is stored. Servers accept a regenerated token on its
first request, without a restart. `OpsRegenerateBotTokensIT` asserts this.

## 4. Check the result

- `GET /api/v1/system/config/jwks` on each server lists only the new `keyId`.
- The report shows every bot as `REGENERATED`, or `ALREADY_CURRENT` on a `--skip-current` run,
  except bots you revoked, which show `SKIPPED`.
- Pipelines run again from their schedules or from a manual trigger.

## Who else is affected

- **Users and PAT holders.** Users sign in again. Personal access tokens signed by the old key
  stop working and must be created again. The command does not re-sign, report, or delete PATs.
  Their rows remain in the token table, so the UI can show them as unexpired even though requests
  return 401. Notify PAT holders to revoke the old entries, create replacements, and update their
  clients. Re-signing a stored PAT would not update the copy held by its owner.
- **Bots whose token you copied elsewhere.** The regenerated token replaces the stored one. Copy the
  new token from the bot's page or API wherever a system holds the old one (CI jobs, external
  pipelines).
- **Airflow lineage backend.** Replace `[lineage] jwt_token` in `airflow.cfg`, or
  `metadata_config.securityConfig.jwtToken` in the JSON file selected by
  `OPENMETADATA_LINEAGE_CONFIG`. Pipeline redeployment does not update these copies.
- **Airflow `OpenMetadataHook`.** Replace the password in the Airflow connection the hook uses
  (`openmetadata_default` unless configured otherwise). Pipeline redeployment does not update
  this connection.
- **Services that verify OpenMetadata tokens through the JWKS.** They must reload the JWKS and
  accept the new `keyId`. Remove cached or pinned copies of the old public key so that these
  services reject tokens signed by it.

# Rotating the JWT signing key

OpenMetadata signs the tokens it issues with one RSA key, set in `jwtTokenConfiguration`. Rotating
it is a hard cut. Every server restarts with the new key, every token the old key signed stops
working, and you then regenerate the bot tokens. There is no overlap window where two keys verify.

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

## 2. Configure and restart every server

Set these in the configuration of every server and of the host that runs `openmetadata-ops.sh`.
All of them must hold the same values.

| Key | Environment variable | Meaning |
|---|---|---|
| `jwtTokenConfiguration.rsaprivateKeyFilePath` | `RSA_PRIVATE_KEY_FILE_PATH` | New `private_key.der` |
| `jwtTokenConfiguration.rsapublicKeyFilePath` | `RSA_PUBLIC_KEY_FILE_PATH` | New `public_key.der` |
| `jwtTokenConfiguration.keyId` | `JWT_KEY_ID` | New key id |

Restart all servers. From then on:

- Users get 401 on their old sessions and sign in again.
- Holders of personal access tokens create new tokens.
- Bots are down until step 3.

## 3. Regenerate the bot tokens

```bash
./bootstrap/openmetadata-ops.sh -c <config.yaml> regenerate-bot-tokens [--expiry Unlimited]
```

The command:

1. Fetches `GET <metadataApiEndpoint>/v1/system/config/jwks` and checks that it lists the
   configured `keyId` with the same public key. If not, it writes nothing, prints why and exits 2.
   There is no flag to skip this check.
2. Gives every JWT bot a new token signed by the new key. A bot whose stored token already verifies
   under the configured key, carries the configured `keyId` and has not expired is left unchanged,
   so you can run the command again.
3. Redeploys every ingestion pipeline with `deployed == true`, with the new ingestion-bot token.
   This runs on every run, so a re-run repairs a redeploy that failed before. When
   `pipelineServiceClientConfiguration.enabled` is `false`, it skips this step and says so.

A bot changed by someone else while the command ran is reported as `FAILED` ("changed concurrently,
re-run"). Run the command again.

| Exit code | Meaning |
|---|---|
| 0 | No bot and no pipeline failed |
| 1 | A bot or a pipeline failed, or the command could not run. See the table and log |
| 2 | The configured key differs from the servers' JWKS, or the JWKS could not be read. Nothing was written |

The report lists each bot as `REGENERATED`, `ALREADY_CURRENT`, `SKIPPED` (no bot user, or not
JWT) or `FAILED`.

A regenerated token is accepted on its first use, because servers read it from the database. The
superseded token is refused within `credentialVerification.maxStaleness` (default 5s on each
server). `OpsRegenerateBotTokensIT` asserts both.

## 4. Check the result

- `GET /api/v1/system/config/jwks` lists only the new `keyId`.
- The report shows every bot as `REGENERATED` or `ALREADY_CURRENT`.
- Pipelines run again from their schedules or from a manual trigger.

## Who else is affected

- **Users and PAT holders.** Users sign in again. Personal access tokens signed by the old key
  stop working and must be created again.
- **Bots whose token you copied elsewhere.** The regenerated token replaces the stored one. Copy the
  new token from the bot's page or API wherever a system holds the old one (CI jobs, external
  pipelines).
- **Services that verify OpenMetadata tokens through the JWKS.** They must reload the JWKS and
  accept the new `keyId`. Tokens signed by the old key no longer exist, so drop any pinned copy of
  the old public key.

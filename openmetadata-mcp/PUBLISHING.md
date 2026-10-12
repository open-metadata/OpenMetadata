# Publishing to the MCP Registry

`server.json` in this directory is the listing for OpenMetadata in the
[official MCP Registry](https://registry.modelcontextprotocol.io), published under the name
`io.github.open-metadata/openmetadata-mcp`. Directories such as
[PulseMCP](https://www.pulsemcp.com/servers/openmetadata) mirror the registry on their own sync
cadence, so a publish shows up there hours later, not immediately.

Publishing is manual today. The whole procedure is four commands, but two of them fail in ways whose
error message points at the wrong cause, so read [Gotchas](#gotchas) before your first publish.

## Who can publish

The registry grants the `io.github.open-metadata/*` namespace only to **Owners** of the
`open-metadata` GitHub organization. Ordinary members cannot publish, and making your organization
membership public does not change this — see [Gotchas](#gotchas).

## Procedure

### 1. Bump the version

```bash
jq -r .version openmetadata-mcp/server.json
```

**Registry versions are immutable and cannot be republished.** Every publish needs a version that
has never been used, so bump `.version` in `server.json` before anything else. Check what is already
taken:

```bash
curl -s "https://registry.modelcontextprotocol.io/v0/servers/io.github.open-metadata%2Fopenmetadata-mcp/versions?include_deleted=true" \
  | jq -r '.servers[].server.version'
```

This version is maintained by hand and is deliberately **not** tied to the OpenMetadata release
version — bump it when the MCP listing itself changes.

Since the text you publish is frozen, re-read the `description` before shipping: it is user-facing
copy in a public directory, and a wrong tool count or stale blurb can only be corrected by burning
another version.

### 2. Validate

```bash
mcp-publisher validate openmetadata-mcp/server.json
```

Catches schema errors before you spend a version number. Note that this hits the network — it
validates against the live registry schema, not a local copy.

### 3. Log in and publish, in one command

```bash
mcp-publisher login github --token "$(gh auth token)" && \
  mcp-publisher publish openmetadata-mcp/server.json
```

Chain them with `&&`. The registry token is only valid for **five minutes**, so a login followed by
any detour usually expires before you publish.

`gh auth token` is used instead of the interactive device flow because the device-flow token lacks
the `read:org` scope. Any token with `read:org` works; verify yours with `gh auth status`. If you
prefer a dedicated PAT, a classic PAT needs only `read:org` (no repository scopes — the registry
never reads code).

### 4. Verify

```bash
curl -s "https://registry.modelcontextprotocol.io/v0/servers/io.github.open-metadata%2Fopenmetadata-mcp/versions/<version>" \
  | jq '.server'
```

A `200` with your payload means it is live. Confirm `isLatest` is `true` on the new version:

```bash
curl -s "https://registry.modelcontextprotocol.io/v0/servers/io.github.open-metadata%2Fopenmetadata-mcp/versions" \
  | jq -r '.servers[] | "\(.server.version) latest=\(._meta["io.modelcontextprotocol.registry/official"].isLatest)"'
```

Finally, commit the bumped `server.json` so the repository records what was published.

## Gotchas

**A 403 naming your personal namespace is a token-scope problem, not a membership problem.**

```
403 You do not have permission to publish this server.
    You have permission to publish: io.github.<you>/*.
    Attempting to publish: io.github.open-metadata/openmetadata-mcp.
    ... you may need to make your organization membership public ...
```

The hint about public membership is misleading. The registry authorizes against
`GET /user/memberships/orgs` and deliberately never calls `/users/{username}/orgs`, because the
latter returns only public memberships and carries no role. Publicizing membership therefore has no
effect. What the registry actually requires is `role == "admin"` (organization Owner) with
`state == "active"`.

Worse, when the token lacks `read:org`, GitHub answers that endpoint with a 403 and the registry
**silently degrades to "no admin orgs"** rather than reporting the missing scope — which is why the
failure looks like a permissions problem. Confirm both facts before debugging anything else:

```bash
gh api user/memberships/orgs --jq '.[] | select(.organization.login=="open-metadata")'
gh auth status | grep -i 'token scopes'
```

You want `"role": "admin"`, `"state": "active"`, and `read:org` among the scopes. If the role is
`member`, no token will help — ask an org Owner to publish.

**A 400 `cannot publish duplicate version` usually means the publish already succeeded.**

```
400 {"errors":[{"message":"invalid version: cannot publish duplicate version"}]}
```

The registry rejects a version that already exists, including one you published moments earlier and
including soft-deleted versions. Before assuming it failed, query the versions endpoint from step 4
— if your version is listed, the work is done and this error is just a redundant second attempt.

**To inspect what a login actually granted**, decode the stored token's claims rather than guessing:

```bash
python3 -c '
import base64, json, pathlib, datetime
tok = json.loads((pathlib.Path.home()/".config/mcp-publisher/token.json").read_text())["token"]
p = tok.split(".")[1]
c = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
print("permissions:", json.dumps(c["permissions"]))
print("expires    :", datetime.datetime.fromtimestamp(c["exp"], datetime.UTC).isoformat())
'
```

A correct login lists `io.github.open-metadata/*` alongside your personal namespace; a degraded one
lists only `io.github.<you>/*`. Treat that file as a credential — it is written with `0600`
permissions, and the payload is base64url without padding, which is why a bare `base64 -d` on it
fails.

## Why this is not automated

A GitHub Actions workflow using OIDC (`mcp-publisher login github-oidc`) would need no secrets — the
registry derives the namespace from the OIDC `repository_owner` claim and grants
`io.github.<owner>/*`, which covers this server. Three things have to be handled before that is
safe, and they are the reason it has not landed yet:

- **Release tags do not map to listing versions.** `.version` here is hand-maintained, so most
  release tags carry a version that is already published and every such run would fail red. An
  automated job has to probe the registry first and skip when the version already exists.
- **`*-release` also matches release candidates** such as `2.0.0-rc1-release`, which must not reach
  a public directory.
- **The job holds broad publish rights.** An OIDC token minted in this repository can publish or
  overwrite *any* server under `io.github.open-metadata/*`. Since a tag push runs the workflow file
  as it exists at that tag, tag-push rights become publish rights, which argues for a tag protection
  rule on `*-release` alongside any such workflow.

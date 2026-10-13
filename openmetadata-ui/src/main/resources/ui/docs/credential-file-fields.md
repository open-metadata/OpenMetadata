# Credential file fields — the `uiFieldType` schema contract

> **A `format: password` string can be filled from a local file. The schema says so; the UI does the
> rest.**

A connector secret is often something the user already has on disk — a PEM private key, an X.509
certificate, a GCP service-account JSON. Annotating the field in its JSON Schema is the *only* thing
needed to give it a drop zone, a file picker, validation, and a remove/replace affordance. There is
no second marker, no per-connector UI code, and no server-side file storage involved.

## The contract

On a property that is `"type": "string"` with `"format": "password"`:

| Keyword | Values | Meaning |
|---|---|---|
| `uiFieldType` | `"file"` | Upload-only. The value **cannot** be typed. |
| `uiFieldType` | `"fileOrInput"` | Upload **or** paste. Both produce the same submitted value. |
| `accept` | array of extensions, e.g. `[".pem", ".key"]` | Optional. Filters the picker and rejects other extensions on drop. Omit to accept any file. |

```json
"privateKey": {
  "title": "Private Key",
  "description": "Connection to Snowflake instance via Private Key",
  "type": "string",
  "format": "password",
  "accept": [".pem", ".key", ".p8"],
  "uiFieldType": "fileOrInput"
}
```

### Encoding: UTF-8 text only

The file's **text** becomes the field value. It is read in the browser and submitted like any other
password field — it is never uploaded to an attachment endpoint, never logged, and never put in a
URL. It therefore goes through the same masking, secrets-manager, edit, export and test-connection
path as a manually pasted secret.

Decoding is strict (`TextDecoder('utf-8', { fatal: true })`, plus a NUL-byte scan). A binary file is
**rejected**, not mangled. This is deliberate: `File.text()` decodes leniently, so a DER or PKCS#12
payload used to come back as replacement characters, get saved as the secret, and only fail much
later at connection time.

**Do not list a binary format in `accept`.** `.der`, `.p12`, `.pfx` and `.jks` are not text; nothing
in the backend or ingestion has ever accepted them. Listing one only produces a picker that offers a
file the field then refuses. If a connector genuinely needs a binary credential, that needs an
explicit end-to-end encoding contract (base64 in the schema, decode in ingestion) — not this marker.

### Size

One shared ceiling, `DEFAULT_CREDENTIAL_FILE_MAX_SIZE` in
`openmetadata-ui-core-components/.../credential-file-input.tsx` — currently **1 MiB**. Credential
material is measured in kilobytes; the cap exists to stop someone dropping a disk image into a form
field. There is no per-field override, and a field should not need one.

## When *not* to annotate

**Never annotate a field whose runtime contract is a filesystem path.** The connector opens that path
on the ingestion runner. A browser cannot supply a runner-side path, and uploading a local file
would put *content* where the connector expects a *path*.

Name is not a reliable signal — check the title and description. These are all paths despite
credential-sounding names:

| Schema | Field | Why it is a path |
|---|---|---|
| `dashboard/qlikSenseConnection.json` | `clientCertificate` | titled "Client Certificate Path" |
| `database/clickhouseConnection.json` | `keyfile` | titled "Key File Path" |
| `common/sslCertPaths.json` | `caCertPath`, `clientCertPath`, `privateKeyPath` | the path-shaped sibling of `sslCertValues.json` |
| `pipeline/nifi/clientCertificateAuth.json` | `certificateAuthorityPath`, `clientCertificatePath`, `clientkeyPath` | paths on the NiFi host |
| `security/client/samlSSOClientConfig.json` | `keyStoreFilePath` | server-side keystore |
| `security/credentials/gcpCredentials.json` | `path` | path to the credentials file |
| `security/credentials/kubernetesCredentials.json` | `kubeconfigPath` | path to the kubeconfig |

`sslCertValues.json` vs `sslCertPaths.json` is the canonical pairing: the `*Value` fields carry
content and are annotated, the `*Path` fields carry paths and are not.

**Leave `accept` off when a complete extension list is not knowable.** An `accept` list that excludes
a legitimate file is worse than none — the strict UTF-8 decode still guards the value. Examples
deliberately left unfiltered:

- `drive/sftpConnection.json` `privateKey` — SSH keys are routinely extensionless (`id_rsa`,
  `id_ed25519`), and an extension filter would block them outright.
- `security/client/oktaSSOClientConfig.json` `privateKey` and `security/credentials/gcpValues.json`
  `privateKey` — used with both PEM and JSON-wrapped forms depending on how the operator exported
  them.

## Where the marker is honoured

Both JSON-Schema form stacks map it to the same component:

| Stack | Widget | Rendered on |
|---|---|---|
| `FormBuilderV1` | `CorePasswordWidget` | Add Service → Connection Details, Edit Connection, ingestion agent config |
| legacy RJSF `FormBuilder` | `PasswordWidget` | Settings → Applications → *App* → Configuration |

Both go through `getCredentialFileLabels` / `getCredentialFileValidationMessages` in
`src/utils/CredentialFileField.utils.ts`, so translations and behaviour stay identical.

**Known inert case:** `SSOConfigurationForm` builds its own RJSF registry and does not register
OpenMetadata's `PasswordWidget`, so `uiFieldType` has no effect on SSO configuration fields. Wire
that form up before annotating anything under `security/client/`.

## Adding an annotation

1. Confirm the field carries **content**, not a path (table above).
2. Add `uiFieldType`, and `accept` only if the extension set is complete and text-only.
3. Regenerate the committed schema output — `yarn parse-schema` in
   `openmetadata-ui/src/main/resources/ui`. It is in sync on `main`, so the diff should contain only
   your field.
4. Add the connector to `ConnectionConfigForm.schema-render.test.tsx` if it is not already covered.

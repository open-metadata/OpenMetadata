# Ingestion images take a BASE_IMAGE arg, install against the in-tree Airflow constraints, and patch Python's bundled pip seeds

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** @IceS2, @ulixius9
- **Guard:** `reviewer` — run `ingestion/scripts/verify_python_tls.py` by hand against a rebuilt image (`docker run --rm -i --entrypoint python IMAGE - < ingestion/scripts/verify_python_tls.py`); no build step runs it, and `patch_python_seeds.py` fails the build if ensurepip's layout changes
- **Related:** #36011, open-metadata/openmetadata-collate#7720

## Context
Image scanners flag the vulnerable pip, certifi, uv and virtualenv versions that ship in the
Airflow and Python base images. Upgrading the installed pip alone does not cover environments
created later: `python -m venv` seeds pip from ensurepip's bundled wheel, and virtualenv seeds it
from its own embedded wheels. Airflow's upstream constraints file pins the old certifi, uv and
virtualenv versions. Collate's derivative images are built on top of these images.

## Decision
- `ingestion/Dockerfile` and `ingestion/operators/docker/Dockerfile` take their parent image as
  the `BASE_IMAGE` build arg. Collate's derivative images depend on that name. OpenMetadata images
  are built and published before the Collate images derived from them.
- Production and CI ingestion images install Airflow-coupled packages against
  `ingestion/airflow-constraints-<version>.txt`, not Airflow's upstream constraints URL. Security
  overrides of upstream pins are applied in that file and listed in its header. A file regenerated
  from upstream must have them re-applied.
- The image build installs pip from a hash-pinned wheel and runs
  `ingestion/scripts/patch_python_seeds.py`. The script replaces ensurepip's bundled pip wheel and
  removes virtualenv's embedded pip seeds older than that version, so new environments never start
  with the vulnerable pip.

## Consequences
Fresh venvs and virtualenvs inside the images get the patched pip and CA bundle. The cost is a
small, deliberate edit to stdlib `ensurepip` in the image. If ensurepip's `_PIP_VERSION` layout
changes, the script raises and the build fails. Renaming `BASE_IMAGE` or reordering the builds
breaks Collate's images. Revisit when the base images ship pip >= 26.2.2 in ensurepip; the
patch can then be dropped.

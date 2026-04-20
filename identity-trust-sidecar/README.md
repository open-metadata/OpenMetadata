 ## Identity & Trust Sidecar (Hackathon)
 
 This is a standalone, metadata-only sidecar for OpenMetadata. It does **not** execute identity matching or consolidation. It only:
 - Reads metadata + evidence from OpenMetadata (tests/incidents/lineage where available)
 - Evaluates declarative policies
 - Writes explanations and stewardship tasks back to OpenMetadata via REST APIs
 
 ### Requirements
 - Python 3.11+
 - OpenMetadata running locally (e.g. `http://localhost:8585`)
 - A valid OpenMetadata JWT token
 
 ### Setup
 
 ```bash
 cd identity-trust-sidecar
 python3.11 -m venv .venv
 source .venv/bin/activate
 pip install -e ".[dev]"
 ```
 
 ### Run
 
 ```bash
 export OM_BASE_URL="http://localhost:8585"
 export OM_JWT_TOKEN="..."
 python -m identity_trust_sidecar.cli ping
 ```
 
 ### Tests
 
 ```bash
 pytest -q
 ```
 

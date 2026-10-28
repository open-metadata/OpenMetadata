#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Replace vulnerable bundled pip wheels during image builds."""

import ensurepip
import importlib.util
import re
import shutil
import sys
from pathlib import Path

from pip._vendor.packaging.version import Version


def main():
    if len(sys.argv) == 2:
        wheel = Path(sys.argv[1])
        version = wheel.name.split("-")[1]
        if Version(ensurepip.version()) < Version(version):
            source = Path(ensurepip.__file__)
            updated, count = re.subn(
                r'(?m)^_PIP_VERSION\s*=\s*[\'"][^\'"]+[\'"]$',
                f'_PIP_VERSION = "{version}"',
                source.read_text(),
            )
            if count != 1:
                raise RuntimeError("Unrecognized ensurepip bootstrap version")
            bundled = source.parent / "_bundled"
            shutil.copyfile(wheel, bundled / wheel.name)
            source.write_text(updated)
            for old in bundled.glob("pip-*.whl"):
                if Version(old.name.split("-")[1]) < Version(version):
                    old.unlink()

    if spec := importlib.util.find_spec("virtualenv"):
        # virtualenv retains an obsolete Python 3.9 seed; ingestion requires >=3.10.
        for wheel in (Path(spec.origin).parent / "seed/wheels/embed").glob("pip-*.whl"):
            if Version(wheel.name.split("-")[1]) < Version("26.2.2"):
                wheel.unlink()


if __name__ == "__main__":
    main()

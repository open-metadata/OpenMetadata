import os
import sys

import yaml

path = sys.argv[1]
if os.path.islink(path):
    exit()

with open(path, "r") as f:
    # safe_load_all works for both single and multi-document YAML
    list(yaml.safe_load_all(f))

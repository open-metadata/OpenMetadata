import os
import sys

import yaml

path = sys.argv[1]
if os.path.islink(path):
    exit()
yaml.safe_load(open(path, "r"))

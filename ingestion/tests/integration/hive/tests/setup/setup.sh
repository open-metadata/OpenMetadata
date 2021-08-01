#!/bin/sh
sleep 120 && \
/opt/hive/bin/beeline -u jdbc:hive2://localhost:10000 -f /setup/hive_setup.sql &
/bin/bash /usr/local/bin/entrypoint.sh /bin/sh -c startup.sh

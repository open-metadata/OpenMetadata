#!/bin/sh
sleep 120 && \
/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P 'test!Password' -d master -i /setup/setup.sql \
& /opt/mssql/bin/sqlservr

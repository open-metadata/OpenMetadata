#!/usr/bin/env bash
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Resolve links - $0 may be a softlink
PRG="${0}"
debug=false
force=false

while [ -h "${PRG}" ]; do
  ls=`ls -ld "${PRG}"`
  link=`expr "$ls" : '.*-> \(.*\)$'`
  if expr "$link" : '/.*' > /dev/null; then
    PRG="$link"
  else
    PRG=`dirname "${PRG}"`/"$link"
  fi
done

if [ $# -gt 4 ]; then
  echo "More than one argument specified, please use only one of the below options"
  printUsage
  exit 1
fi

opt="$1"
shift
# Parse options following the command
while [ $# -gt 0 ]; do
  case "$1" in
    -d)
      debug=true
      ;;
    -f)
      force=true
      ;;
    *)
      break
      ;;
  esac
  shift
done

BOOTSTRAP_DIR=`dirname ${PRG}`
CONFIG_FILE_PATH=${BOOTSTRAP_DIR}/../conf/openmetadata.yaml
FLYWAY_SQL_ROOT_DIR="${BOOTSTRAP_DIR}/sql/migrations/flyway"
NATIVE_SQL_ROOT_DIR="${BOOTSTRAP_DIR}/sql/migrations/native"

# Which java to use
if [ -z "${JAVA_HOME}" ]; then
  JAVA="java"
else
  JAVA="${JAVA_HOME}/bin/java"
fi

TABLE_INITIALIZER_MAIN_CLASS=org.openmetadata.service.util.TablesInitializer
LIBS_DIR="${BOOTSTRAP_DIR}"/../libs/
if  [ "${debug}" = true ] ; then
  echo $LIBS_DIR
fi
if [ -d "${LIBS_DIR}" ]; then
  for file in "${LIBS_DIR}"*.jar;
  do
      CLASSPATH="$CLASSPATH":"$file"
  done
else
  CLASSPATH=`mvn -pl openmetadata-service -q exec:exec -Dexec.executable=echo -Dexec.args="%classpath"`
fi

printUsage() {
  cat <<-EOF
USAGE: $0 [create|migrate|info|validate|drop|drop-create|es-drop|es-create|drop-create-all|migrate-all|repair|check-connection|rotate] [debug] [force]
   create           : Creates the tables. The target database should be empty
   migrate          : Migrates the database to the latest version or creates the tables if the database is empty. Use "info" to see the current version and the pending migrations
   info             : Shows the list of migrations applied and the pending migration waiting to be applied on the target database
   validate         : Checks if all the migrations have been applied to the target database
   drop             : Drops all the tables in the target database
   drop-create      : Drops and recreates all the tables in the target database
   es-drop          : Drops the indexes in ElasticSearch
   es-create        : Creates the indexes in ElasticSearch
   drop-create-all  : Drops and recreates all the tables in the database. Drops and creates all the indexes in ElasticSearch
   migrate-all      : Migrates the database to the latest version and migrates the indexes in ElasticSearch
   repair           : Repairs the DATABASE_CHANGE_LOG table, which is used to track all the migrations on the target database. This involves removing entries for failed migrations and updating the checksum of migrations already applied on the target database
   check-connection : Checks if a connection can be successfully obtained for the target database
   rotate           : Rotate the Fernet Key defined in \$FERNET_KEY

   Additionally, you can use:
   -d for debug      : Enable Debugging Mode to get more info
   -f for force      : Forces the server Migration to run, even if already run
EOF
}

execute() {
  local command="$1"
  local debug="$2"
  local force="$3"

  if [ "${debug}" = true ]; then
    echo "Using Configuration file: ${CONFIG_FILE_PATH}"
  fi
  echo "The -force value is ${force} and the debug value is ${debug} and command used is ${command}"
  ${JAVA} -Dbootstrap.dir=$BOOTSTRAP_DIR  -cp ${CLASSPATH} ${TABLE_INITIALIZER_MAIN_CLASS} -c ${CONFIG_FILE_PATH} -s ${FLYWAY_SQL_ROOT_DIR} -n ${NATIVE_SQL_ROOT_DIR} --${1} -force ${force}  -${debug}
}

case "${opt}" in
create | drop | migrate | info | validate | repair | check-connection | es-drop | es-create | rotate)
    execute "${opt}" "${debug}" "${force}"
    ;;
drop-create )
    execute "drop" "${debug}" "${force}" && execute "create" "${debug}" "${force}"
    ;;
drop-create-all )
    execute "drop" "${debug}" "${force}" && execute "create" "${debug}" "${force}" && execute "es-drop" "${debug}" "${force}" && execute "es-create" "${debug}" "${force}"
    ;;
migrate-all )
    execute "repair" "${debug}" "${force}" && execute "migrate" "${debug}" "${force}" && execute "es-migrate" "${debug}" "${force}"
    ;;
rotate )
    execute "rotate" "${debug}" "${force}"
    ;;
*)
    echo "Invalid command: ${opt}"
    printUsage
    exit 1
    ;;
esac

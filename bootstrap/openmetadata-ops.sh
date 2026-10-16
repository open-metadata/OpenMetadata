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
while [ -h "${PRG}" ]; do
  ls=`ls -ld "${PRG}"`
  link=`expr "$ls" : '.*-> \(.*\)$'`
  if expr "$link" : '/.*' > /dev/null; then
    PRG="$link"
  else
    PRG=`dirname "${PRG}"`/"$link"
  fi
done

BOOTSTRAP_DIR=`dirname ${PRG}`
CONFIG_FILE_PATH=${BOOTSTRAP_DIR}/../conf/openmetadata.yaml

# Which java to use
if [ -z "${JAVA_HOME}" ]; then
  JAVA="java"
else
  JAVA="${JAVA_HOME}/bin/java"
fi

OPENMETADATA_SETUP_MAIN_CLASS=org.openmetadata.service.util.OpenMetadataOperations
LIBS_DIR="${BOOTSTRAP_DIR}"/../libs/
if  [ ${debug} ] ; then
  echo $LIBS_DIR
fi
if [ -d "${LIBS_DIR}" ]; then
  # First, add collate-service jar to the classpath.
  # This is required for cases where we override classes from dependencies.
  for file in "${LIBS_DIR}"collate-spec-*.jar;
  do
      CLASSPATH="$CLASSPATH":"$file"
  done
  # Then, add the rest of the libraries
  for file in "${LIBS_DIR}"*.jar;
  do
      CLASSPATH="$CLASSPATH":"$file"
  done
else
  CLASSPATH=`mvn -pl openmetadata-service -q exec:exec -Dexec.executable=echo -Dexec.args="%classpath"`
fi

# As in bin/openmetadata-server-start.sh: pass JAVA_TOOL_OPTIONS in a -XX:VMOptionsFile on fd 3,
# so neither the JVM's startup echo nor ps shows it.
JAVA_TOOL_ARGS=""
if [ -n "$JAVA_TOOL_OPTIONS" ]; then
  java_tool_options_file=""
  for tmp_dir in /dev/shm "${TMPDIR:-/tmp}"; do
    java_tool_options_file=$(mktemp "$tmp_dir/jvm-options.XXXXXX" 2>/dev/null) && break
  done
  if [ -n "$java_tool_options_file" ] &&
    printf '%s\n' "$JAVA_TOOL_OPTIONS" > "$java_tool_options_file"; then
    exec 3< "$java_tool_options_file"
    JAVA_TOOL_ARGS="-XX:VMOptionsFile=/dev/fd/3"
    unset JAVA_TOOL_OPTIONS
  else
    echo "Warning: could not write JAVA_TOOL_OPTIONS to /dev/shm or ${TMPDIR:-/tmp}," \
      "so the JVM will print it at startup" >&2
  fi
  [ -z "$java_tool_options_file" ] || rm -f "$java_tool_options_file"
fi

${JAVA} ${JAVA_TOOL_ARGS} -Dbootstrap.dir=$BOOTSTRAP_DIR  -cp ${CLASSPATH} ${OPENMETADATA_SETUP_MAIN_CLASS} -c $CONFIG_FILE_PATH "$@"
exit $?


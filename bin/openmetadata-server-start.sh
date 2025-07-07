#!/bin/bash
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

 if [ $# -lt 1 ];
then
	echo "USAGE: $0 [-daemon] openmetadata.yaml"
	exit 1
fi
base_dir=$(dirname $0)/..

OPENMETADATA_HOME=$base_dir
# OpenMetadata env script
. $OPENMETADATA_HOME/conf/openmetadata-env.sh

if [ "x$OPENMETADATA_HEAP_OPTS" = "x" ]; then
    export OPENMETADATA_HEAP_OPTS="-Xmx1G -Xms1G"
fi

EXTRA_ARGS="-name OpenMetadataServer"

# create logs directory
if [ "x$LOG_DIR" = "x" ]; then
    LOG_DIR="$base_dir/logs"
fi

if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
fi

# classpath addition for release

echo $CLASSPATH
for file in $base_dir/libs/*.jar;
do
    CLASSPATH=$CLASSPATH:$file
done

if [ ! "x$EXT_CLASSPATH" = "x" ]; then
 CLASSPATH=$CLASSPATH:$EXT_CLASSPATH;
fi


COMMAND=$1
while [ "$COMMAND" != "" ]; do
  case $COMMAND in
    -name)
      DAEMON_NAME=$2
      shift 2
      ;;
    -daemon)
      DAEMON_NAME=OpenMetadataServer
      DAEMON_MODE=true
      shift
      ;;
    *)
      break
      ;;
  esac
  COMMAND=$1
done
CONSOLE_OUTPUT_FILE=$LOG_DIR/$DAEMON_NAME.out

# Which java to use
if [ -z "$JAVA_HOME" ]; then
  JAVA="java"
else
  JAVA="$JAVA_HOME/bin/java"
fi

# Set Debug options if enabled
if [ "x$OPENMETADATA_DEBUG" != "x" ]; then

    # Use default ports
    DEFAULT_JAVA_DEBUG_PORT="0.0.0.0:5005"

    if [ -z "$JAVA_DEBUG_PORT" ]; then
        JAVA_DEBUG_PORT="$DEFAULT_JAVA_DEBUG_PORT"
    fi

    # Use the defaults if JAVA_DEBUG_OPTS was not set
    DEFAULT_JAVA_DEBUG_OPTS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=${DEBUG_SUSPEND_FLAG:-n},address=$JAVA_DEBUG_PORT"
    if [ -z "$JAVA_DEBUG_OPTS" ]; then
        JAVA_DEBUG_OPTS="$DEFAULT_JAVA_DEBUG_OPTS"
    fi

    echo "Enabling Java debug options: $JAVA_DEBUG_OPTS"
    OPENMETADATA_OPTS="$JAVA_DEBUG_OPTS $OPENMETADATA_OPTS"
fi

# GC options for Java 21
GC_LOG_FILE_NAME='openmetadata-gc.log'
if [ -z "$OPENMETADATA_GC_LOG_OPTS" ]; then
  OPENMETADATA_GC_LOG_OPTS="-Xlog:gc*,gc+heap=info,gc+ergo=debug:file=$LOG_DIR/$GC_LOG_FILE_NAME:time,level,tags:filecount=10,filesize=102400"
fi


# JVM performance options optimized for Java 21
if [ -z "$OPENMETADATA_JVM_PERFORMANCE_OPTS" ]; then
  OPENMETADATA_JVM_PERFORMANCE_OPTS="-server -XX:+UseG1GC -XX:+UseStringDeduplication -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -XX:+ExplicitGCInvokesConcurrent -XX:+UseLargePages -XX:+OptimizeStringConcat -XX:+UseCompressedOops -XX:+UseCompressedClassPointers -Djava.awt.headless=true"
fi

#Application classname
APP_CLASS="org.openmetadata.service.OpenMetadataApplication"

# Launch mode
if [ "x$DAEMON_MODE" = "xtrue" ]; then
    nohup $JAVA $OPENMETADATA_HEAP_OPTS $OPENMETADATA_JVM_PERFORMANCE_OPTS -cp $CLASSPATH $OPENMETADATA_OPTS "$APP_CLASS" "server" "$@" > "$CONSOLE_OUTPUT_FILE" 2>&1 < /dev/null &
else
    exec $JAVA $OPENMETADATA_HEAP_OPTS $OPENMETADATA_JVM_PERFORMANCE_OPTS -cp $CLASSPATH $OPENMETADATA_OPTS "$APP_CLASS" "server" "$@"
fi

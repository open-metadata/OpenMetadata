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
case $COMMAND in
  -name)
    DAEMON_NAME=$2
    CONSOLE_OUTPUT_FILE=$LOG_DIR/$DAEMON_NAME.out
    shift 2
    ;;
  -daemon)
    DAEMON_MODE=true
    shift
    ;;
  *)
    ;;
esac

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

# GC options
GC_LOG_FILE_NAME='openmetadata-gc.log'
if [ -z "$OPENMETADATA_GC_LOG_OPTS" ]; then
  JAVA_MAJOR_VERSION=$($JAVA -version 2>&1 | sed -E -n 's/.* version "([0-9]*).*$/\1/p')
  if [[ "$JAVA_MAJOR_VERSION" -ge "9" ]] ; then
    OPENMETADATA_GC_LOG_OPTS="-Xlog:gc*:file=$LOG_DIR/$GC_LOG_FILE_NAME:time,tags:filecount=10,filesize=102400"
  else
    OPENMETADATA_GC_LOG_OPTS="-Xloggc:$LOG_DIR/$GC_LOG_FILE_NAME -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCDateStamps -XX:+PrintGCTimeStamps -XX:+UseGCLogFileRotation -XX:NumberOfGCLogFiles=10 -XX:GCLogFileSize=100M"
  fi
fi


# JVM performance options
if [ -z "$OPENMETADATA_JVM_PERFORMANCE_OPTS" ]; then
  OPENMETADATA_JVM_PERFORMANCE_OPTS="-server -XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -XX:+ExplicitGCInvokesConcurrent -Djava.awt.headless=true"
fi

#Application classname
APP_CLASS="org.openmetadata.service.OpenMetadataApplication"

# Launch mode
if [ "x$DAEMON_MODE" = "xtrue" ]; then
    nohup $JAVA $OPENMETADATA_HEAP_OPTS $OPENMETADATA_JVM_PERFORMANCE_OPTS -cp $CLASSPATH $OPENMETADATA_OPTS "$APP_CLASS" "server" "$@" > "$CONSOLE_OUTPUT_FILE" 2>&1 < /dev/null &
else
    exec $JAVA $OPENMETADATA_HEAP_OPTS $OPENMETADATA_JVM_PERFORMANCE_OPTS -cp $CLASSPATH $OPENMETADATA_OPTS "$APP_CLASS" "server" "$@"
fi

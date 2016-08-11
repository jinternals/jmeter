#!/usr/bin/env bash

JMETER_HOME="$1"
RESULT_FILE="$2"
EXPORT_DASHBOARD_HOME="$3"


echo Environment Variables :
echo -------------------------------------------------------------------------------------------------------

echo JMETER_HOME : $JMETER_HOME
echo RESULT_FILE : $RESULT_FILE
echo EXPORT_DASHBOARD_HOME : $EXPORT_DASHBOARD_HOME

echo -------------------------------------------------------------------------------------------------------

rm -r $EXPORT_DASHBOARD_HOME
mkdir -p $EXPORT_DASHBOARD_HOME


$JMETER_HOME/bin/jmeter -g $RESULT_FILE -o $EXPORT_DASHBOARD_HOME


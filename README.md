#JMeter


## Run Jmeter test plan(Default profile is test)
mvn clean verify


## Run Jmeter test plan with profile
mvn -Ptest clean verify <br>
mvn -Plive clean verify 

## Run Jmeter test plan with profile and override default values

clean verify -Dperformancetest.loopCount=2 -Dperformancetest.threadCount=20 -Dperformancetest.rampUpTime=2<br>

clean -Ptest verify -Dperformancetest.loopCount=2 -Dperformancetest.threadCount=20 -Dperformancetest.rampUpTime=2<br>
clean -Plive verify -Dperformancetest.loopCount=2 -Dperformancetest.threadCount=20 -Dperformancetest.rampUpTime=2

## Run JMeter gui
mvn clean jmeter:gui

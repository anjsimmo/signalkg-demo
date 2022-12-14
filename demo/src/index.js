import vis from './vis.js';
import { bayes, simulateAction } from './bayes.js';

window.addEventListener('DOMContentLoaded', (event) => {
    // const signalKGSourceElement = document.getElementById("signalkg-source");
    // signalKGSourceElement.addEventListener('change', (event) => {
    //   updatetext(event.target.value, "signalkg-data");
    // });
    // 
    // const mapSourceElement = document.getElementById("map-source");
    // mapSourceElement.addEventListener('change', (event) => {
    //   updatetext(event.target.value, "map-data");
    // });
    // 
    // const scenarioSourceElement = document.getElementById("scenario-source");
    // scenarioSourceElement.addEventListener('change', (event) => {
    //   updatetext(event.target.value, "scenario-data");
    // });
    
    // const mapDataElement = document.getElementById("map-data");
    // mapDataElement.addEventListener('input', (event) => {
    //   console.log("vis", event.target.value)
    //   vis(event.target.value, "");
    // });
    let stopfunc;
    var counter = 1;
    var graphName = "generated/meeting.json";
    var bayesgraph, bayesvizgraph, makeObsFunc;

    const logCallback = function(log, observations) {
      document.getElementById("simlog-data").value += log;
      // scroll to bottom:
      document.getElementById("simlog-data").scrollTop = document.getElementById("simlog-data").scrollHeight;

      for (const [sensor, signal, time] of observations) {
        //document.getElementById("simobs-data").value += `sensor ${sensor} detected signal ${signal} at time ${time}.\n`;
        const isotime = (new Date(time)).toISOString();
        document.getElementById("simobs-data").value += `:observation${counter} a sosa:Observation ;
  sosa:observedProperty :${signal} ;
  sosa:madeBySensor :${sensor} ;
  sosa:hasSimpleResult true ;
  sosa:resultTime "${isotime}"^^xsd:dateTime .

`;
        counter++;
      }
    };
    const simulateActionCallback = function(actionCatInfo, time) {
      console.log("simcallback", graphName);
      simulateAction(graphName, actionCatInfo, time, logCallback)
    };
    
    const restartSim = function() {
      //console.log("vis", event.target.value)
      // Stop existing sim
      if (stopfunc) {
        stopfunc();
      }
      document.getElementById("vis").innerHTML = '';
      document.getElementById("simobs-data").value = `@prefix : <http://signalkg.visualmodel.org/demo#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .

`;
      document.getElementById("simlog-data").value = "===Simulation log===\n";
      stopfunc = vis(
        graphName,
        document.getElementById("signalkg-data").value,
        document.getElementById("sensor-data").value,
        document.getElementById("map-data").value,
        document.getElementById("scenario-data").value,
        document.getElementById("scenarioactions-data").value,
        bayesgraph, bayesvizgraph, simulateActionCallback);
    };

    const simBtn = document.getElementById("sim-btn");
    simBtn.addEventListener('click', (event) => {
      restartSim();
    });
    
    const simStopBtn = document.getElementById("simstop-btn");
    simStopBtn.addEventListener('click', (event) => {
      stopfunc();
    });
    
    const loadDemo = function (sigttl, sensorttl, mapttl) {
      Promise.all([
        fetchtext(sigttl),
        fetchtext(sensorttl),
        fetchtext(mapttl)
      ]).then(data => {
        const [dataSignalKG, dataSensor, dataMap] = data;
        document.getElementById("signalkg-data").value = dataSignalKG;
        document.getElementById("sensor-data").value = dataSensor;
        document.getElementById("map-data").value = dataMap;
        // console.log(data)
        // console.log(dataSignalKG, dataMap, dataScenario);
        //restartSim();
      });
    }

    const loadBayes = function (graphName) {
      // We can treat an async function as if it was a promise
      // https://stackoverflow.com/questions/49982058/how-to-call-an-async-function
      bayes(graphName).then(data => {
        [bayesgraph, bayesvizgraph, makeObsFunc] = data
      });
    }
    
    //loadDemo("data/smarthome.ttl", "data/smarthome_geo.ttl", "data/smarthome_scenario.ttl");
    loadBayes(graphName);
    loadDemo("data/meeting.ttl", "data/meeting_sensors.ttl", "generated/building_geo.ttl");
    
    const demoSelect = document.getElementById("demoSelect");
    demoSelect.addEventListener('change', (event) => {
       const [sigttl, sensorttl, mapttl] = event.target.value.split(' ');
       const newGraphName = event.target.selectedOptions[0].dataset.graph;
       console.log("select", newGraphName, sigttl, sensorttl, mapttl);
       loadBayes(newGraphName);
       loadDemo(sigttl, sensorttl, mapttl);
       graphName = newGraphName;
    });

    const demoScenarioSelect = document.getElementById("demoScenarioSelect");
    demoScenarioSelect.addEventListener('change', (event) => {
       const [scenariottl, scenarioactionsttl] = event.target.value.split(' ');
       updatetextAndRestartSim(scenariottl, scenarioactionsttl, "scenario-data", "scenarioactions-data");
       //console.log("select", sigttl, mapttl, scenariottl);
       //loadDemo(sigttl, mapttl, scenariottl);
    });
    
    const inferBtn = document.getElementById("infer-btn");
    inferBtn.addEventListener('click', (event) => {
      console.log('infer button clicked');
      //const obs = document.getElementById("simobs-data").value.split('\n');
      const obsttl = document.getElementById("simobs-data").value;
      makeObsFunc(obsttl);
    });

    let prevGraphName = undefined;
    const tabEl = document.querySelector('#pills-tab button[data-bs-target="#pills-sim"]');
    tabEl.addEventListener('show.bs.tab', event => {
      if (graphName !== prevGraphName) {
        // disable/enable scenario options for this graph
        for (const option of document.getElementById("demoScenarioSelect").options) {
          const appliesTo = option.dataset.appliesToGraphs.split(' ');
          option.disabled = !appliesTo.includes(graphName);
        }
        document.getElementById("demoScenarioSelect").value = document.querySelector("#demoScenarioSelect option:not([disabled])").value;
        const [scenariottl, scenarioactionsttl] = document.getElementById("demoScenarioSelect").value.split(' ');
        updatetextAndRestartSim(scenariottl, scenarioactionsttl, "scenario-data", "scenarioactions-data");
        prevGraphName = graphName;
      }
    });

    function updatetextAndRestartSim(uri1, uri2, id1, id2) {
      Promise.all([
        fetchtext(uri1),
        fetchtext(uri2),
      ]).then(data => {
        const [data1, data2] = data;
        document.getElementById(id1).value = data1;
        document.getElementById(id2).value = data2;
        restartSim();
      });
    }
});


function fetchtext(url) {
  return fetch(url).then(response => response.text());
}



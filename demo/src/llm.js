import * as $rdf from "rdflib";
import { Namespace } from "rdflib";
import { key } from "./secrets.js";
const { Configuration, OpenAIApi } = require("openai");

export {
  makeObsLLM,
}

const RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#");
const XSD = Namespace("http://www.w3.org/2001/XMLSchema#");
const SIGNAL = Namespace("http://signalkg.visualmodel.org/skg#");
const POSE = Namespace("http://signalkg.visualmodel.org/pose#");
const BUILDING = Namespace("https://w3id.org/rec/building/");
const ASSET = Namespace("https://w3id.org/rec/asset/");
const SOSA = Namespace("http://www.w3.org/ns/sosa/");

function getName(uri) {
  // take last part of URI after # or /
  return uri.split(/#|\//).at(-1);
}

function camelCaseToWords(str) {
  // https://stackoverflow.com/questions/4514144/js-string-split-without-removing-the-delimiters
  return str.split(/(?=[A-Z])/).join(" ").toLowerCase();
}

const configuration = new Configuration({
  apiKey: key,
});
const openai = new OpenAIApi(configuration);

function reprSensor(mapStore, sensor) {
  const x = parseFloat(mapStore.any(sensor, POSE('x'), undefined).value);
  const y = parseFloat(mapStore.any(sensor, POSE('y'), undefined).value);
  const z = parseFloat(mapStore.any(sensor, POSE('z'), undefined).value);
  const pitch = parseFloat(mapStore.any(sensor, POSE('pitch'), undefined).value);
  const roll = parseFloat(mapStore.any(sensor, POSE('roll'), undefined).value);
  const yaw = parseFloat(mapStore.any(sensor, POSE('yaw'), undefined).value);
  
  // const geometry = new THREE.CylinderGeometry( 0, SENSOR_RADIUS, SENSOR_THICKNESS, 32);
  // const mesh = new THREE.Mesh( geometry, material );
  // mesh.position.set( x, y, z );
  // mesh.rotation.set( roll, pitch, yaw + Math.PI/2);
  // scene.add( mesh );

  // const geometry = new THREE.BoxGeometry( SENSOR_THICKNESS, SENSOR_WIDTH, SENSOR_HEIGHT, 32);
  // const mesh = new THREE.Mesh( geometry, material );
  
  // const lensGeometry = new THREE.CylinderGeometry( 0, SENSOR_RADIUS, SENSOR_THICKNESS, 32);
  // const lensMesh = new THREE.Mesh( lensGeometry, material );
  // lensMesh.rotation.set( 0, 0, Math.PI/2 );
  // lensMesh.position.set( SENSOR_THICKNESS/2, 0, 0 );
  // mesh.add( lensMesh );
  
  // https://github.com/mrdoob/three.js/blob/master/examples/css2d_label.html


  const sensorName = getName(sensor.uri)
  var sensorType = mapStore.each(sensor, RDF('type')).map(s => camelCaseToWords(getName(s.uri))).join(" and ");
  
  // hack for mic and cams
  // if (sensorName.startsWith("mic")) {
  //   sensorType = "microphone";
  // } else if (sensorName.startsWith("cam")) {
  //   sensorType = "camera"
  // }
  
  // find closest named area / room
  const dists = [];
  var areas1 = mapStore.each(undefined, RDF('type'), BUILDING('DiningRoom'));
  console.log(areas1);
  var areas2 = mapStore.each(undefined, RDF('type'), BUILDING('ConferenceRoom'));
  console.log(areas2);
  const areas = areas1.concat(areas2);
  console.log(areas);
  for (const area of areas) {
    const area_x = parseFloat(mapStore.any(area, POSE('x'), undefined).value);
    const area_y = parseFloat(mapStore.any(area, POSE('y'), undefined).value);
    const area_z = parseFloat(mapStore.any(area, POSE('z'), undefined).value);
    const dist = Math.sqrt((area_x - x)**2 + (area_y - y)**2 + (area_z - z)**2);
    dists.push([dist, area]);
  }
  dists.sort((a, b) => a[0] - b[0]);
  var sensorLoc = "unknown location";
  console.log(dists)
  if (dists.length > 0) {
    sensorLoc = camelCaseToWords(getName(mapStore.any(dists[0][1], RDF('type')).uri));
  }

  return `${sensorName} is a ${sensorType} located in a ${sensorLoc}.`;
  // console.log("sensor", x, y, z, pitch, roll, yaw);

  // scene.add( mesh );
}

function makeObsLLM(obsttl, sensorkg, map, gptVersion) {
  // todo: pass sensorkg, map
  let obsStore = $rdf.graph();
  try {
    $rdf.parse(obsttl, obsStore, window.location.href, 'text/turtle');
  } catch (err) {
    console.log(err);
  }
  
  // convert sensor locations to text
  // adapted from vis.js
  let combinedStore = $rdf.graph();
  // try {
  //     $rdf.parse(signalkg, combinedStore, window.location.href, 'text/turtle');
  // } catch (err) {
  //     console.log(err);
  // }
  try {
      $rdf.parse(sensorkg, combinedStore, window.location.href, 'text/turtle');
  } catch (err) {
      console.log(err);
  }
  try {
      $rdf.parse(map, combinedStore, window.location.href, 'text/turtle');
  } catch (err) {
      console.log(err);
  }
  // try {
  //     $rdf.parse(scenario, combinedStore, window.location.href, 'text/turtle');
  // } catch (err) {
  //     console.log(err);
  // }
  // try {
  //     $rdf.parse(scenarioactions, combinedStore, window.location.href, 'text/turtle');
  // } catch (err) {
  //     console.log(err);
  // }
  
  var prompt = "";
  
  var sensors = combinedStore.each(undefined, RDF('type'), SOSA('Sensor'));
  for (const sensor of sensors) {
      prompt += reprSensor(combinedStore, sensor) + " "
  }
  console.log(`new prompt is {prompt}`)
  console.log(sensors)
  
  // convert sensor observations to text
  var obstext = [];
  var obs = obsStore.each(undefined, RDF('type'), SOSA('Observation'));
  for (const ob of obs) {
    const sig = obsStore.any(ob, SOSA('observedProperty'), undefined);
    const sensor = obsStore.any(ob, SOSA('madeBySensor'), undefined);
    const sig_shortname = camelCaseToWords(getName(sig.uri));
    const sensor_shortname = getName(sensor.uri);

    // hack for mic and cams
    var action = "observed";
    if (sensor_shortname.startsWith("mic")) {
      action = "detected the sound of";
    } else if (sensor_shortname.startsWith("cam")) {
      action = "detected a";
    }
    
    obstext.push(`${sensor_shortname} ${action} ${sig_shortname}. `);
  }

  for (const o of obstext) {
    prompt += o;
  }
  
  //prompt += "What is the most likely cause? Answer step by step";
  prompt += "What is the level of threat? Answer step by step. Then respond 'green' if not a threat, 'orange' if low/medium threat, or 'red' if high threat.";
  
  console.log(prompt);
  
  var logs = "PROMPT: " + prompt;
  document.getElementById("llmdisplay").innerText = logs;
  
  // https://stackoverflow.com/questions/72139717/how-can-i-load-the-openai-api-configuration-through-js-in-html
  
  // Treat an async function as if it was a promise
  openai.createChatCompletion({
    model: gptVersion,
    messages: [
      {"role": "system", "content": "You are an intelligence officer. Reason about the cause of sensor observations to determine the level of threat."},
      {"role": "user", "content": prompt}
      // {"role": "user", "content": "An unidentified person is seen entering a building. They are seen carrying a lighter and fuel. Later the smoke alarm in the building goes off. What is the most likely cause? Answer step by step"}
    ]
  }).then((response) => {
    console.log(response);
    
    const content = response["data"]["choices"][0]["message"]["content"];
    console.log(content);
    
    logs += "\n\n\nRESPONSE:\n" + content;
    
    var result = "<span style='color:gray;font-weight:bold'>GREY</span> (uncertain)";
    
    window.globContent = content;
    
    const matches = content.toLowerCase().match(/\b(red|orange|green|grey)\b/g);
    if (matches) {
      const lastColor = matches.at(-1);
      if (lastColor === "red") {
        result = "<span style='color:red;font-weight:bold'>RED</span (high threat)>";
      } else if (lastColor === "orange") {
        result = "<span style='color:orange;font-weight:bold'>ORANGE</span> (low/medium threat)";
      } else if (lastColor === "green") {
        result = "<span style='color:green;font-weight:bold'>GREEN</span> (not a threat)";
      }
    }
    
    //logs += "\n\n\nCLASSIFICATION: " + result;
    
    document.getElementById("llmdisplay").innerText = logs;
    document.getElementById("llmresult").innerHTML = "\n\n\nCLASSIFICATION: " + result;;
  });
};

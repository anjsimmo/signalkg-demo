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
const SOSA = Namespace("http://www.w3.org/ns/sosa/");

function getName(uri) {
  return uri.split('#').at(-1);
}

function getSimplifiedNodeName(nodename) {
  if (nodename.endsWith("_action")) {
    const parts = nodename.split('_');
    return 'a_' + parts[1] + '_' + parts[2];
  }
  if (nodename.split("_").at(-2) === "signal") {
    const parts = nodename.split('_');
    return 's_' + parts[5] + '_' + parts[2];
  }
  if (nodename.endsWith("strength")) {
    const parts = nodename.split('_');
    return 'r_' + parts[5] + '_' + parts[2];
  }
  if (nodename.startsWith("det")) {
    const parts = nodename.split('_');
    return 'd_' + parts[1] + '_' + parts[2];
  }
  return nodename;
}

const configuration = new Configuration({
  apiKey: key,
});
const openai = new OpenAIApi(configuration);

function makeObsLLM(obsttl) {
  let obsStore = $rdf.graph();
  try {
    $rdf.parse(obsttl, obsStore, window.location.href, 'text/turtle');
  } catch (err) {
    console.log(err);
  }
  
  var obstext = [];
  
  var obs = obsStore.each(undefined, RDF('type'), SOSA('Observation'));
  for (const ob of obs) {
    const sig = obsStore.any(ob, SOSA('observedProperty'), undefined);
    const sensor = obsStore.any(ob, SOSA('madeBySensor'), undefined);
    const sig_shortname = getName(sig.uri);
    const sensor_shortname = getName(sensor.uri);
    obstext.push(`${sensor_shortname} detected ${sig_shortname}. `);
  }

  var prompt = "";
  for (const o of obstext) {
    prompt += o;
  }
  
  //prompt += "What is the most likely cause? Answer step by step";
  prompt += "What is the level of threat? Answer step by step. Then respond 'green' if not a threat, 'orange' if low/medium threat, 'red' if high threat, or 'grey' if unsure.";
  
  console.log(prompt);
  
  var logs = "PROMPT: " + prompt;
  document.getElementById("llmdisplay").innerText = logs;
  
  // https://stackoverflow.com/questions/72139717/how-can-i-load-the-openai-api-configuration-through-js-in-html
  
  // Treat an async function as if it was a promise
  openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {"role": "user", "content": prompt}
      // {"role": "user", "content": "An unidentified person is seen entering a building. They are seen carrying a lighter and fuel. Later the smoke alarm in the building goes off. What is the most likely cause? Answer step by step"}
    ]
  }).then((response) => {
    console.log(response);
    
    const content = response["data"]["choices"][0]["message"]["content"];
    console.log(content);
    
    logs += "\n\n\nRESPONSE: " + content;
    
    var result = "GREY";
    if (content.toLowerCase().includes("red")) {
      result = "RED";
    } else if (content.toLowerCase().includes("orange")) {
      result = "ORANGE";
    } else if (content.toLowerCase().includes("green")) {
      result = "GREEN";
    }
    
    logs += "\n\n\nCLASSIFICATION: " + result;
    
    document.getElementById("llmdisplay").innerText = logs;
  });
};

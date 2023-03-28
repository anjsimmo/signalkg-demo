import jsbayesviz from 'jsbayes-viz';
import jsbayes from 'jsbayes';
import * as $rdf from "rdflib";
import { Namespace } from "rdflib";


export {
  bayes,
  simulateAction
}

const RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#");
const XSD = Namespace("http://www.w3.org/2001/XMLSchema#");
const SOSA = Namespace("http://www.w3.org/ns/sosa/");

// const BN_VIS_WIDTH = 1700;
// const BN_VIS_HEIGHT = 500;
const BN_VIS_WIDTH = 4000;
const BN_VIS_HEIGHT = 500;

function getName(uri) {
  return uri.split('#').at(-1);
}


let cache = new Map();

async function getLearnedGraph(graphName) {
  const cachedResult = cache.get(graphName);
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const response = await fetch(graphName)
  const data = response.json();
  cache.set(graphName, data);
  return data;
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

function getFullNodeName(nodename) {
  return nodename;
}

function getNumCols(node) {
  return node.values.length;
}

// Adapted from https://run.plnkr.co/plunks/GFcem156HC2EwRECmtyH/
function getNumRows(node) {
  if (node.parents.length === 0) {
    return -1;
  } else {
    var rows = 1;
    for (var i = 0; i < node.parents.length; i++) {
      var pa = node.parents[i];
      rows *= pa.values.length;
    }
    return rows;
  }
}

// Adapted from https://run.plnkr.co/plunks/GFcem156HC2EwRECmtyH/
function getCpt(node, probs) {
  var cols = getNumCols(node);
  var rows = getNumRows(node);
  var cpt = [];
  if (rows === -1) {
    cpt = probs;
  } else {
    var counter = 0;
    for (var r = 0; r < rows; r++) {
      var arr = [];
      for (var c = 0; c < cols ; c++) {
        arr[c] = probs[counter];
        counter++;
      }
      cpt.push(arr);
    }
  }
  return cpt;
}

// Adapted from https://run.plnkr.co/plunks/GFcem156HC2EwRECmtyH/
async function getGraph(graphName, simplifyFunc) {
  var graph = jsbayes.newGraph();
  graph.saveSamples = true;
  
  var learnedGraph = await getLearnedGraph(graphName);
  var nodes = { };
  var cpts = { };
  
  for (var i = 0; i < learnedGraph.nodes.length; i++) {
    var node = learnedGraph.nodes[i];
    var n = graph.addNode(simplifyFunc(node.name), node.values);
    nodes[node.id] = n;
    cpts[node.id] = node.cpts;
  }
  
  for (var i = 0; i < learnedGraph.edges.length; i++) {
    var edge = learnedGraph.edges[i];
    var pa = nodes[edge.parent];
    var ch = nodes[edge.child];
    ch.addParent(pa);
  }
  
  for (var nodeId in nodes) {
    var node = nodes[nodeId];
    var probs = cpts[nodeId];
    var cpt = getCpt(node, probs);
    node.setCpt(cpt);
  }
      
  return graph;
}

async function bayes(graphName) {
  var graph = await getGraph(graphName, getSimplifiedNodeName);
  graph.sample(20000);
  var g = jsbayesviz.fromGraph(graph);

  // DEBUG
  // window.graph = graph;
  // window.g = g;
  // window.jsbayesviz = jsbayesviz;
  // window.jsbayes = jsbayes;
  document.getElementById("bbn").innerHTML = ""; // Need to purge as workaround to force redraw
  jsbayesviz.draw({
    id: '#bbn',
    width: BN_VIS_WIDTH,
    height: BN_VIS_HEIGHT,
    graph: g,
    samples: 20000
  });
  
  // function unobserveAll() {
  //   for (var node of g.nodes) {
  //     graph.unobserve(node.name);
  //   }
  // }

  function makeObs(obsttl) {
    let obsStore = $rdf.graph();
    try {
      $rdf.parse(obsttl, obsStore, window.location.href, 'text/turtle');
    } catch (err) {
        console.log(err);
    }
    
    var obsnames = [];
    
    var obs = obsStore.each(undefined, RDF('type'), SOSA('Observation'));
    for (const ob of obs) {
      const sig = obsStore.any(ob, SOSA('observedProperty'), undefined);
      const sensor = obsStore.any(ob, SOSA('madeBySensor'), undefined);
      if (sig && sensor) {
        const sig_shortname = getName(sig.uri);
        const sensor_shortname = getName(sensor.uri);
        obsnames.push(getSimplifiedNodeName(`det_${sensor_shortname}_${sig_shortname}`));
      } else {
        console.log(`WARNING: signal/sensor was not found for ob ${ob}`);
      }
    }
    var condMessages = [];
    for (var node of graph.nodes) {
      if (node.name.startsWith('d_')) {
        var condMessage = `${node.name}=0`
        graph.observe(node.name, '0');
        for (const o of obsnames) {
          if (o.length > 0 && node.name === o) {
            graph.observe(node.name, '1');
            condMessage = `${node.name}=1`
          }
        }
        condMessages.push(condMessage)
      } else {
        // leave any other nodes unobserved
        graph.unobserve(node.name);
      }
    }
    
    graph.sample(20000);
    jsbayesviz.redrawProbs({
      id: '#bbn',
      width: BN_VIS_WIDTH,
      height: BN_VIS_HEIGHT,
      graph: g,
      samples: 20000
    });
    var conditions = condMessages.join(", ");
    var message = "";
    for (var node of graph.nodes) {
      if (!node.name.includes("_")) {// top level node
        const idx = node.values.indexOf('1')
        const pr = node.probs()[idx];
        message += `P(${node.name}=1 | ${conditions}) ≈ ${pr.toFixed(3)}<br />`
      }
    }    
    document.getElementById("prdisplay").innerHTML = message
  }
  
  return [graph, g, makeObs];
}

function simulateAction (graphName, actionCatInfo, time, logCallback) {
  // this function needs to respond quickly, hence we only use a small sample size (trade accuracy for performance)
  const [entity, action, location] = actionCatInfo.split('_');
  var log = `An ${entity} performed action ${action} in/on ${location}.\n`;
  var observations = [];

  getGraph(graphName, getFullNodeName).then(simGraph => {
    for (const node of simGraph.nodes) {
      if (node.name.endsWith('_action')) {
        simGraph.observe(node.name, '0');
      }
    }
    // condition graph on actionCatInfo
    simGraph.observe(actionCatInfo, '1');
    
    simGraph.sample(2000).then(function(r) {
      var signalPrs = [];
      for (const node of simGraph.nodes) {
        if (node.name.split('_').at(-2) === 'signal') {
          const idx = node.values.indexOf('1');
          const pr = node.probs()[idx];
          signalPrs.push([node.name, pr]);
        }
      }
      
      var triggeredSignals = [];
      var untriggeredSignals = [];
      for (const [signal, signalPr] of signalPrs) {
        const signal_occured = Math.random() < signalPr;
        if (signal_occured) {
          triggeredSignals.push(signal);
          log += `This created signal ${signal.split('_').at(-1)}.\n`;
        } else {
          untriggeredSignals.push(signal);
        }
      }
      // condition graph on signals
      for (const signal of triggeredSignals) {
        simGraph.observe(signal, '1');
      }
      for (const signal of untriggeredSignals) {
        simGraph.observe(signal, '0');
      }
      
      simGraph.sample(2000).then(function(r) {
        var detectPrs = [];
        
        for (const node of simGraph.nodes) {
          if (node.name.startsWith('det')) {
            const idx = node.values.indexOf('1');
            const pr = node.probs()[idx];
            detectPrs.push([node.name, pr])
          }
        }
        
        for (const [detector, detectionPr] of detectPrs) {
          const [, sensor, signal] = detector.split('_');
          // Todo: exclude irrelevant signal types
          const detection_occured = Math.random() < detectionPr;
          if (detection_occured) {
            log += `Signal ${signal} detected by sensor ${sensor} (pr=${detectionPr.toFixed(3)}).\n`;
            observations.push([sensor, signal, time]);
          } else {
            if (detectionPr > 0.05) { // don't log if low prior pr (to avoid spam in simulation logs)
              log += `Signal ${signal} not detected by sensor ${sensor} (pr=${detectionPr.toFixed(3)}).\n`;
            }
          }
        }
        log = "\n" + log;
        logCallback(log, observations);
      });
    });
  });
}

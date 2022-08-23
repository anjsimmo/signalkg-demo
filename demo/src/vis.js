import * as THREE from 'three';
import * as $rdf from "rdflib";
import { Namespace } from "rdflib";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import jsbayesviz from 'jsbayes-viz';
import jsbayes from 'jsbayes';

const SIM_START_DATETIME = '2022-06-28T10:00:00';

const RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#");
const XSD = Namespace("http://www.w3.org/2001/XMLSchema#");
const SIGNAL = Namespace("http://signalkg.visualmodel.org/skg#");
const POSE = Namespace("http://signalkg.visualmodel.org/pose#");
const BUILDING = Namespace("https://w3id.org/rec/building/");
const ASSET = Namespace("https://w3id.org/rec/asset/");
const SOSA = Namespace("http://www.w3.org/ns/sosa/");

const ENTITY_RADIUS = 0.3;
const ENTITY_HEIGHT = 1.0;

const SENSOR_WIDTH = 0.3;
const SENSOR_HEIGHT = 0.3;
const SENSOR_RADIUS = 0.15;
const SENSOR_THICKNESS = 0.3;

function getName(uri) {
  return uri.split('#').at(-1);
}

function drawBarrier(scene, mapStore, barrier, material) {
  //console.log(barrier);
  const x = parseFloat(mapStore.any(barrier, POSE('x'), undefined).value);
  const y = parseFloat(mapStore.any(barrier, POSE('y'), undefined).value);
  const z = parseFloat(mapStore.any(barrier, POSE('z'), undefined).value);
  const pitch = parseFloat(mapStore.any(barrier, POSE('pitch'), undefined).value);
  const roll = parseFloat(mapStore.any(barrier, POSE('roll'), undefined).value);
  const yaw = parseFloat(mapStore.any(barrier, POSE('yaw'), undefined).value);
  const thickness = parseFloat(mapStore.any(barrier, POSE('thickness'), undefined).value);
  const width = parseFloat(mapStore.any(barrier, POSE('width'), undefined).value);
  const height = parseFloat(mapStore.any(barrier, POSE('height'), undefined).value);
  //console.log(x, y, z, pitch, roll, yaw, thickness, width, height);
  
  const geometry = new THREE.BoxGeometry( thickness, width, height );
  const cube = new THREE.Mesh( geometry, material );
  cube.position.set( x, y, z + height/2);
  cube.rotation.set( roll, pitch, yaw );
  scene.add( cube );
}

function drawSensor(scene, mapStore, sensor, material) {
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

  const geometry = new THREE.BoxGeometry( SENSOR_THICKNESS, SENSOR_WIDTH, SENSOR_HEIGHT, 32);
  const mesh = new THREE.Mesh( geometry, material );
  
  const lensGeometry = new THREE.CylinderGeometry( 0, SENSOR_RADIUS, SENSOR_THICKNESS, 32);
  const lensMesh = new THREE.Mesh( lensGeometry, material );
  lensMesh.rotation.set( 0, 0, Math.PI/2 );
  lensMesh.position.set( SENSOR_THICKNESS/2, 0, 0 );
  mesh.add( lensMesh );
  
  // https://github.com/mrdoob/three.js/blob/master/examples/css2d_label.html
  const entityDiv = document.createElement( 'div' );
  entityDiv.className = 'label';
  entityDiv.innerHTML = '<span style="color:darkblue">sensor=' + getName(sensor.uri) + '</span>';
  entityDiv.style.marginTop = '-1em';
  const entityLabel = new CSS2DObject( entityDiv );
  entityLabel.position.set( 0, 0, 0 );
  mesh.add( entityLabel );

  mesh.position.set( x, y, z);
  mesh.rotation.set( roll, pitch, yaw );

  console.log("sensor", x, y, z, pitch, roll, yaw);

  scene.add( mesh );
}

function drawEntity(scene, scenarioStore, entity, material, inVehicle) {
  if (inVehicle) {
    material.transparent = true;
    material.opacity = 0.0; // hide the entity and just draw a vehicle
  }
  //console.log(entity);
  const geometry = new THREE.CylinderGeometry( ENTITY_RADIUS, ENTITY_RADIUS, ENTITY_HEIGHT, 32);
  const mesh = new THREE.Mesh( geometry, material );
  
  const headGeometry = new THREE.SphereGeometry( ENTITY_RADIUS, 32, 16 );
  const headMesh = new THREE.Mesh( headGeometry, material );
  headMesh.position.set( 0, ENTITY_HEIGHT/2 + ENTITY_RADIUS, 0 );
  mesh.add( headMesh );
  
  // https://github.com/mrdoob/three.js/blob/master/examples/css2d_label.html
  const entityDiv = document.createElement( 'div' );
  entityDiv.className = 'label';
  entityDiv.textContent = 'MyEntity';
  entityDiv.style.marginTop = '-1em';
  const entityLabel = new CSS2DObject( entityDiv );
  entityLabel.position.set( 0, ENTITY_HEIGHT/2 + ENTITY_RADIUS*2, 0 );
  mesh.add( entityLabel );

  mesh.rotation.set( Math.PI/2, 0, 0 );
  mesh.position.set( 0, 0, ENTITY_HEIGHT/2 );
  scene.add( mesh );

  if (inVehicle) {
    // Relevant 3D models
    // Car model extraced from: https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5
    console.log(`adding loader for mesh ${mesh}`)
    const loader = new GLTFLoader();
    //loader.load( 'assets/ToyCar.glb', function ( gltf ) {
    //loader.load('assets/opel_astra_gtc_2012/scene.gltf', function ( gltf ) {
    loader.load('assets/car.glb', function ( gltf ) {
      console.log(`loaded asset for mesh ${mesh}`)
      //gltf.scene.scale.set( 0.5, 0.5, 0.5 );
      // mesh.add( gltf.scene );
      //gltf.scene.scale.set( 0.005, 0.005, 0.005 );
      gltf.scene.position.set( 0, -ENTITY_HEIGHT/2, 0)
      mesh.add( gltf.scene );
      //scene.add( gltf.scene );
      console.log(`added asset to mesh ${mesh}`)
    }, undefined, function ( error ) {
      console.error( error );
    } );
  }

  return [mesh, entityDiv];
}

function lerp(x0, x1, t0, t1, t) {
  return x0 + (x1 - x0) * (t - t0) / (t1 - t0);
}

function lerpxyz(x0, y0, z0, x1, y1, z1, t0, t1, t) {
  const x = lerp(x0, x1, t0, t1, t);
  const y = lerp(y0, y1, t0, t1, t);
  const z = lerp(z0, z1, t0, t1, t);
  return [x, y, z];
}

function doMovement(scene, scenarioStore, action, entity, entityMesh, entityDiv, simTime) {
  const startTime = Date.parse(scenarioStore.any(action, SIGNAL('startTime'), undefined).value);
  if (simTime < startTime) {
    return;
  }
  const endTime = Date.parse(scenarioStore.any(action, SIGNAL('endTime'), undefined).value);
  if (simTime > endTime) {
    return;
  }
  const startState = scenarioStore.any(action, SIGNAL('startState'), undefined);
  const x0 = parseFloat(scenarioStore.any(startState, POSE('x'), undefined).value);
  const y0 = parseFloat(scenarioStore.any(startState, POSE('y'), undefined).value);
  const z0 = parseFloat(scenarioStore.any(startState, POSE('z'), undefined).value);
  const endState = scenarioStore.any(action, SIGNAL('endState'), undefined);
  const x1 = parseFloat(scenarioStore.any(endState, POSE('x'), undefined).value);
  const y1 = parseFloat(scenarioStore.any(endState, POSE('y'), undefined).value);
  const z1 = parseFloat(scenarioStore.any(endState, POSE('z'), undefined).value);
  const [x, y, z] = lerpxyz(x0, y0, z0, x1, y1, z1, startTime, endTime, simTime);
  entityMesh.position.set( x, y, z + ENTITY_HEIGHT/2);
  entityMesh.rotation.set( Math.PI/2, 0, 0);
  
  // rotate in direction of next point
  const diff = (new THREE.Vector3(x1,y1,z1)).sub(new THREE.Vector3(x0,y0,z0))
  diff.normalize();
  const defaultAxis = new THREE.Vector3(0,1,0); // without rotation vehicle would be pointing in y direction
  const rotationQuaternion = (new THREE.Quaternion()).setFromUnitVectors(defaultAxis, diff);
  window.entityMesh = entityMesh;
  window.matrix = entityMesh.matrix;
  entityMesh.applyQuaternion(rotationQuaternion);

  const actionCat = scenarioStore.any(action, SIGNAL('actionCategory'));
  const entityCat = scenarioStore.any(entity, SIGNAL('entityCategory'));
  const locCat = scenarioStore.any(action, SIGNAL('concreteActsOn'));

  entityDiv.innerHTML = '<span style="color:orange">entity=' + getName(entity.uri) + '</span><br />' + '<span style="color:darkgreen">action=' + getName(actionCat.uri) + '</span><br />' + '<span style="color:gray">actsOn=' + getName(locCat.uri) + '</span>';
  return [entityCat, actionCat, locCat];
}

export default function vis(graphName, signalkg, sensorkg, map, scenario, scenarioactions, bayesgraph, bayesvizgraph, simulateActionCallback) {
  const RENDER_WIDTH = document.getElementById("vis").offsetWidth;
  const RENDER_HEIGHT = document.getElementById("vis").offsetHeight;
  
  let camera, controls, scene, renderer, labelRenderer, start, previousTimeStamp;
  // entityUri -> entityMesh, entityDiv
  const entityMap = new Map();
  // entityUri -> actionCatInfo
  const entityActionMap = new Map();

  let combinedStore = $rdf.graph();

  let running = true;
  try {
      $rdf.parse(signalkg, combinedStore, window.location.href, 'text/turtle');
  } catch (err) {
      console.log(err);
  }
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
  try {
      $rdf.parse(scenario, combinedStore, window.location.href, 'text/turtle');
  } catch (err) {
      console.log(err);
  }
  try {
      $rdf.parse(scenarioactions, combinedStore, window.location.href, 'text/turtle');
  } catch (err) {
      console.log(err);
  }
  const simStart = Date.parse(SIM_START_DATETIME);
  
  init();
  requestAnimationFrame( animate );
  return stop;

  function init() {
    // https://stackoverflow.com/questions/8272297/three-js-rotate-projection-so-that-the-y-axis-becomes-the-z-axis
    THREE.Object3D.DefaultUp.set(0, 0, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000 );
    renderer = new THREE.WebGLRenderer();
    // https://stackoverflow.com/questions/16177056/changing-three-js-background-to-transparent-or-other-color
    renderer.setClearColor( 0xffffff );
    renderer.setSize( RENDER_WIDTH, RENDER_HEIGHT );
    renderer.setSize( RENDER_WIDTH, RENDER_HEIGHT );
    document.getElementById("vis").appendChild( renderer.domElement );

    // https://github.com/mrdoob/three.js/blob/master/examples/css2d_label.html
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize( RENDER_WIDTH, RENDER_HEIGHT );
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    document.getElementById("vis").appendChild( labelRenderer.domElement );


    var walls = combinedStore.each(undefined, RDF('type'), BUILDING('Wall'));
    for (const wall of walls) {
      const material = new THREE.MeshPhongMaterial( { color: 0x888888 } );
      drawBarrier(scene, combinedStore, wall, material);
    }

    var barriers = combinedStore.each(undefined, RDF('type'), ASSET('BarrierAsset'));
    for (const barrier of barriers) {
      const material = new THREE.MeshPhongMaterial( { color: 0x888888 } );
      drawBarrier(scene, combinedStore, barrier, material);
    }

    var windows = combinedStore.each(undefined, RDF('type'), ASSET('Window'));
    for (const wind of windows) {
      const material = new THREE.MeshPhongMaterial( { color: 0x0000ff } );
      material.transparent = true;
      material.opacity = 0.2;
      drawBarrier(scene, combinedStore, wind, material);
    }

    var sensors = combinedStore.each(undefined, RDF('type'), SOSA('Sensor'));
    for (const sensor of sensors) {
      const material = new THREE.MeshPhongMaterial( { color: 0x00bbff } );
      drawSensor(scene, combinedStore, sensor, material);
    }

    var entities = combinedStore.each(undefined, RDF('type'), SIGNAL('ConcreteEntity'));
    for (const entity of entities) {
      const material = new THREE.MeshPhongMaterial( { color: 0xff8800 } );
      const entityCat = getName(combinedStore.any(entity, SIGNAL('entityCategory')).uri);
      const drivingEntities = ["safeDriver", "dangerousDriver", "dumper", "evader"];
      const inVehicle = drivingEntities.includes(entityCat);
      const [mesh, entityDiv] = drawEntity(scene, combinedStore, entity, material, inVehicle);
      entityMap.set(entity.uri, [mesh, entityDiv]);
      entityActionMap.set(entity.uri, undefined);
    }
    window.combinedStore = combinedStore;
    window.entities = entities;
    window.RDF = RDF;
    window.SIGNAL = SIGNAL;


    //camera.up = new THREE.Vector3( 0, 0, 1 );
    //camera.position.set( 8, -4, 8 );
    //camera.position.set( 8, -10, 7 );
    if (graphName === "generated/city.json") {
      camera.position.set( 41, -71, 40 );
    } else {
      camera.position.set( 8, -10, 7 );
    }
    
    // https://github.com/mrdoob/three.js/blob/master/examples/webgl_camera_array.html
    scene.add( new THREE.AmbientLight( 0x444444, 2.0 ) );
    const light = new THREE.DirectionalLight();
    light.position.set( 8, -4, 10 );
    scene.add( light );

    //https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_orbit.html
    //controls = new OrbitControls( camera, renderer.domElement );
    controls = new OrbitControls( camera, labelRenderer.domElement );
    //controls.listenToKeyEvents( window ); // optional
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;
    //controls.target.set( 8, -3, 0 );
    if (graphName === "generated/city.json") {
      controls.target.set( 41, -30, 0 ) ;
    } else {
      controls.target.set( 8, -3, 0 );
    }
    

  }

  function animate(timestamp) {
    if (start === undefined) {
        start = timestamp;
    }
    const elapsed = timestamp - start;
    const simTime = simStart + elapsed;
    //console.log("timestamp", timestamp);
    //console.log("start", start);
    //console.log("elapsed", elapsed);
    if (running) {
      requestAnimationFrame( animate );
    }
    
    var actionCats = [];

    var actions = combinedStore.each(undefined, RDF('type'), SIGNAL('ConcreteAction'));
    for (const action of actions) {
      const entity = combinedStore.any(undefined, SIGNAL('concretePerforms'), action);
      const [entityMesh, entityDiv] = entityMap.get(entity.uri);
      const movementInfo = doMovement(scene, combinedStore, action, entity, entityMesh, entityDiv, simTime);
      if (movementInfo !== undefined) {
        const [entityCat, actionCat, locCat] = movementInfo;
        const actionCatInfo = getName(entityCat.uri) + "_" + getName(actionCat.uri) + "_" + getName(locCat.uri) + '_action';
        actionCats.push(actionCatInfo);
        if (entityActionMap.get(entity.uri) !== actionCatInfo) {
          console.log("simulateActionCallback", actionCatInfo, simTime);
          entityActionMap.set(entity.uri, actionCatInfo);
          simulateActionCallback(actionCatInfo, simTime);
        }
      }
    }

    // for (var node of bayesgraph.nodes) {
    //   if (node.name.endsWith('_action')) {
    //     graph.observe(node.name, '0');
    //   } else {
    //     // leave any other nodes unobserved
    //     graph.unobserve(node.name);
    //   }
    // }
    // for (const actionCatInfo of actionCats) {
    //   bayesgraph.observe(actionCatInfo, '1');
    // }
    // bayesgraph.sample(15000);
    // jsbayesviz.redrawProbs({
    //   id: '#bbn',
    //   width: 1800,
    //   height: 750,
    //   graph: bayesvizgraph,
    //   samples: 15000
    // });
    
    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
    renderer.render( scene, camera );
    labelRenderer.render( scene, camera );
  }
  
  function stop() {
    return running = false;
  }
}

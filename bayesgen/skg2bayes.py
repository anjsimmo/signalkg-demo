import math
import itertools
import numpy as np
from scipy.spatial.transform import Rotation as R
from collections import namedtuple
from rdflib import Graph, Namespace, RDF, SKOS, SSN, SOSA
from rdflib.exceptions import UniquenessError
from bayes import BayesGraph, BayesNode
import argparse

SIG = Namespace("http://signalkg.visualmodel.org/skg#")
POSE =  Namespace("http://signalkg.visualmodel.org/pose#")
# SSNSYSTEM = Namespace("http://www.w3.org/ns/ssn/systems/")
Posterior = namedtuple("Posterior", ["pr", "num_hypo", "num_valid"])
Location = namedtuple("Location", ["x", "y", "z"])
Orientation = namedtuple("Orientation", ["roll", "pitch", "yaw"])


def _capitalise(s):
    # capitalise just the first letter, leave rest as is
    return s[0:1].upper() + s[1:]


def get_name(uriref):
    return uriref.split('#')[-1]


def extract_loc(g, inst):
    return Location(float(g.value(inst, POSE.x).value), float(g.value(inst, POSE.y).value), float(g.value(inst, POSE.z).value))


def extract_orient(g, inst):
    return Orientation(float(g.value(inst, POSE.roll).value), float(g.value(inst, POSE.pitch).value), float(g.value(inst, POSE.yaw).value))


def pr_actor(g, causal_graph):
    nodes = []

    for person in g.subjects(RDF.type, SIG.Entity):
        n = BayesNode(get_name(person))
        n.add_output_value(1)
        n.add_output_value(0)
        pr_exists = float(g.value(person, SIG.prExists))
        n.add_row([],[pr_exists,1-pr_exists])
        nodes.append(n)

    # for trigger in g.subjects(RDF.type, signal.Trigger):
    #     n = BayesNode(get_name(trigger))
    #     n.add_output_value(1)
    #     n.add_output_value(0)
    #     # Will create the probability table later (once rest of graph is created)
    #     assert len(list(g.objects(trigger, signal.triggerSensor))) > 0
    #     assert len(list(g.objects(trigger, signal.triggerSignal))) > 0
    #     nodes.append(n)

    return nodes


# def link_triggers(g, causal_graph):
#     nodes = []
#     for actor in g.subjects(RDF.type, signal.Trigger):
#         actor_node = causal_graph.get_node(get_name(actor))
#         trigger_sensors = list(g.objects(actor, signal.triggerSensor))
#         trigger_signals = list(g.objects(actor, signal.triggerSignal))
#         assert trigger_sensors
#         assert trigger_signals
#         for sensor in trigger_sensors:
#             for observed_signal in trigger_signals:
#                 sensor_node = causal_graph.get_node("det_" + get_name(sensor) + "_" + get_name(observed_signal))
#                 actor_node.add_condition(sensor_node)
#         # Implement OR condition
#         # [(0, 0, 0, 0, 0), (0, 0, 0, 0, 1), ...]
#         combos = itertools.product([0,1], repeat=len(actor_node.condition_nodes))
#         for combo in combos:
#             if 1 in combo:
#                 # 1 or more 1s => true
#                 actor_node.add_row(combo,[1,0])
#             else:
#                 # all 0s => false
#                 actor_node.add_row(combo,[0,1])


def pr_action_given_actor(g, causal_graph):
    nodes = []
    for actor in list(g.subjects(RDF.type, SIG.Entity)): #+ list(g.subjects(RDF.type, signal.Trigger))
        actions = list(g.objects(actor, SIG.performs))
        for action in actions:
            # Should be of type Action
            assert len(list(g.triples((action, RDF.type, SIG.Action)))) >= 1
            pr = float(g.value(action, SIG.prOccurs).value)
            acts_on = g.objects(action, SIG.actsOn)
            locations = [(ao, extract_loc(g, ao)) for ao_class in acts_on for ao in g.subjects(RDF.type, ao_class)]
            for ao, loc in locations:
                 n = BayesNode(get_name(actor) + "_" + get_name(action) + "_" + get_name(ao) + "_action")
                 actor_node = causal_graph.get_node(get_name(actor))
                 n.actor = actor
                 n.action = action
                 n.source_loc = loc
                 n.add_condition(actor_node)
                 n.add_output_value(1)
                 n.add_output_value(0)
                 n.add_row([0],[0,1])
                 n.add_row([1],[pr,1-pr])
                 n.shortname = get_name(action)
                 nodes.append(n)
    return nodes


def pr_signal_given_action(g, causal_graph):
    nodes = []

    actions = g.subjects(RDF.type, SIG.Action)
    for action in actions:
        signals = g.objects(action, SIG.creates)
        for sig in signals:
            for action_node in causal_graph.get_nodes("_" + get_name(action) + "_"):
                n = BayesNode(action_node.name + "_signal_" + get_name(sig))
                n.actor = action_node.actor
                n.action = action_node.action
                n.source_loc = action_node.source_loc
                n.sig = sig
                n.add_condition(action_node)
                n.add_output_value(1)
                n.add_output_value(0)
                n.add_row([0],[0,1])
                n.add_row([1],[1,0])
                n.shortname = get_name(sig)
                nodes.append(n)
    return nodes


def inverse_square_fall_off(dist):
    # TODO: Convert to decibels?
    if dist == 0:
        return float('inf')

    return 1 / dist**2


def inverse_linear_fall_off(dist):
    # TODO: Convert to decibels?
    if dist == 0:
        return float('inf')

    return 1 / dist


def dist(g, loca, locb):
    return math.sqrt((loca.x-locb.x)**2 + (loca.y-locb.y)**2 + (loca.z-locb.z)**2)


def fov(g, sensor_loc, target_loc, sensor_orient, fov_angle):
    EPSILON = 10 ** -10

    # Return true if target_loc within field of view from sensor_loc
    x1, y1, z1 = sensor_loc
    x2, y2, z2 = target_loc
    roll, pitch, yaw = sensor_orient

    l = np.array([x2-x1, y2-y1, z2-z1])
    
    if np.linalg.norm(l) < EPSILON:
        # ponts are very close, assume line of sight
        return True
    
    l /= np.linalg.norm(l) # normalise to unit vector

    # get a unit vector toward the target (sensor x-axis is the 'thickness' dimension normal to height/width)
    sensor_n = R.from_euler('xyz', [roll, pitch, yaw]).apply([1,0,0])
    
    # cos theta = a dot b / ||a|| ||b||
    # ||a|| = ||b|| = 1
    costheta = np.vdot(l, sensor_n)
    if costheta > math.cos(fov_angle):
        return True

    return False
    

def los(g, loca, locb, inst):
    EPSILON = 10 ** -6
    
    inst_loc = extract_loc(g, inst)
    inst_orient = extract_orient(g, inst)

    # True if line of sight from loca to locb with being blocked by barrier inst
    x1, y1, z1 = loca
    x2, y2, z2 = locb
    w = float(g.value(inst, POSE.width).value)
    h = float(g.value(inst, POSE.height).value)
    # depth is ignored (assume flat surface)
    x, y, z = inst_loc
    roll, pitch, yaw = inst_orient

    # https://en.wikipedia.org/w/index.php?title=Line%E2%80%93plane_intersection&oldid=1030561834#Parametric_form
    # pick p0 as the centre of the plane (e.g. wall)
    p0 = np.array([x, y, z])
    r = R.from_euler('xyz', [roll, pitch, yaw])
    # pick p1 as the top of the plane (height/2 in the z-axis)
    p1 = r.apply([0,0,h/2])
    # pick p2 as point at side of plane (width/2 in the y-axis)
    p2 = r.apply([0,w/2,0])
    # pick la as loca
    la = np.array([x1, y1, z1])
    # pick lb as locb
    lb = np.array([x2, y2, z2])

    lab = lb - la
    if np.linalg.norm(lab) < EPSILON:
        # loca and locb are very close, assume line of sight
        return True
    
    # solution for line plane intersection in parametric form
    t = np.cross(p1, p2).dot((la - p0)) / (-lab).dot(np.cross(p1, p2))
    u = np.cross(p2, -lab).dot(la - p0) / (-lab).dot(np.cross(p1, p2))
    v = np.cross(-lab, p1).dot(la - p0) / (-lab).dot(np.cross(p1, p2))
    #print(t, u, v)

    if t < EPSILON:
        # Barrier is behind us (or very close to loca)
        return True
    if t > 1 - EPSILON:
        # Barrier is further away than locb (or very close to locb)
        return True

    # Adding padding of EPSILON ensures no gap between walls that just touch
    hit = abs(u) <= 1 + EPSILON and abs(v) <= 1 + EPSILON
    return not hit


def get_reduction_factor(fallOff, d):
    if fallOff == SIG.inverseSquare:
        reduction_factor = inverse_square_fall_off(d)
    elif fallOff == SIG.inverseLinear:
        reduction_factor = inverse_linear_fall_off(d)
    elif fallOff == SIG.noFallOff:
        reduction_factor = float('inf')
    else:
        raise Exception(f"Unrecognised falloff {fallOff}")
    return reduction_factor


def pr_signal_strength_given_signal(g, causal_graph):
    sensors = list(g.subjects(RDF.type, SOSA.Sensor))
    
    sensor_locs = []
    for sensor in sensors:
        location = extract_loc(g, sensor)
        sensor_locs.append((sensor, location))
    
    signal_nodes = causal_graph.get_nodes("_signal_")
    
    nodes = []
    for sensor, sensor_loc in sensor_locs:
        for obs_sig in g.objects(sensor, SOSA.observes):
            receiver_model = find_receiver_model(g, obs_sig)
            sensor_observed_signals = set([obs_sig])
            sensor_signals = set(b for obs_sig in sensor_observed_signals for b in get_narrower_signals(g, obs_sig))
            #sensor_signals |= set(b for obs_sig in sensor_observed_signals for b in get_broader_signals(g, obs_sig))
            sensor_signals |= sensor_observed_signals
            
            for signal_node in signal_nodes:
                if not signal_node.sig in sensor_signals:
                    # sensor can't detect this kind of signal (with this receiver model), so ignore
                    continue

                actor = signal_node.actor
                source_loc = signal_node.source_loc
                
                d = dist(g, source_loc, sensor_loc)
                
                fallOff = g.value(receiver_model, SIG.fallOff)
                reduction_factor = get_reduction_factor(fallOff, d)
                
                # Max dist checks
                g_maxdist = g.value(sensor, SIG.maxDistance)
                if g_maxdist is not None:
                    maxdist = float(g_maxdist.value)
                    if d > maxdist:
                        reduction_factor = 0

                # FOV checks
                g_fov = g.value(sensor, SIG.fov)
                if g_fov is not None:
                    fov_angle = float(g_fov.value)
                    sensor_orient = extract_orient(g, sensor)
                    if not fov(g, sensor_loc, source_loc, sensor_orient, fov_angle):
                        #print(f"Out of FOV: {source_loc} from {sensor_loc}")
                        continue

                # LineOfSight checks (where applicable)
                blockedByClasses = list(g.objects(receiver_model, SIG.attenuatedBy))
                blockedByInstances = set()
                for cls in blockedByClasses:
                    blockedByInstances |= set(g.subjects(RDF.type, cls))
                for inst in blockedByInstances:
                    if not los(g, sensor_loc, source_loc, inst):
                        #print(f"BLOCKED: {source_loc} to {sensor_loc} by {inst}")
                        # no signal
                        reduction_factor = 0
                        break
                
                if reduction_factor == 0:
                    # don't include nodes if strength is always 0
                    continue
                
                n = BayesNode(signal_node.name + "_" + get_name(sensor) + "_strength")
                n.actor = signal_node.actor
                n.action = signal_node.action
                n.source_loc = signal_node.source_loc
                n.sig = signal_node.sig
                n.sensor_loc = sensor_loc
                n.sensor = sensor
                n.strength = reduction_factor
                n.add_condition(signal_node)
                n.add_output_value(reduction_factor)
                n.add_output_value(0)
                n.add_row([0],[0,1])
                n.add_row([1],[1,0])
                n.shortname = get_name(n.sig) + "Strength"
                nodes.append(n)
    return nodes


# https://stackoverflow.com/questions/3985619/how-to-calculate-a-logistic-sigmoid-function-in-python
def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def find_receiver_model(g, observed_signal):
    if g.value(observed_signal, SIG.fallOff) is not None:
        return observed_signal
    # TODO: Recurse
    broader_signals = g.objects(observed_signal, SKOS.broader)
    for broader_sig in broader_signals:
        if g.value(broader_sig, SIG.fallOff) is not None:
            return broader_sig
    raise Exception(f"receiver model not found for {observed_signal}")


def get_narrower_signals(g, observed_signal):
    # TODO: Recurse
    narrower_signals = g.subjects(SKOS.broader, observed_signal)
    return narrower_signals


def get_broader_signals(g, observed_signal):
    # TODO: Recurse
    broader_signals = g.objects(observed_signal, SKOS.broader)
    return broader_signals


def pr_det_given_signal_strength_helper(sig_strength, ref_signal, sensitivity):
    adjusted_sensitivity = sensitivity * min(1, sig_strength/ref_signal)
    return adjusted_sensitivity


def pr_det_given_signal_strength(g, causal_graph):
    sensors = list(g.subjects(RDF.type, SOSA.Sensor))
    
    sensor_obs = []
    for sensor in sensors:
        model = g.value(sensor, SSN.implements)
        observed_signals = g.objects(sensor, SOSA.observes)
        sensitivity = float(g.value(model, SIG.sensitivity).value)
        sensor_obs += [(sensor, obssig, sensitivity) for obssig in observed_signals]

    nodes = []
    for sensor, observed_signal, sensitivity in sensor_obs:
        reliabile_distance = float(g.value(sensor, SIG.reliableDistance).value)
        receiver_model = find_receiver_model(g, observed_signal)
        fallOff = g.value(receiver_model, SIG.fallOff)
        ref_signal = get_reduction_factor(fallOff, reliabile_distance) # Reference signal strength for which a classifier works as expected (falls off beyond this)

        narrower_signals = [observed_signal] + list(get_narrower_signals(g, observed_signal))
        strength_nodes = []
        for sig in narrower_signals:
            strength_nodes += causal_graph.get_nodes("_signal_" + get_name(sig) + "_" + get_name(sensor) + "_strength")
        
        n = BayesNode("det_" + get_name(sensor) + "_" + get_name(observed_signal))
        for sn in strength_nodes:
            n.add_condition(sn)
        
        n.add_output_value(1)
        n.add_output_value(0)
        
        strength_combos = []

        for sn in strength_nodes:
            strength_combos.append(sn.output_vals)

        for combo in itertools.product(*strength_combos):
            row_condition = list(combo)
            pr_not_det = 1
            for x in row_condition:
                pr_not_det *= (1 - pr_det_given_signal_strength_helper(float(x), ref_signal, sensitivity))
            pr_det = 1 - pr_not_det
            n.add_row(row_condition,[pr_det, pr_not_det])

        n.shortname = "detect" + _capitalise(get_name(observed_signal))
        nodes.append(n)

    return nodes


def fix_observation_values(g, causal_graph):
    causal_graph.reset_fix_values()
    
    observations = list(g.subjects(RDF.type, SOSA.Observation))

    for obs in observations:
        sensor = g.value(obs, SOSA.madeBySensor)
        sig = g.value(obs, SOSA.observedProperty)
        val = g.value(obs, SOSA.hasSimpleResult)
        
        n = causal_graph.get_node("det_" + get_name(sensor) + "_" + get_name(sig))
        if val == "true":
            val = 1
        if val == "false":
            val = 0
        n.fix_value(int(val))


def gen_causal_graph(g):
    causal_graph = BayesGraph()

    actor_nodes = pr_actor(g, causal_graph)
    for n in actor_nodes:
        causal_graph.add_node(n)

    action_nodes = pr_action_given_actor(g, causal_graph)
    for n in action_nodes:
        causal_graph.add_node(n)

    signal_nodes = pr_signal_given_action(g, causal_graph)
    for n in signal_nodes:
        causal_graph.add_node(n)

    strength_nodes = pr_signal_strength_given_signal(g, causal_graph)
    for n in strength_nodes:
        causal_graph.add_node(n)

    det_nodes = pr_det_given_signal_strength(g, causal_graph)
    for n in det_nodes:
        causal_graph.add_node(n)
    
    #link_triggers(g, causal_graph)

    return causal_graph


class Alarm:
    def __init__(self):
        self.alarm = False
        self.msg = ""
    
    def warn(self, pr, msg):
        self.msg = msg

    def alert(self):
        self.alarm = True
    
    def __repr__(self):
        return f"alarm={self.alarm} - {self.msg}"


def infer_actor_pr(causal_graph, actor_name, actor_val):
    n = causal_graph.get_node(actor_name)
    posterior_pr, num_hypo, num_valid = causal_graph.get_posterior(n, actor_val, sims_count=10000)
    return Posterior(pr = posterior_pr, num_hypo = num_hypo, num_valid = num_valid)


def main():
    parser = argparse.ArgumentParser(description='Convert SKG to Bayesian network')
    parser.add_argument('scenario_kg_files', type=str, nargs='+',
                        help='additional ttl files to include')
    parser.add_argument('--out', metavar="output_file")

    args = parser.parse_args()

    g = Graph()
    for scenario_kg_file in args.scenario_kg_files:
        g += Graph().parse(scenario_kg_file, format='ttl')

    causal_graph = gen_causal_graph(g)

    with open(args.out, "w") as f:
        f.write(causal_graph.to_json())


if __name__ == "__main__":
    main()

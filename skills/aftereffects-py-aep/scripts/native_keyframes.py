"""Generate (never execute) guarded native AE keyframe apply/verify scripts.

A narrow fallback for numeric animation, not a general scene description language.
Times are explicit composition seconds, or integer frames with a declared frame rate.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Expected a finite number")
    return value


def normalize(manifest):
    if manifest.get("version") != 1 or manifest.get("timeUnit") not in ("seconds", "frames"):
        raise ValueError("Require version=1 and explicit timeUnit seconds or frames")
    tracks = manifest.get("tracks")
    if not isinstance(tracks, list) or not tracks:
        raise ValueError("Require nonempty tracks")
    result, seen = [], set()
    for track in tracks:
        cid, lid = track["compId"], track["layerId"]
        if any(type(x) is not int or x <= 0 for x in (cid, lid)):
            raise ValueError("compId/layerId must be positive integer IDs")
        path = track["propertyPath"]
        if not isinstance(path, list) or not path or any(not isinstance(x, str) or not x for x in path):
            raise ValueError("propertyPath must be a nonempty match-name array")
        identity = (cid, lid, tuple(path))
        if identity in seen:
            raise ValueError("Duplicate target track")
        seen.add(identity)
        fps = number(track["frameRate"])
        if fps <= 0:
            raise ValueError("frameRate must be positive")
        keys, previous, dimensions = [], -math.inf, None
        for key in track["keys"]:
            time = number(key["time"])
            if manifest["timeUnit"] == "frames":
                if type(key["time"]) is not int:
                    raise ValueError("Frame times must be integers")
                time /= fps
            if time <= previous:
                raise ValueError("Key times must be strictly increasing")
            previous = time
            value = key["value"]
            if isinstance(value, list):
                if not 1 <= len(value) <= 4:
                    raise ValueError("Only 1-4 numeric components supported")
                value = [number(v) for v in value]
                dim = len(value)
            else:
                value, dim = number(value), 0
            if dimensions is not None and dim != dimensions:
                raise ValueError("Inconsistent value dimensions")
            dimensions = dim
            interpolation = key.get("interpolation", "linear")
            if interpolation not in ("linear", "bezier", "hold"):
                raise ValueError("Unsupported interpolation")
            item = {"time": time, "value": value, "interpolation": interpolation}
            if interpolation == "bezier":
                for direction in ("inEase", "outEase"):
                    ease = key[direction]
                    if not isinstance(ease, list) or not ease:
                        raise ValueError("Bezier requires explicit per-dimension ease arrays")
                    item[direction] = []
                    for pair in ease:
                        if not isinstance(pair, list) or len(pair) != 2:
                            raise ValueError("Ease must contain [speed, influence] pairs")
                        speed, influence = map(number, pair)
                        if not .1 <= influence <= 100:
                            raise ValueError("Influence must be 0.1-100 percent")
                        item[direction].append([speed, influence])
            keys.append(item)
        if not keys:
            raise ValueError("Require nonempty keys")
        result.append(dict(compId=cid, layerId=lid, propertyPath=path, frameRate=fps, keys=keys))
    return result


def generate(manifest, *, expected_project, report, output=None):
    tracks = normalize(manifest)
    expected_project, report = Path(expected_project).resolve(), Path(report).resolve()
    output = Path(output).resolve() if output else None
    paths = [expected_project, report] + ([output] if output else [])
    if len(set(paths)) != len(paths):
        raise ValueError("Input, report and output must be distinct")
    if not report.parent.is_dir() or (output and not output.parent.is_dir()):
        raise ValueError("Report and output parents must exist")
    if report.exists() or (output and output.exists()):
        raise ValueError("Report and output must be nonexistent")
    config = dict(expected=str(expected_project), report=str(report), output=str(output) if output else None, tracks=tracks)
    return "(function () {\nvar config = " + json.dumps(config, ensure_ascii=True, allow_nan=False) + ";\n" + RUNTIME + "\n})();\n"


RUNTIME = r'''
function fail(message) { throw new Error(message); }
function same(a,b,tol) {
    if(a instanceof Array || b instanceof Array) {
        if(!(a instanceof Array) || !(b instanceof Array) || a.length !== b.length)return false;
        for(var i=0;i<a.length;i++)if(!same(a[i],b[i],tol))return false;
        return true;
    }
    return typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) && Math.abs(a-b)<=tol;
}
function encode(v) {
    if(v === null)return 'null';
    if(typeof v === 'number' || typeof v === 'boolean')return String(v);
    if(typeof v === 'string')return '"'+v.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\x00-\x1f]/g,function(c){return '\\u'+('000'+c.charCodeAt(0).toString(16)).slice(-4);})+'"';
    var parts=[],i;
    if(v instanceof Array){for(i=0;i<v.length;i++)parts.push(encode(v[i]));return '['+parts.join(',')+']';}
    for(i in v)if(v.hasOwnProperty(i))parts.push(encode(i)+':'+encode(v[i]));return '{'+parts.join(',')+'}';
}
function kind(s){if(s==='bezier')return KeyframeInterpolationType.BEZIER;if(s==='hold')return KeyframeInterpolationType.HOLD;return KeyframeInterpolationType.LINEAR;}
function eases(pairs){var a=[];for(var i=0;i<pairs.length;i++)a.push(new KeyframeEase(pairs[i][0],pairs[i][1]));return a;}
function easeEqual(actual,wanted){if(actual.length!==wanted.length)return false;for(var i=0;i<actual.length;i++)if(!same(actual[i].speed,wanted[i][0],.001)||!same(actual[i].influence,wanted[i][1],.001))return false;return true;}
function resolve(t){
    var c=null,l=null,i,j;
    for(i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(item instanceof CompItem && item.id===t.compId)c=item;}
    if(!c)fail('Missing comp ID '+t.compId);
    if(!same(c.frameRate,t.frameRate,.00001))fail('Frame rate mismatch '+t.compId);
    for(i=1;i<=c.numLayers;i++)if(c.layer(i).id===t.layerId)l=c.layer(i);
    if(!l)fail('Missing layer ID '+t.layerId);
    if(l.locked)fail('Locked layer '+t.layerId);
    var p=l;
    for(i=0;i<t.propertyPath.length;i++){
        var found=null,count=0;
        for(j=1;j<=p.numProperties;j++){var child=p.property(j);if(child.matchName===t.propertyPath[i]){found=child;count++;}}
        if(count!==1)fail('Missing or ambiguous property '+t.propertyPath[i]);p=found;
    }
    if(!p.canVaryOverTime || p.expressionEnabled)fail('Unsupported or expression-driven property');
    var value=p.value,dim=value instanceof Array?value.length:0,n=p.isSpatial?1:(dim||1);
    if(typeof value!=='number' && !(value instanceof Array))fail('Only numeric properties supported');
    for(i=0;i<t.keys.length;i++){
        var k=t.keys[i],kd=k.value instanceof Array?k.value.length:0;
        if(kd!==dim)fail('Value dimension mismatch');
        if(k.interpolation==='bezier' && (k.inEase.length!==n || k.outEase.length!==n))fail('Ease dimension mismatch');
        if(!p.isInterpolationTypeValid(kind(k.interpolation)))fail('Invalid interpolation');
    }
    return p;
}
function check(p,t){
    if(p.numKeys!==t.keys.length)fail('Key count mismatch '+t.layerId);
    for(var i=1;i<=p.numKeys;i++){
        var k=t.keys[i-1];
        if(!same(p.keyTime(i),k.time,.1/t.frameRate))fail('Key time mismatch '+t.layerId+' key '+i);
        if(!same(p.keyValue(i),k.value,.001))fail('Key value mismatch '+t.layerId+' key '+i);
        if(p.keyInInterpolationType(i)!==kind(k.interpolation)||p.keyOutInterpolationType(i)!==kind(k.interpolation))fail('Interpolation mismatch '+t.layerId+' key '+i+' wanted '+kind(k.interpolation)+' actual '+p.keyInInterpolationType(i)+' / '+p.keyOutInterpolationType(i));
        if(k.interpolation==='bezier' && (!easeEqual(p.keyInTemporalEase(i),k.inEase)||!easeEqual(p.keyOutTemporalEase(i),k.outEase)))fail('Ease mismatch');
    }
}
var reportFile=new File(config.report),output=config.output?new File(config.output):null;
if(reportFile.exists)fail('Report exists');
if(!app.project.file || app.project.file.fsName!==new File(config.expected).fsName)fail('Unexpected open project');
if(app.project.dirty)fail('Unsaved changes: do not save or discard user work');
if(output && output.exists)fail('Output exists');
if(app.preferences.getPrefAsLong('Main Pref Section','Pref_SCRIPTING_FILE_NETWORK_SECURITY')!==1)fail('Script file writing is disabled. Ask for permission; never enable it automatically.');
var targets=[],i,j;
// Resolve and validate ALL targets before the first mutation.
for(i=0;i<config.tracks.length;i++)targets.push(resolve(config.tracks[i]));
reportFile.encoding='UTF-8';if(!reportFile.open('w'))fail('Cannot write report before mutation');
var result={ok:false,mode:output?'apply':'verify',project:config.expected,tracks:config.tracks.length,saved:false,verification:'live-property-check-only'},undo=false;
try {
    if(output){
        app.beginUndoGroup('Verified native keyframe fallback');undo=true;
        for(i=0;i<targets.length;i++){
            var p=targets[i],t=config.tracks[i];
            while(p.numKeys)p.removeKey(p.numKeys);
            for(j=0;j<t.keys.length;j++)p.setValueAtTime(t.keys[j].time,t.keys[j].value);
            for(j=1;j<=p.numKeys;j++){
                var k=t.keys[j-1];p.setInterpolationTypeAtKey(j,kind(k.interpolation),kind(k.interpolation));
                if(k.interpolation==='bezier'){
                    p.setTemporalAutoBezierAtKey(j,false);p.setTemporalContinuousAtKey(j,false);
                    p.setTemporalEaseAtKey(j,eases(k.inEase),eases(k.outEase));
                }
                if(p.isSpatial){var z=k.value.length===3?[0,0,0]:[0,0];p.setRovingAtKey(j,false);p.setSpatialAutoBezierAtKey(j,false);p.setSpatialContinuousAtKey(j,false);p.setSpatialTangentsAtKey(j,z,z);}
            }
        }
    }
    for(i=0;i<targets.length;i++)check(targets[i],config.tracks[i]);
    if(output){app.endUndoGroup();undo=false;app.project.save(output);result.saved=true;}
    result.ok=true;
} catch(error){result.error=String(error);result.partialChangesPossible=!!output;}
finally {if(undo)app.endUndoGroup();}
var wrote=reportFile.write(encode(result)),closed=reportFile.close();if(!wrote || !closed)fail('Report write failed; saved='+result.saved+'; inspect output and live state before retry.');
if(!result.ok)fail(result.error+'; saved='+result.saved+'; no automatic rollback. Inspect state before retry.');
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--expect-project', required=True, type=Path)
    parser.add_argument('--report', required=True, type=Path)
    parser.add_argument('--output', type=Path, help='Apply keys and save a NEW AEP; omit for read-only verification')
    parser.add_argument('--jsx', required=True, type=Path)
    args = parser.parse_args()
    script = generate(json.loads(args.manifest.read_text()), expected_project=args.expect_project, report=args.report, output=args.output)
    with args.jsx.open('x') as stream:
        stream.write(script)
    print(json.dumps({'jsx': str(args.jsx.resolve()), 'mode': 'apply' if args.output else 'verify', 'executed': False}))


if __name__ == '__main__':
    main()

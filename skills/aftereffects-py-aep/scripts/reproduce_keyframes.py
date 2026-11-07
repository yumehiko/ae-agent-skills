"""Small py-aep timing/ease reproduction; no AE control or input files.

Writes a new synthetic AEP plus native verification manifest and offline report.
Use --ease-mode bound to contrast mutating public ease objects with list assignment.
Use the assignment API for normal work. The native report is a separate gate.
"""
from __future__ import annotations

import argparse
import importlib.metadata
import json
from pathlib import Path
import py_aep
from py_aep import KeyframeEase, KeyframeInterpolationType


def build(directory: Path, fps=30000/1001, ease_mode='assignment'):
    directory.mkdir(parents=True, exist_ok=False)
    project = py_aep.new(version='26.3x87').project
    comp = project.root_folder.add_comp('Keyframe reproduction', 320, 180, 1, 6, fps)
    layer = comp.add_shape()
    layer.name = 'Numeric keys'
    tracks = []
    for name, values in [('ADBE Opacity', [0, 100, 20]), ('ADBE Position', [[20, 20, 0], [160, 90, 0], [280, 140, 0]]), ('ADBE Scale', [[40, 40, 100], [100, 100, 100], [70, 70, 100]])]:
        prop = layer.transform.property(name)
        keys = []
        for frame, value in zip((15, 45, 75), values):
            prop.set_value_at_time(frame/fps, value)
            dims = 3 if name == 'ADBE Scale' else 1
            keys.append(dict(time=frame, value=value, interpolation='bezier', inEase=[[0,66]]*dims, outEase=[[0,66]]*dims))
        for key in prop.keyframes:
            key.in_interpolation_type = key.out_interpolation_type = KeyframeInterpolationType.BEZIER
            if ease_mode == 'assignment':
                dim = len(key.in_temporal_ease)
                key.in_temporal_ease = [KeyframeEase(0,66) for _ in range(dim)]
                key.out_temporal_ease = [KeyframeEase(0,66) for _ in range(dim)]
            else:
                for ease in key.in_temporal_ease + key.out_temporal_ease:
                    ease.speed, ease.influence = 0, 66
        tracks.append(dict(compId=comp.id,layerId=layer.id,propertyPath=['ADBE Transform Group',name],frameRate=fps,keys=keys))
    def snapshot(p):
        c=p.compositions[0];l=c.layers[0]
        return {t['propertyPath'][-1]: [dict(time=k.time,frame=k.frame_time,value=k.value,inInterpolation=k.in_interpolation_type.name,outInterpolation=k.out_interpolation_type.name,inEase=[[e.speed,e.influence] for e in k.in_temporal_ease],outEase=[[e.speed,e.influence] for e in k.out_temporal_ease]) for k in l.transform.property(t['propertyPath'][-1]).keyframes] for t in tracks}
    before = snapshot(project)
    output = directory/'reproduction.aep'
    project.save(output)
    after = snapshot(py_aep.parse(output).project)
    manifest = dict(version=1,timeUnit='frames',tracks=tracks)
    (directory/'manifest.json').write_text(json.dumps(manifest,indent=2))
    report = dict(pyAepVersion=importlib.metadata.version('py-aep'),easeMode=ease_mode,frameRate=fps,before=before,after=after,roundTripEqual=before==after,aeVerified=False)
    (directory/'offline-report.json').write_text(json.dumps(report,indent=2))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',type=Path)
    parser.add_argument('--fps',type=float,default=30000/1001)
    parser.add_argument('--ease-mode',choices=('assignment','bound'),default='assignment')
    args=parser.parse_args()
    report=build(args.directory,args.fps,args.ease_mode)
    print(json.dumps({k:v for k,v in report.items() if k not in ('before','after')}))

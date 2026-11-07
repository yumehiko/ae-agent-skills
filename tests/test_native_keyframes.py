from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / 'skills/aftereffects-py-aep/scripts'


def module(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS/f'{name}.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


native = module('native_keyframes')
repro = module('reproduce_keyframes')


def manifest():
    return dict(version=1, timeUnit='frames', tracks=[dict(compId=1, layerId=13,
        propertyPath=['ADBE Transform Group','ADBE Opacity'], frameRate=30,
        keys=[dict(time=15,value=0,interpolation='bezier',inEase=[[0,66]],outEase=[[0,66]]),
              dict(time=45,value=100,interpolation='bezier',inEase=[[0,66]],outEase=[[0,66]])])])


def test_explicit_frame_conversion():
    assert [k['time'] for k in native.normalize(manifest())[0]['keys']] == [.5,1.5]
    m=manifest();m['timeUnit']='seconds'
    assert native.normalize(m)[0]['keys'][0]['time']==15


@pytest.mark.parametrize('change', ['duplicate','nan','frame_fraction','unordered','dimension','zero_fps','bad_ease','missing_units'])
def test_invalid_intent_rejected(change):
    m=manifest();t=m['tracks'][0]
    if change=='duplicate':m['tracks'].append(copy.deepcopy(t))
    elif change=='nan':t['keys'][0]['value']=float('nan')
    elif change=='frame_fraction':t['keys'][0]['time']=1.5
    elif change=='unordered':t['keys'][1]['time']=15
    elif change=='dimension':t['keys'][1]['value']=[1,2]
    elif change=='zero_fps':t['frameRate']=0
    elif change=='bad_ease':t['keys'][0]['outEase']=[[0,0]]
    else:m.pop('timeUnit')
    with pytest.raises(ValueError):native.normalize(m)


def test_refuses_existing_and_alias_paths(tmp_path):
    p=tmp_path/'input.aep';p.touch()
    with pytest.raises(ValueError):native.generate(manifest(),expected_project=p,output=p,report=tmp_path/'report.json')
    r=tmp_path/'report.json';r.touch()
    with pytest.raises(ValueError):native.generate(manifest(),expected_project=p,report=r)


@pytest.mark.parametrize('fps',[25,30000/1001])
def test_reproduction_parser_times_and_values(tmp_path,fps):
    report=repro.build(tmp_path/'repro',fps)
    for name,keys in report['after'].items():
        assert [k['frame'] for k in keys]==[15,45,75]
        assert [k['time'] for k in keys]==pytest.approx([15/fps,45/fps,75/fps],abs=1e-5)
        assert [k['value'] for k in keys]==[k['value'] for k in report['before'][name]]


def test_ease_assignment_roundtrip(tmp_path):
    report=repro.build(tmp_path/'repro')
    for keys in report['after'].values():
        for key in keys:
            assert all(e[1]==66 for e in key['inEase']+key['outEase'])


MOCK = r'''
const fs=require('fs'),vm=require('vm');
const script=fs.readFileSync(process.argv[1],'utf8');
const option=process.argv[2];
let mutations=0,saves=0,reports={},keys=[],dirty=option==='dirty';
if(option==='verify')keys=[{time:.5,value:0,a:6613,b:6613,ein:[{speed:0,influence:66}],eout:[{speed:0,influence:66}]},{time:1.5,value:100,a:6613,b:6613,ein:[{speed:0,influence:66}],eout:[{speed:0,influence:66}]}];
function File(path){this.fsName=path;this.exists=option==='exists'&&path.endsWith('out.aep');this.open=()=>option!=='report-denied';this.write=s=>{reports[path]=JSON.parse(s);return true;};this.close=()=>option!=='close-failed';}
function KeyframeEase(speed,influence){this.speed=speed;this.influence=influence;}
const B=6613,L=6612,H=6614;
const prop={matchName:'ADBE Opacity',canVaryOverTime:true,expressionEnabled:option==='expression',isSpatial:false,value:0,
 get numKeys(){return keys.length},isInterpolationTypeValid:()=>true,
 removeKey:i=>{mutations++;keys.splice(i-1,1)},setValueAtTime:(time,value)=>{mutations++;keys.push({time,value})},
 setInterpolationTypeAtKey:(i,a,b)=>Object.assign(keys[i-1],{a,b}),setTemporalAutoBezierAtKey:()=>{},setTemporalContinuousAtKey:()=>{},
 setTemporalEaseAtKey:(i,ein,eout)=>Object.assign(keys[i-1],{ein,eout}),keyTime:i=>keys[i-1].time+(option==='rounding'?0.00002:option==='time-mismatch'?0.02:0),
 keyValue:i=>keys[i-1].value,keyInInterpolationType:i=>keys[i-1].a,keyOutInterpolationType:i=>keys[i-1].b,
 keyInTemporalEase:i=>keys[i-1].ein,keyOutTemporalEase:i=>keys[i-1].eout};
const group={matchName:'ADBE Transform Group',numProperties:1,property:()=>prop};
const layer={id:13,locked:false,numProperties:1,property:()=>group};
function CompItem(){this.id=1;this.frameRate=option==='fps'?25:30;this.numLayers=1;this.layer=()=>layer;}
const comp=new CompItem();
const app={project:{file:{fsName:option==='identity'?'/wrong.aep':process.argv[3]},dirty,numItems:1,item:()=>comp,save:()=>saves++},preferences:{getPrefAsLong:()=>option==='permission'?0:1},beginUndoGroup:()=>{},endUndoGroup:()=>{}};
const ctx={File,CompItem,KeyframeEase,KeyframeInterpolationType:{BEZIER:B,LINEAR:L,HOLD:H},app};
// AE-native arrays live in the script realm; mock methods deliberately use scalar tracks.
try{vm.runInNewContext(script,ctx);}catch(error){ctx.error=String(error);}
console.log(JSON.stringify({mutations,saves,reports,error:ctx.error,keys}));
'''


@pytest.mark.parametrize('option',['ok','rounding','time-mismatch','dirty','identity','permission','fps','expression','exists','report-denied','close-failed'])
def test_generated_native_guards_and_apply(tmp_path,option):
    script=tmp_path/'apply.jsx';source=tmp_path/'source.aep'
    script.write_text(native.generate(manifest(),expected_project=source,report=tmp_path/'report.json',output=tmp_path/'out.aep'))
    out=subprocess.check_output(['node','-e',MOCK,str(script),option,str(source)],text=True)
    result=json.loads(out)
    if option in ('ok','rounding'):
        assert result['saves']==1
        assert list(result['reports'].values())[0]['ok'] is True
        assert [k['time'] for k in result['keys']]==[.5,1.5]
        assert all(k['a']==6613 and k['b']==6613 for k in result['keys'])
    elif option=='close-failed':
        assert result['saves']==1 and 'saved=true' in result['error']
    elif option=='time-mismatch':
        assert result['error']
        assert result['mutations']>0 and result['saves']==0
        assert list(result['reports'].values())[0]['ok'] is False
    else:
        assert result['error']
        assert result['mutations']==result['saves']==0


def test_feedback_is_bundled_relative_reference():
    skill=ROOT/'skills/aftereffects-py-aep'
    assert (skill/'references/preview-feedback.ja.md').is_file()
    assert '~/ae-agent-skills-preview' not in (skill/'SKILL.md').read_text()


def test_read_only_verify_never_mutates_or_saves(tmp_path):
    script=tmp_path/'verify.jsx';source=tmp_path/'source.aep'
    script.write_text(native.generate(manifest(),expected_project=source,report=tmp_path/'report.json'))
    result=json.loads(subprocess.check_output(['node','-e',MOCK,str(script),'verify',str(source)],text=True))
    assert result['mutations']==result['saves']==0
    assert list(result['reports'].values())[0]['ok'] is True
    assert list(result['reports'].values())[0]['mode']=='verify'


def test_feedback_templates_match():
    assert (ROOT/'docs/py-aep-preview-feedback.ja.md').read_bytes()==(ROOT/'skills/aftereffects-py-aep/references/preview-feedback.ja.md').read_bytes()

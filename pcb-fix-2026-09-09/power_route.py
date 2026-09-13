from pathlib import Path
import pcbnew as p
ROOT=Path(__file__).resolve().parent
for name,stem in [('s3','vsmart-module-esp32-s3-mini'),('devkit','vsmart-module-carrier')]:
    path=ROOT/name/(stem+'.kicad_pcb'); b=p.LoadBoard(str(path))
    net=b.FindNet('+5V_SIM')
    for t in list(b.GetTracks()):
        if t.GetNetname()=='+5V_SIM': b.Remove(t)
    routes=([('B.Cu',[(50.5,78.5),(51,78),(51,66)]),
             ('F.Cu',[(51,66),(54.6,62.4),(79.2,62.4),(81.562,64.762),(83.2,64.762)])]
            if name=='s3' else
            [('B.Cu',[(67,86),(67,75),(66,74)]),
             ('F.Cu',[(66,74),(66,67),(67,66),(98.2,66),(100.596,68.396),(101.0736,68.396)])])
    for layer,points in routes:
        for a,c in zip(points,points[1:]):
            t=p.PCB_TRACK(b); t.SetStart(p.VECTOR2I(p.FromMM(a[0]),p.FromMM(a[1]))); t.SetEnd(p.VECTOR2I(p.FromMM(c[0]),p.FromMM(c[1])))
            t.SetWidth(p.FromMM(2)); t.SetLayer(b.GetLayerID(layer)); t.SetNet(net); b.Add(t)
    p.SaveBoard(str(path),b)

"""Build editable CAD candidates from preserved originals. Never overwrite source projects."""
from pathlib import Path
import shutil, json
import pcbnew as pcb
ROOT=Path(__file__).resolve().parent
for name,folder,stem in [('s3','vsmart-hardware','vsmart-module-esp32-s3-mini'),('devkit','vsmart-module-esp32','vsmart-module-carrier')]:
    dest=ROOT/name; project=ROOT.parent/folder
    for source in (ROOT/'before'/name).iterdir(): shutil.copy2(source,dest/source.name)
    for asset in ['libs','3dmodels','usini_sensors.pretty','usini_sensors.kicad_sym']:
        link=dest/asset
        if not link.exists(): link.symlink_to(project/asset,target_is_directory=(project/asset).is_dir())
    board=pcb.LoadBoard(str(dest/(stem+'.kicad_pcb')))
    for track in board.GetTracks():
        if track.GetNetname()=='+5V_SIM' and not isinstance(track,pcb.PCB_VIA): track.SetWidth(pcb.FromMM(2))
    pcb.SaveBoard(str(dest/(stem+'.kicad_pcb')),board)
    print(name,'candidate prepared')

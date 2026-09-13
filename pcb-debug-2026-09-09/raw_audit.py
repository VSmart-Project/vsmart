"""Read-only design audit; only writes derived evidence in this review folder."""
import json, math, sys, hashlib, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
sys.path.insert(0, '/Users/vi.trandai/.codex/skills/kicad/scripts')
from sexp_parser import parse_file, find_all, find_first, get_property

HERE = Path(__file__).resolve().parent
PROJECTS = {'s3': ('vsmart-hardware', 'vsmart-module-esp32-s3-mini'),
            'devkit': ('vsmart-module-esp32', 'vsmart-module-carrier')}

def coords(node, key='at'):
    a = find_first(node, key)
    return [float(v) for v in a[1:]] if a else []

for name, (folder, stem) in PROJECTS.items():
    project = HERE.parent / folder
    pcbfile = project / (stem + '.kicad_pcb')
    pcb = parse_file(pcbfile)
    id_to_name = {str(n[1]): str(n[2]) for n in find_all(pcb, 'net')}
    sch = parse_file(project / (stem + '.kicad_sch'))
    fps = {get_property(f, 'Reference'): f for f in find_all(pcb, 'footprint')}
    symbols = [s for s in find_all(sch, 'symbol') if not str(get_property(s, 'Reference')).startswith('#')]
    netlist = ET.parse(HERE / name / 'netlist.xml').getroot()
    expected = {}
    for net in netlist.findall('./nets/net'):
        for node in net.findall('node'):
            expected[(node.get('ref'), node.get('pin'))] = net.get('name')
    mismatches, nc_differences, pin_table = [], [], []
    pad_locations = {}
    for ref, fp in fps.items():
        pos = coords(fp)
        angle = math.radians(pos[2] if len(pos)>2 else 0)
        for pad in find_all(fp, 'pad'):
            number = str(pad[1]); a = coords(pad)
            net = find_first(pad, 'net'); actual = id_to_name.get(str(net[1]), str(net[1])) if net else ''
            ex = expected.get((ref, number), '')
            item = {'ref': ref, 'pad': number, 'pcb_net': actual, 'schematic_net': ex,
                    'local_xy': a[:2], 'xy': [round(pos[0]+a[0]*math.cos(angle)+a[1]*math.sin(angle),6),
                                             round(pos[1]-a[0]*math.sin(angle)+a[1]*math.cos(angle),6)],
                    'drill': coords(pad,'drill'), 'size': coords(pad,'size')}
            pin_table.append(item); pad_locations[(ref,number)] = item['xy']
            if actual != ex:
                (nc_differences if ex.startswith('unconnected-') and not actual else mismatches).append(item)
    net_ids = {str(n[2]): str(n[1]) for n in find_all(pcb,'net')}
    segments = []
    for seg in find_all(pcb,'segment'):
        if str(find_first(seg,'net')[1]) != net_ids.get('+5V_SIM', '+5V_SIM'): continue
        start,end = coords(seg,'start'),coords(seg,'end')
        segments.append({'start':start,'end':end,'width':float(find_first(seg,'width')[1]),
                         'layer':find_first(seg,'layer')[1], 'length_mm':math.dist(start,end)})
    # Copper-only shortest path; THT terminal pads join layers. No parallel power zones exist.
    graph={}
    key=lambda xy: tuple(round(x,5) for x in xy)
    for seg in segments:
        a,b=key(seg['start']),key(seg['end']); r=1.724e-8*(seg['length_mm']/1000)/((seg['width']/1000)*35e-6)
        graph.setdefault(a,[]).append((b,r)); graph.setdefault(b,[]).append((a,r))
    import heapq
    start,end=key(pad_locations[('J2','1')]),key(pad_locations[('U4','8')])
    heap=[(0,start)]; seen={}; resistance=None
    while heap:
        r,node=heapq.heappop(heap)
        if node in seen: continue
        seen[node]=r
        if node==end: resistance=r; break
        for target,cost in graph.get(node,[]): heapq.heappush(heap,(r+cost,target))
    settings=json.loads((project/(stem+'.kicad_pro')).read_text())
    ns=settings.get('net_settings',{})
    archive=project/'manufacturing'/(stem+'-fab.zip')
    entries=[]
    dest=HERE/name/'fab-archive'; dest.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            if info.is_dir(): continue
            path=Path(info.filename)
            if path.is_absolute() or '..' in path.parts: raise ValueError('Unsafe archive entry')
            data=z.read(info)
            candidates=list((project/'manufacturing').rglob(path.name))
            matches=[str(p.relative_to(project)) for p in candidates if p.is_file() and p.read_bytes()==data]
            entries.append({'entry':info.filename,'bytes':len(data),'matching_files':matches})
            (dest/path.name).write_bytes(data)
    out={'project':str(project),'pcb_sha256':hashlib.sha256(pcbfile.read_bytes()).hexdigest(),
         'raw_components':len(symbols),'raw_footprints':len(fps),'pin_table':pin_table,
         'active_net_mismatches':mismatches,'intentional_nc_name_differences':len(nc_differences),
         'sim_supply_segments':segments, 'sim_J2_to_U4_resistance_35um_ohm':resistance,
         'sim_drop_at_2A_V':None if resistance is None else 2*resistance,
         'sim_netclass_assignments':ns.get('netclass_assignments'),
         'sim_netclass_patterns':ns.get('netclass_patterns'),
         'u4_model':find_all(fps['U4'],'model'),
         'zip_entries':entries,'zip_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
    # Independently compare analyzer's pin-net output with KiCad's XML export.
    analysis=json.loads((HERE/name/'schematic.json').read_text())
    analyzer_errors=[]; checked=0
    for ic in analysis['ic_pin_analysis']:
        for pin in ic['pins']:
            expected_net=expected.get((ic['reference'],pin['pin_number']),'')
            actual_net=pin.get('net','')
            checked+=1
            if actual_net=='NO_CONNECT' and expected_net.startswith('unconnected-'): continue
            if actual_net!=expected_net: analyzer_errors.append([ic['reference'],pin['pin_number'],actual_net,expected_net])
    out['analyzer_vs_kicad_export']={'pins_checked':checked,'mismatches':analyzer_errors}
    vendor=parse_file(HERE/'TDM-4G-V1-vendor.kicad_mod')
    vendor_pads=find_all(vendor,'pad')
    # Supplier duplicates pad numbers 1-6 between columns. Use geometry, not its numbering as a netlist.
    vendor_signal={}
    for pad in vendor_pads:
        if not str(pad[1]): continue
        x,y=coords(pad)[:2]
        number=int(pad[1])+(6 if x < -10 else 0)
        vendor_signal[str(number)]=[-x,y]
    ri=pad_locations[('U4','1')]
    geometry_errors=[]
    for number,target in vendor_signal.items():
        xy=pad_locations[('U4',number)]
        geometry_errors.append(math.dist([xy[0]-ri[0],xy[1]-ri[1]],target))
    out['u4_header_vs_supplier_sim_face_up_max_error_mm']=max(geometry_errors)
    np=next(p for p in pin_table if p['ref']=='U4' and not p['pad'])
    vp=next(p for p in vendor_pads if not str(p[1]))
    vx,vy=coords(vp)[:2]
    out['u4_single_mount_hole_vs_supplier_error_mm']=math.dist([np['xy'][0]-ri[0],np['xy'][1]-ri[1]],[-vx,vy])
    # Compare fabrication geometry, ignoring timestamps and Gerber integrity checksum only.
    def normalize_fab(path):
        return '\n'.join(line for line in path.read_text().splitlines()
                         if not any(token in line for token in ['CreationDate','TF.MD5','G04 Created by KiCad','; DRILL file KiCad']))
    comparisons=[]
    for p in dest.iterdir():
        fresh=HERE/name/'fresh-fab'/p.name
        if p.suffix=='.gbrjob' or not fresh.exists(): continue
        comparisons.append({'name':p.name,'same_except_metadata':normalize_fab(p)==normalize_fab(fresh)})
    out['fresh_export_comparison']=comparisons
    (HERE/name/'raw-audit.json').write_text(json.dumps(out,indent=2)+'\n')
    print(name, 'counts',len(symbols),len(fps),'active mismatch',mismatches,
          'NC-only',len(nc_differences),'SIM resistance assuming 35um',resistance,
          'ZIP matches',sum(bool(e['matching_files']) for e in entries),'/',len(entries))

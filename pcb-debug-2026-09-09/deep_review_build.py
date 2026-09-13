"""Generate evidence-linked review records, without editing either PCB."""
import json
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parent
for board in ['s3','devkit']:
    raw=json.loads((ROOT/board/'raw-audit.json').read_text())
    sch=json.loads((ROOT/board/'schematic.json').read_text())
    findings=[]
    def add(ref,severity,summary,result,category='verification_gap'):
        findings.append({'detector':'deep_review','category':category,'severity':severity,
            'confidence':'high' if category=='routing' else 'medium','summary':summary,
            'components':[ref],'evidence':{'components':[ref], 'computation':{
                'description':'Raw PCB pad mapping and independently exported KiCad schematic netlist; not a manufacturer electrical validation.',
                'script':str(ROOT/'raw_audit.py'),'result':result}}})
    for ic in sch['ic_pin_analysis']:
        ref=ic['reference']
        if not ref.startswith('U'): continue
        values=[f"{p['pin_number']}:{p['pin_name']}={p.get('net')}" for p in ic['pins']]
        add(ref,'info',f'{ref} module-internal circuit and exact hardware revision unverified; external connections checked for consistency.', '; '.join(values))
    resistance=raw['sim_J2_to_U4_resistance_35um_ohm']
    add('U4','error','SIM supply is routed at 0.2 mm, unsuitable to sign off the declared 2 A power path without redesign/load testing.',
        f'All +5V_SIM segments width=0.2 mm; shortest J2.1 to U4.8 copper path R={resistance:.6f} ohm assuming copper 35 um, rho=1.724e-8 ohm.m; Vdrop at 2A={2*resistance:.6f} V. Copper thickness/load waveform unverified.', 'routing')
    add('U4','warning','SIM source voltage specification conflicts with the board supply label; resolve exact module before powering.',
        'U4.8 and J2.1 connect directly to +5V_SIM; J2 value says EXTERNAL 5V 2A SIM INPUT. Supplier-linked repository specifies 3.8-4.2 V, product page 3.7-4 V. Neither supports 5 V for the named TDM2309. See source URLs in REVIEW.md.', 'power')
    add('U1','warning','No explicit antenna copper keepout is present in either carrier.',
        'Raw PCB/analyzer keepout_zones=[]; module-specific RF keepout and real antenna position require review.', 'rf')
    if board=='devkit':
        add('U1','warning','U1 pad 5 retains GPS_PPS while schematic marks GPIO34 no-connect.',
            json.dumps(raw['active_net_mismatches']), 'parity')
    data={'schema_version':'1.0','produced_for_run_id':'pcb-debug-2026-09-09-'+board,
          'produced_at':datetime.now(timezone.utc).isoformat(),'findings':findings,'quarantined':[]}
    (ROOT/board/'deep_review.json').write_text(json.dumps(data,indent=2)+'\n')

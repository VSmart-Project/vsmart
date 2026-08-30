import { useState, useEffect, useRef } from 'react';
import {
  Navigation2, MapPin, Clock, Activity, Trash2, Pencil, Plus,
  Wifi, WifiOff, Truck, Car, Package, Bus, Bike, AlertTriangle,
  RefreshCw, Search, Shield, ShieldAlert, Crosshair,
} from 'lucide-react';
import { clsx } from 'clsx';
import { antitheftApi } from '../../api/deviceApi';
import DeleteDeviceModal from './DeleteDeviceModal';
import DeviceFormModal from './DeviceFormModal';
import ConfirmAntiTheftModal from './ConfirmAntiTheftModal';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  truck: { label: 'Truck', Icon: Truck, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10' },
  car: { label: 'Car', Icon: Car, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' },
  motorbike: { label: 'Motorbike', Icon: Bike, color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-400/10' },
  van: { label: 'Van', Icon: Package, color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10' },
  bus: { label: 'Bus', Icon: Bus, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' },
  other: { label: 'Other', Icon: Package, color: 'text-muted dark:text-muted-dark bg-surface dark:bg-white/5' },
};

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' },
  inactive: { label: 'Inactive', color: 'text-muted dark:text-muted-dark bg-surface dark:bg-white/5 border-hairline dark:border-hairline-dark' },
  maintenance: { label: 'Maintenance', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' },
};

// ─── HELPERS ───────────────────────────────────────────────────────────────

const getOnlineStatus = (device) => {
  if (!device.sampleTime) return { color: 'gray', text: 'No data yet' };
  const diffMin = (new Date() - new Date(device.sampleTime)) / 60000;
  if (diffMin < 5) return { color: 'green', text: 'Online' };
  if (diffMin < 30) return { color: 'yellow', text: `${Math.floor(diffMin)}m ago` };
  const diffH = Math.floor(diffMin / 60);
  return { color: 'red', text: diffH < 24 ? `${diffH}h ago` : 'Offline' };
};

// ─── UNREGISTERED BANNER ──────────────────────────────────────────────────

function UnregisteredBanner({ devices, onQuickRegister }) {
  if (!devices || devices.length === 0) return null;
  return (
    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 mb-4">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {devices.length} device{devices.length > 1 ? 's are' : ' is'} sending data but not yet registered
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {devices.map((d) => (
              <button
                key={d.deviceId}
                onClick={() => onQuickRegister(d.deviceId)}
                className="inline-flex items-center px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-mono transition-colors border border-amber-300 dark:border-amber-500/40"
                title="Click to register"
              >
                <Plus className="w-3 h-3 mr-1" />
                {d.deviceId}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADDRESS RESOLVER ─────────────────────────────────────────────────────

function AddressResolver({ position }) {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastFetchedPos = useRef(null);
  const latitude = position[1];
  const longitude = position[0];

  useEffect(() => {
    let isMounted = true;
    const fetchAddress = async () => {
      try {
        setLoading(true);
        // OpenStreetMap Nominatim Free API
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
        const data = await res.json();

        let finalAddress = data.display_name || "Unknown location";

        if (isMounted) {
          setAddress(finalAddress);
          lastFetchedPos.current = `${latitude},${longitude}`;
        }
      } catch {
        if (isMounted) setAddress("Cannot translate location");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // If no address yet or device drastically moved
    let shouldFetch = false;
    if (!lastFetchedPos.current) {
      shouldFetch = true;
    } else {
      const [oldLat, oldLng] = lastFetchedPos.current.split(',').map(Number);
      if (Math.abs(oldLat - latitude) > 0.001 || Math.abs(oldLng - longitude) > 0.001) {
        shouldFetch = true;
      }
    }

    if (shouldFetch) {
      fetchAddress();
    }

    return () => { isMounted = false; };
  }, [latitude, longitude]);

  return (
    <div className="flex items-start space-x-1.5 text-xs text-muted dark:text-muted-dark">
      <MapPin className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 mt-0.5 flex-shrink-0" />
      <span className="font-medium leading-tight" title={address || "Translating..."}>
        {loading ? <span className="text-subtle dark:text-subtle-dark italic">Translating position...</span> : address}
      </span>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────

export default function DeviceList({
  devices = [],
  unregisteredDevices = [],
  selectedDevice,
  onDeviceSelect,
  onDeviceCreate,
  onDeviceUpdate,
  onDeviceDelete,
  loading,
  onRefresh,
}) {
  const [deleteModal, setDeleteModal] = useState({ open: false, deviceId: null });
  const [formModal, setFormModal] = useState({ open: false, device: null });
  const [antitheftModal, setAntitheftModal] = useState({ open: false, device: null, isEnabling: false });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // ── Filter & Search ──
  const filtered = devices.filter((d) => {
    const matchSearch =
      !search ||
      d.deviceId?.toLowerCase().includes(search.toLowerCase()) ||
      d.displayName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const onlineCount = devices.filter((d) => {
    if (!d.sampleTime) return false;
    return (new Date() - new Date(d.sampleTime)) / 60000 < 5;
  }).length;

  // ── Handlers ──
  const openCreate = (prefillId = '') => {
    setFormModal({
      open: true,
      device: prefillId ? { deviceId: prefillId, _quickRegister: true } : null,
    });
  };

  const handleFormSubmit = async (formData) => {
    if (formModal.device && !formModal.device._quickRegister) {
      await onDeviceUpdate(formModal.device.deviceId, formData);
    } else {
      await onDeviceCreate(formData);
    }
  };

  const handleDelete = async () => {
    if (onDeviceDelete && deleteModal.deviceId) {
      await onDeviceDelete(deleteModal.deviceId);
      setDeleteModal({ open: false, deviceId: null });
    }
  };

  const initiateAntitheftToggle = (device) => {
    setAntitheftModal({
      open: true,
      device: device,
      isEnabling: !device.antitheftEnabled
    });
  };

  const confirmAntitheftToggle = async () => {
    const { device, isEnabling } = antitheftModal;
    setAntitheftModal({ open: false, device: null, isEnabling: false });

    if (!device) return;

    try {
      if (!isEnabling) {
        await antitheftApi.disable(device.deviceId);
      } else {
        await antitheftApi.enable(device.deviceId);
        if (onDeviceSelect) {
          onDeviceSelect(device, true); // true = zoom to device
        }
      }
      // Refresh to get updated antitheftEnabled state
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Anti-theft error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header toolbar ── */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark flex items-center space-x-2">
            <Navigation2 className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            <span>Device Management</span>
          </h2>
          <p className="text-sm text-muted dark:text-muted-dark mt-0.5 sm:ml-7">
            {devices.length} registered · <span className={onlineCount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}>{onlineCount} online</span>
          </p>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark hover:bg-surface dark:hover:bg-white/5 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => openCreate()}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* ── Unregistered banner ── */}
      <UnregisteredBanner
        devices={unregisteredDevices}
        onQuickRegister={(id) => openCreate(id)}
      />

      {/* ── Search + Filter bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle dark:text-subtle-dark" />
          <input
            type="text"
            placeholder="Search by ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-field sm:w-48"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* ── Device Table ── */}
      {loading && devices.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-subtle dark:text-subtle-dark">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading devices...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-subtle dark:text-subtle-dark bg-card dark:bg-card-dark rounded-2xl border border-hairline dark:border-hairline-dark">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-40" />
          {devices.length === 0 ? (
            <>
              <p className="font-medium text-ink dark:text-ink-dark">No devices registered yet</p>
              <p className="text-sm mt-1">Click "Add Device" to register your first device</p>
            </>
          ) : (
            <p className="font-medium text-ink dark:text-ink-dark">No devices match your search</p>
          )}
        </div>
      ) : (
        <div className="bg-card dark:bg-card-dark border border-hairline dark:border-hairline-dark rounded-3xl shadow-panel dark:shadow-panel-dark overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface dark:bg-white/[0.03] text-subtle dark:text-subtle-dark text-[10px] uppercase tracking-wider font-extrabold border-b border-hairline dark:border-hairline-dark">
                <th className="py-4 px-6">Device</th>
                <th className="py-4 px-6">Status & Network</th>
                <th className="py-4 px-6">Last Position</th>
                <th className="py-4 px-6">Anti-Theft Shield</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline/60 dark:divide-hairline-dark/60">
              {filtered.map((device) => {
                const online = getOnlineStatus(device);
                const typeConf = TYPE_CONFIG[device.type] || TYPE_CONFIG.other;
                const statusConf = STATUS_CONFIG[device.status] || STATUS_CONFIG.active;
                const TypeIcon = typeConf.Icon;
                const antitheftOn = !!device.antitheftEnabled;
                const isSelected = selectedDevice && selectedDevice.deviceId === device.deviceId;

                return (
                  <tr
                    key={device.deviceId}
                    className={clsx(
                      "group hover:bg-surface/70 dark:hover:bg-white/[0.03] transition-all border-l-[3px] border-b border-hairline/60 dark:border-hairline-dark/60",
                      isSelected ? "border-brand-500 dark:border-brand-400 bg-brand-50/40 dark:bg-brand-400/[0.06]" : "border-transparent"
                    )}
                  >

                    {/* Column: Device Name/ID */}
                    <td className="py-4 px-6 whitespace-nowrap cursor-pointer" onClick={() => onDeviceSelect(device)}>
                      <div className="flex items-center space-x-3">
                        <div className={clsx('p-2.5 rounded-xl', typeConf.color)}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-ink dark:text-ink-dark text-sm leading-tight">
                            {device.displayName || device.deviceId}
                          </p>
                          <p className="text-[10px] text-subtle dark:text-subtle-dark font-mono mt-0.5">{device.deviceId}</p>
                        </div>
                      </div>
                    </td>

                    {/* Column: Status & Connectivity */}
                    <td className="py-4 px-6 whitespace-nowrap cursor-pointer" onClick={() => onDeviceSelect(device)}>
                      <div className="flex flex-col space-y-1.5 items-start">
                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide border font-bold', statusConf.color)}>
                          {statusConf.label}
                        </span>
                        <div className="flex items-center space-x-1.5">
                          {online.color === 'green'
                            ? <Wifi className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                            : <WifiOff className="w-3.5 h-3.5 text-subtle dark:text-subtle-dark" />}
                          <span className={clsx(
                            "text-xs font-semibold",
                            online.color === 'green' && 'text-emerald-600 dark:text-emerald-400',
                            online.color === 'yellow' && 'text-amber-600 dark:text-amber-400',
                            online.color === 'red' && 'text-rose-500 dark:text-rose-400',
                            online.color === 'gray' && 'text-subtle dark:text-subtle-dark',
                          )}>
                            {online.text}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column: Location */}
                    <td className="py-4 px-6 min-w-[200px] max-w-[250px] cursor-pointer" onClick={() => onDeviceSelect(device)}>
                      {device.position ? (
                        <div className="flex flex-col">
                          <AddressResolver position={device.position} />
                          {device.sampleTime && (
                            <div className="text-[10px] text-subtle dark:text-subtle-dark mt-1 ml-5 font-semibold">
                              Last seen: {new Date(device.sampleTime).toLocaleTimeString('en-US', { hour12: false })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 text-subtle dark:text-subtle-dark text-xs italic font-medium">
                          <MapPin className="w-3 h-3" />
                          <span>No position data</span>
                        </div>
                      )}
                    </td>

                    {/* Column: Protection */}
                    <td className="py-4 px-6 whitespace-nowrap cursor-pointer" onClick={() => onDeviceSelect(device)}>
                      {antitheftOn ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[10px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                          <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
                          <span>Shield Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[10px] bg-surface dark:bg-white/5 text-subtle dark:text-subtle-dark font-bold">
                          <Shield className="w-3.5 h-3.5" />
                          <span>Disabled</span>
                        </span>
                      )}
                    </td>

                    {/* Column: Actions */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); initiateAntitheftToggle(device); }}
                          className={clsx(
                            'p-2 rounded-xl transition-all',
                            antitheftOn
                              ? 'text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                              : 'text-muted dark:text-muted-dark hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50/70 dark:hover:bg-brand-400/10'
                          )}
                          title={antitheftOn ? 'Disable Shield' : 'Enable Shield'}
                        >
                          {antitheftOn ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); setFormModal({ open: true, device }); }}
                          className="p-2 text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark hover:bg-surface dark:hover:bg-white/5 rounded-xl transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, deviceId: device.deviceId }); }}
                          className="p-2 text-muted dark:text-muted-dark hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      <DeviceFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, device: null })}
        onSubmit={handleFormSubmit}
        device={
          formModal.device?._quickRegister
            ? { ...formModal.device, displayName: formModal.device.deviceId }
            : formModal.device
        }
      />

      <DeleteDeviceModal
        deviceId={deleteModal.deviceId}
        isOpen={deleteModal.open}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ open: false, deviceId: null })}
      />
      <ConfirmAntiTheftModal
        device={antitheftModal.device}
        isOpen={antitheftModal.open}
        isEnabling={antitheftModal.isEnabling}
        onConfirm={confirmAntitheftToggle}
        onCancel={() => setAntitheftModal({ open: false, device: null, isEnabling: false })}
      />
    </div>
  );
}

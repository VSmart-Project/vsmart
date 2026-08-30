import { Navigation2, X, Crosshair } from 'lucide-react';
import { clsx } from 'clsx';
import { Truck, Car, Package, Bus, Bike } from 'lucide-react';

const TYPE_CONFIG = {
    truck: { label: 'Truck', Icon: Truck, color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-400/10' },
    car: { label: 'Car', Icon: Car, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' },
    motorbike: { label: 'Motorbike', Icon: Bike, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10' },
    van: { label: 'Van', Icon: Package, color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10' },
    bus: { label: 'Bus', Icon: Bus, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' },
    other: { label: 'Other', Icon: Package, color: 'text-muted dark:text-muted-dark bg-surface dark:bg-white/5' },
};

const STATUS_CONFIG = {
    active: { label: 'Active', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' },
    inactive: { label: 'Inactive', color: 'text-muted dark:text-muted-dark bg-surface dark:bg-white/5 border-hairline dark:border-hairline-dark' },
    maintenance: { label: 'Maintenance', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' },
};

export default function DevicesMapOverlay({
    devices,
    isOpenedPanel,
    onPanelChange,
    onDeviceSelect,
}) {
    return (
        <>
            {/* Devices Dropdown Panel */}
            {isOpenedPanel && (
                <div className="absolute top-20 left-4 w-80 max-w-[calc(100vw-2rem)] bg-card/95 dark:bg-card-dark/95 backdrop-blur-md rounded-2xl shadow-panel-lg dark:shadow-panel-lg-dark border border-hairline dark:border-hairline-dark z-10 overflow-hidden flex flex-col max-h-[calc(100vh-6.5rem)] select-none animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-hairline dark:border-hairline-dark">
                        <h2 className="text-xs font-bold text-ink dark:text-ink-dark uppercase tracking-wider flex items-center space-x-2">
                            <Navigation2 className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                            <span>Registered Devices ({devices.length})</span>
                        </h2>
                        <button
                            onClick={() => onPanelChange(null)}
                            className="text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {devices.length === 0 ? (
                            <div className="text-center py-6 text-subtle dark:text-subtle-dark text-xs font-semibold">
                                No devices found.
                            </div>
                        ) : (
                            devices.map((device) => {
                                const typeConf = TYPE_CONFIG[device.type] || TYPE_CONFIG.other;
                                const statusConf = STATUS_CONFIG[device.status] || STATUS_CONFIG.active;
                                const TypeIcon = typeConf.Icon;

                                return (
                                    <div
                                        key={device.deviceId}
                                        onClick={() => {
                                            onDeviceSelect(device, true); // true = zoom to device
                                            onPanelChange(null); // close panel after selection
                                        }}
                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-surface dark:hover:bg-white/5 cursor-pointer border border-transparent hover:border-hairline dark:hover:border-hairline-dark transition-all group"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className={clsx('p-2 rounded-xl', typeConf.color)}>
                                                <TypeIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-ink dark:text-ink-dark text-xs leading-tight">
                                                    {device.displayName || device.deviceId}
                                                </p>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <span
                                                        className={clsx(
                                                            'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border',
                                                            statusConf.color
                                                        )}
                                                    >
                                                        {statusConf.label}
                                                    </span>
                                                    {!device.position && (
                                                        <span className="text-[10px] text-subtle dark:text-subtle-dark italic font-medium">
                                                            Unknown location
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Hover Locate Icon */}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-1.5 text-subtle dark:text-subtle-dark group-hover:text-brand-600 dark:group-hover:text-brand-400 bg-brand-50/50 dark:bg-brand-400/10 rounded-xl">
                                                <Crosshair className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

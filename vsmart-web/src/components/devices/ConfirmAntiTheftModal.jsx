import { Shield, ShieldAlert, X } from 'lucide-react';
import { clsx } from 'clsx';

export default function ConfirmAntiTheftModal({ device, isOpen, onConfirm, onCancel, isEnabling }) {
    if (!isOpen || !device) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card dark:bg-card-dark rounded-lg shadow-panel-lg dark:shadow-panel-lg-dark max-w-sm w-full mx-4 border border-hairline dark:border-hairline-dark">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-hairline dark:border-hairline-dark">
                    <div className="flex items-center space-x-3">
                        <div className={clsx(
                            "p-2 rounded-lg",
                            isEnabling ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-rose-50 dark:bg-rose-500/10"
                        )}>
                            {isEnabling
                                ? <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                : <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                            }
                        </div>
                        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
                            {isEnabling ? "Enable Anti-theft" : "Disable Anti-theft"}
                        </h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    <p className="text-muted dark:text-muted-dark text-sm mb-3">
                        {isEnabling
                            ? "This will create an automated 10-meter geofence shield around the device's current location. If the device moves outside this shield, you will receive an instant email alert."
                            : "This will remove the automated geofence shield and stop alerting you about this device's movements."
                        }
                    </p>
                    <div className="bg-surface dark:bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-subtle dark:text-subtle-dark uppercase tracking-wider font-semibold mb-1">Target Device</p>
                        <p className="text-sm font-semibold text-ink dark:text-ink-dark">{device.displayName || device.deviceId}</p>
                        <p className="text-xs text-subtle dark:text-subtle-dark font-mono mt-0.5">{device.deviceId}</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end p-4 border-t border-hairline dark:border-hairline-dark space-x-3 bg-surface dark:bg-white/[0.02] rounded-b-lg">
                    <button
                        onClick={onCancel}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={clsx(
                            "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm",
                            isEnabling
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-rose-600 hover:bg-rose-700"
                        )}
                    >
                        {isEnabling ? "Turn On Shield" : "Turn Off Shield"}
                    </button>
                </div>
            </div>
        </div>
    );
}

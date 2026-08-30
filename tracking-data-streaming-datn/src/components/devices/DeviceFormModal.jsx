import { useState, useEffect } from 'react';
import { X, Plus, Pencil, Loader2, Truck, Car, Bike, Bus, Package } from 'lucide-react';
import { clsx } from 'clsx';

const DEVICE_TYPES = [
    { value: 'truck', label: 'Truck', icon: Truck },
    { value: 'car', label: 'Car', icon: Car },
    { value: 'motorbike', label: 'Motorbike', icon: Bike },
    { value: 'van', label: 'Van', icon: Package },
    { value: 'bus', label: 'Bus', icon: Bus },
    { value: 'other', label: 'Other', icon: Package },
];

const DEVICE_STATUSES = [
    { value: 'active', label: 'Active', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' },
    { value: 'inactive', label: 'Inactive', color: 'text-muted dark:text-muted-dark bg-surface dark:bg-white/5 border-hairline dark:border-hairline-dark' },
    { value: 'maintenance', label: 'Maintenance', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' },
];

const DEFAULT_FORM = {
    deviceId: '',
    displayName: '',
    type: 'truck',
    status: 'active',
    description: '',
};

/**
 * DeviceFormModal
 * Shared modal for both Create and Edit operations.
 *
 * Props:
 *   isOpen    — boolean
 *   onClose   — fn
 *   onSubmit  — fn(formData) → Promise
 *   device    — object|null  (null = create mode)
 */
export default function DeviceFormModal({ isOpen, onClose, onSubmit, device }) {
    const isEditMode = !!device;
    const [form, setForm] = useState(DEFAULT_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    // Reset / populate form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (isEditMode) {
                setForm({
                    deviceId: device.deviceId || '',
                    displayName: device.displayName || '',
                    type: device.type || 'truck',
                    status: device.status || 'active',
                    description: device.description || '',
                });
            } else {
                setForm(DEFAULT_FORM);
            }
            setErrors({});
        }
    }, [isOpen, device, isEditMode]);

    const validate = () => {
        const errs = {};
        if (!isEditMode && !form.deviceId.trim()) {
            errs.deviceId = 'Device ID is required';
        }
        if (!isEditMode && !/^[a-zA-Z0-9_\-:.]{1,64}$/.test(form.deviceId)) {
            errs.deviceId = 'Only letters, numbers, and _ - : . are allowed (max 64 characters)';
        }
        if (!form.displayName.trim()) {
            errs.displayName = 'Display name is required';
        }
        return errs;
    };

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(form);
            onClose();
        } catch (err) {
            // Surface server-side errors inside the modal
            setErrors({ server: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-card dark:bg-card-dark rounded-xl shadow-2xl w-full max-w-lg animate-slide-in border border-hairline dark:border-hairline-dark">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-hairline dark:border-hairline-dark">
                    <div className="flex items-center space-x-3">
                        <div className={clsx('p-2 rounded-lg', isEditMode ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10')}>
                            {isEditMode
                                ? <Pencil className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                : <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                        </div>
                        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
                            {isEditMode ? `Edit: ${device.deviceId}` : 'Add New Device'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark transition-colors p-1 rounded"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Server error banner */}
                    {errors.server && (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 rounded-lg px-4 py-3 text-sm">
                            {errors.server}
                        </div>
                    )}

                    {/* Device ID — create mode only */}
                    {!isEditMode && (
                        <div>
                            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
                                Device ID <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.deviceId}
                                onChange={(e) => handleChange('deviceId', e.target.value)}
                                placeholder="e.g. Vehicle-001"
                                className={clsx(
                                    'input-field',
                                    errors.deviceId && '!border-rose-400 focus:!ring-rose-400/20'
                                )}
                            />
                            {errors.deviceId && (
                                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.deviceId}</p>
                            )}
                            <p className="text-xs text-subtle dark:text-subtle-dark mt-1">
                                Must match the DeviceId the physical device uses when publishing to IoT Core.
                            </p>
                        </div>
                    )}

                    {/* Display Name */}
                    <div>
                        <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
                            Display Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.displayName}
                            onChange={(e) => handleChange('displayName', e.target.value)}
                            placeholder="e.g. Truck #1"
                            className={clsx(
                                'input-field',
                                errors.displayName && '!border-rose-400 focus:!ring-rose-400/20'
                            )}
                        />
                        {errors.displayName && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.displayName}</p>
                        )}
                    </div>

                    {/* Type + Status — same row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Vehicle Type</label>
                            <select
                                value={form.type}
                                onChange={(e) => handleChange('type', e.target.value)}
                                className="input-field"
                            >
                                {DEVICE_TYPES.map(({ value, label }) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className="input-field"
                            >
                                {DEVICE_STATUSES.map(({ value, label }) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Description</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="e.g. Long-haul delivery truck, route HN-HCM"
                            rows={2}
                            className="input-field resize-none"
                        />
                    </div>
                </form>

                {/* ── Footer ── */}
                <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-hairline dark:border-hairline-dark bg-surface dark:bg-white/[0.02] rounded-b-xl">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="btn-secondary disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={clsx(
                            'px-5 py-2 text-white rounded-lg transition text-sm font-medium flex items-center space-x-2 disabled:opacity-60',
                            isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        )}
                    >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{submitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Device')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

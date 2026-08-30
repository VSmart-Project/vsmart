import { Trash2, X } from 'lucide-react';

export default function DeleteDeviceModal({ deviceId, isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card dark:bg-card-dark rounded-lg shadow-panel-lg dark:shadow-panel-lg-dark max-w-sm w-full mx-4 border border-hairline dark:border-hairline-dark">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-hairline dark:border-hairline-dark">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
              <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Delete Device</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-muted dark:text-muted-dark mb-2">
            Are you sure you want to delete this device?
          </p>
          <div className="bg-surface dark:bg-white/5 rounded-lg p-3 mt-4">
            <p className="text-sm text-muted dark:text-muted-dark">Device:</p>
            <p className="text-sm font-semibold text-ink dark:text-ink-dark break-all">{deviceId}</p>
          </div>
          <p className="text-xs text-subtle dark:text-subtle-dark mt-4">
            This action cannot be undone. The device record and its position history will be permanently removed.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-hairline dark:border-hairline-dark bg-surface dark:bg-white/[0.02]">
          <button
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-danger"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

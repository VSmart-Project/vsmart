import { useState, useEffect, useCallback } from 'react';
import { MapPin, Trash2, Plus, Edit2, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { GEOFENCE } from "../../configuration";
import { geofenceApi } from '../../api/deviceApi';

const GeofenceManagement = () => {
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGeofences, setSelectedGeofences] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewGeofence, setViewGeofence] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0 });

  // Fetch all geofences
  const fetchGeofences = useCallback(async () => {
    setLoading(true);
    try {
      const response = await geofenceApi.list();
      setGeofences(response.Entries || []);
      setStats({
        total: response.Entries?.length || 0,
        active: response.Entries?.length || 0,
      });
    } catch (error) {
      console.error('Failed to fetch geofences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  // Handle selection
  const handleSelectGeofence = (geofenceId) => {
    setSelectedGeofences(prev => {
      if (prev.includes(geofenceId)) {
        return prev.filter(id => id !== geofenceId);
      }
      return [...prev, geofenceId];
    });
  };

  // Select all
  const handleSelectAll = () => {
    if (selectedGeofences.length === geofences.length) {
      setSelectedGeofences([]);
    } else {
      setSelectedGeofences(geofences.map(g => g.GeofenceId));
    }
  };

  // Delete selected geofences
  const handleDeleteSelected = async () => {
    if (selectedGeofences.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedGeofences.length} geofence(s)?`)) {
      return;
    }

    try {
      await geofenceApi.delete(selectedGeofences);
      setSelectedGeofences([]);
      fetchGeofences();
    } catch (error) {
      console.error('Failed to delete geofences:', error);
      alert('Error deleting geofences');
    }
  };

  // Format coordinates for display
  const formatCoordinates = (polygon) => {
    if (!polygon || !polygon[0]) return 'N/A';
    const coords = polygon[0];
    return `${coords.length} điểm`;
  };

  // Calculate area (approximate)
  const calculateArea = (polygon) => {
    if (!polygon || !polygon[0]) return 0;
    const coords = polygon[0];
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i][0] * coords[j][1];
      area -= coords[j][0] * coords[i][1];
    }
    return Math.abs(area / 2);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-ink-dark">Geofence Management</h1>
        <p className="text-sm text-muted dark:text-muted-dark mt-1">Manage and monitor your geofence zones</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted dark:text-muted-dark">Total Geofences</p>
              <p className="text-3xl font-bold text-ink dark:text-ink-dark mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-brand-50 dark:bg-brand-400/10 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted dark:text-muted-dark">Active</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted dark:text-muted-dark">Selected</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{selectedGeofences.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              {selectedGeofences.length === geofences.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedGeofences.length === 0}
              className="btn-secondary text-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete ({selectedGeofences.length})</span>
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Geofence</span>
          </button>
        </div>
      </div>

      {/* Geofences List */}
      <div className="card">
        <div className="border-b border-hairline dark:border-hairline-dark pb-4 mb-4">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
            Geofences List
          </h2>
          <p className="text-sm text-muted dark:text-muted-dark mt-1">
            Collection: <span className="font-medium text-ink dark:text-ink-dark">{GEOFENCE}</span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 dark:border-brand-400"></div>
          </div>
        ) : geofences.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-hairline dark:text-hairline-dark mx-auto mb-4" />
            <p className="text-ink dark:text-ink-dark font-medium mb-2">No geofences yet</p>
            <p className="text-sm text-subtle dark:text-subtle-dark mb-4">
              Create your first geofence to start tracking devices
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
              Add First Geofence
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline dark:border-hairline-dark">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted dark:text-muted-dark">
                    <input
                      type="checkbox"
                      checked={selectedGeofences.length === geofences.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-brand-500 border-hairline dark:border-hairline-dark rounded focus:ring-brand-500/30"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted dark:text-muted-dark">
                    Geofence Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted dark:text-muted-dark">
                    Points
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted dark:text-muted-dark">
                    Area (approx)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted dark:text-muted-dark">
                    Created Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted dark:text-muted-dark">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {geofences.map((geofence) => (
                  <tr
                    key={geofence.GeofenceId}
                    className="border-b border-hairline/60 dark:border-hairline-dark/60 hover:bg-surface/70 dark:hover:bg-white/[0.03]"
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedGeofences.includes(geofence.GeofenceId)}
                        onChange={() => handleSelectGeofence(geofence.GeofenceId)}
                        className="w-4 h-4 text-brand-500 border-hairline dark:border-hairline-dark rounded focus:ring-brand-500/30"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                        <span className="font-semibold text-ink dark:text-ink-dark">
                          {geofence.GeofenceId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted dark:text-muted-dark">
                      {formatCoordinates(geofence.Geometry?.Polygon)}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted dark:text-muted-dark">
                      {calculateArea(geofence.Geometry?.Polygon).toFixed(6)} km²
                    </td>
                    <td className="py-3 px-4 text-sm text-subtle dark:text-subtle-dark">
                      {new Date(geofence.CreateTime).toLocaleString('en-US')}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setViewGeofence(geofence)}
                        className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                        title="View details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Geofence Modal */}
      {showAddModal && (
        <AddGeofenceModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchGeofences();
          }}
        />
      )}

      {/* View Geofence Modal */}
      {viewGeofence && (
        <ViewGeofenceModal
          geofence={viewGeofence}
          onClose={() => setViewGeofence(null)}
        />
      )}
    </div>
  );
};

// Add Geofence Modal Component
const AddGeofenceModal = ({ onClose, onSuccess }) => {
  const [geofenceName, setGeofenceName] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' or 'template'

  // Predefined templates
  const templates = {
    hanoi_center: {
      name: 'Hanoi Center',
      coords: [[105.804, 21.028], [105.806, 21.028], [105.806, 21.030], [105.804, 21.030], [105.804, 21.028]]
    },
    hanoi_west: {
      name: 'West Hanoi',
      coords: [[105.780, 21.020], [105.785, 21.020], [105.785, 21.025], [105.780, 21.025], [105.780, 21.020]]
    },
    hanoi_east: {
      name: 'East Hanoi',
      coords: [[105.820, 21.025], [105.825, 21.025], [105.825, 21.030], [105.820, 21.030], [105.820, 21.025]]
    },
    small_zone: {
      name: 'Small Zone (100m)',
      coords: [[105.804, 21.028], [105.805, 21.028], [105.805, 21.029], [105.804, 21.029], [105.804, 21.028]]
    }
  };

  const handleTemplateSelect = (templateKey) => {
    const template = templates[templateKey];
    setCoordinates(JSON.stringify(template.coords, null, 2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!geofenceName.trim()) {
      setError('Please enter geofence name');
      return;
    }

    if (!coordinates.trim()) {
      setError('Please enter coordinates');
      return;
    }

    try {
      setLoading(true);

      // Parse coordinates
      const coordArray = JSON.parse(coordinates);

      if (!Array.isArray(coordArray) || coordArray.length < 3) {
        throw new Error('Geofence must have at least 3 points');
      }

      // Validate coordinate format
      for (const coord of coordArray) {
        if (!Array.isArray(coord) || coord.length !== 2) {
          throw new Error('Each coordinate must be in format [longitude, latitude]');
        }
      }

      const first = coordArray[0];
      const last = coordArray[coordArray.length - 1];
      const polygon = first[0] === last[0] && first[1] === last[1]
        ? coordArray
        : [...coordArray, [...first]];
      await geofenceApi.put(geofenceName, polygon);
      onSuccess();
    } catch (err) {
      console.error('Failed to add geofence:', err);
      setError(err.message || 'Error adding geofence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card dark:bg-card-dark rounded-lg shadow-panel-lg dark:shadow-panel-lg-dark max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-hairline dark:border-hairline-dark">
        <div className="p-6 border-b border-hairline dark:border-hairline-dark">
          <h2 className="text-xl font-semibold text-ink dark:text-ink-dark">Add New Geofence</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-800 dark:text-rose-300">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-2">
              Geofence Name *
            </label>
            <input
              type="text"
              value={geofenceName}
              onChange={(e) => setGeofenceName(e.target.value)}
              placeholder="e.g., Zone-A"
              className="input-field"
              disabled={loading}
            />
          </div>

          {/* Input Method Tabs */}
          <div>
            <div className="flex space-x-2 mb-3">
              <button
                type="button"
                onClick={() => setInputMethod('manual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inputMethod === 'manual'
                    ? 'bg-brand-500 dark:bg-brand-400 text-white dark:text-[#16161b]'
                    : 'bg-surface dark:bg-white/5 text-muted dark:text-muted-dark hover:bg-card-muted dark:hover:bg-white/10'
                  }`}
              >
                Manual Input
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('template')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inputMethod === 'template'
                    ? 'bg-brand-500 dark:bg-brand-400 text-white dark:text-[#16161b]'
                    : 'bg-surface dark:bg-white/5 text-muted dark:text-muted-dark hover:bg-card-muted dark:hover:bg-white/10'
                  }`}
              >
                Use Template
              </button>
            </div>

            {inputMethod === 'template' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-2">
                  Select Geofence Template
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(templates).map(([key, template]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTemplateSelect(key)}
                      className="btn-secondary text-sm py-2 text-left"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-2">
              Coordinates (JSON Array) *
            </label>
            <textarea
              value={coordinates}
              onChange={(e) => setCoordinates(e.target.value)}
              placeholder='[[105.8, 21.0], [105.81, 21.0], [105.81, 21.01], [105.8, 21.01], [105.8, 21.0]]'
              rows={6}
              className="input-field font-mono text-sm"
              disabled={loading}
            />
            <p className="text-xs text-subtle dark:text-subtle-dark mt-2">
              Enter coordinate array in format: [[lng, lat], [lng, lat], ...]
              <br />
              Geofence must have at least 3 points and first point must match the last point.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-2">💡 Tips:</p>
            <ul className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <li>• Use "Use Template" tab to select predefined zones</li>
              <li>• Or go to "Map" tab to draw geofence directly on the map</li>
              <li>• Hanoi coordinates: lng ≈ 105.8, lat ≈ 21.0</li>
            </ul>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Geofence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// View Geofence Modal Component
const ViewGeofenceModal = ({ geofence, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card dark:bg-card-dark rounded-lg shadow-panel-lg dark:shadow-panel-lg-dark max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-hairline dark:border-hairline-dark">
        <div className="p-6 border-b border-hairline dark:border-hairline-dark">
          <h2 className="text-xl font-semibold text-ink dark:text-ink-dark">Geofence Details</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
              Geofence Name
            </label>
            <p className="text-ink dark:text-ink-dark">{geofence.GeofenceId}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
              Created Date
            </label>
            <p className="text-ink dark:text-ink-dark">
              {new Date(geofence.CreateTime).toLocaleString('en-US')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
              Updated Date
            </label>
            <p className="text-ink dark:text-ink-dark">
              {new Date(geofence.UpdateTime).toLocaleString('en-US')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-2">
              Coordinates
            </label>
            <div className="bg-surface dark:bg-white/5 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-xs text-ink dark:text-ink-dark font-mono">
                {JSON.stringify(geofence.Geometry?.Polygon, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-hairline dark:border-hairline-dark flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeofenceManagement;

import { useState, useEffect, useRef } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import DeviceList from './components/devices/DeviceList';
import DeviceMarkers from './components/devices/DeviceMarkers';
import DevicesMapOverlay from './components/map/DevicesMapOverlay';
import DeviceHistoryPathLayer from './components/map/DeviceHistoryPathLayer';
import GeofencesLayer from './components/geofences/GeofencesLayer';
import GeofenceManagement from './components/geofences/GeofenceManagement';
import AuthLayout from './components/auth/AuthLayout';
import LandingPage from './components/marketing/LandingPage';
import DeviceDetailPanel from './components/map/DeviceDetailPanel';
import DashboardView from './components/dashboard/DashboardView';
import { Loader2, MapPin, Navigation2 } from 'lucide-react';
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import { useDeviceManager } from './hooks/useDeviceManager';
import { useDevicePolling } from './hooks/useDevicePolling';
import { useTheme } from './hooks/useTheme.js';
import { BACKEND_URL, REGION, MAP, API_KEY } from './configuration';
import { io } from 'socket.io-client';
import Toast from './components/common/Toast';

function App() {
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [historyPoints, setHistoryPoints] = useState([]);
  const [matchedPath, setMatchedPath] = useState([]);

  const selectedDeviceRef = useRef(selectedDevice);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);
  const [openedPanel, setOpenedPanel] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [toast, setToast] = useState(null);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showAuthGate, setShowAuthGate] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then(() => {
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, []);

  const mapRef = useRef(null);
  const [mapFocusPending, setMapFocusPending] = useState(null);

  // ── Device Manager (calls Backend REST API) ──
  const {
    devices,
    unregisteredDevices,
    loading: devicesLoading,
    fetchDevices,
    createDevice,
    updateDevice,
    deleteDevice,
    applyRealtimeEvent,
  } = useDeviceManager();

  // Initial fetch
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Socket.io Real-time connection
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('🔌 Connecting to backend Socket.io server at:', BACKEND_URL);
    let socket;

    fetchAuthSession().then((session) => {
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error('Missing ID token');
      socket = io(BACKEND_URL, { auth: { token } });

      socket.on('connect', () => {
      console.log('✅ Connected to Socket.io server with ID:', socket.id);
      });

      socket.on('realtime-event', (event) => {
      if (import.meta.env.DEV) console.debug('rt', event.type, event.deviceId);
      const processed = applyRealtimeEvent(event);

      // The road-snapped follow-up (correction:true) is only for the marker's
      // interpolation — applyRealtimeEvent already fed it to the follower. Don't
      // fire the heavier selected-device / history-trail state updates for it.
      const isCorrection = event.payload?.correction === true;
      const currentSelected = selectedDeviceRef.current;
      if (processed && !isCorrection && currentSelected && event.deviceId === currentSelected.deviceId) {
        const payload = event.payload || {};
        setSelectedDevice(prev => {
          if (!prev) return null;
          return {
            ...prev,
            position: payload.position || prev.position,
            sampleTime: payload.sampleTime || prev.sampleTime,
            isOnline: payload.isOnline ?? prev.isOnline,
            positionProperties: payload.positionProperties || prev.positionProperties,
          };
        });

        if (payload.position && payload.sampleTime) {
          setHistoryPoints(prev => {
            const newPoint = { Position: payload.position, SampleTime: payload.sampleTime };
            if (prev.length === 0) return [newPoint];
            const lastTime = new Date(prev[prev.length - 1].SampleTime).getTime();
            if (new Date(newPoint.SampleTime).getTime() <= lastTime) return prev;
            // keep the live trail bounded — the loaded day-history is what the
            // replay uses; the live tail only needs the recent window.
            const next = [...prev, newPoint];
            return next.length > 1500 ? next.slice(next.length - 1500) : next;
          });
        }
      }
      
      // Hiển thị thông báo Toast nếu là cảnh báo geofence hoặc chống trộm
      if (event.type === 'geofence.enter' || event.type === 'geofence.exit' || event.type === 'antitheft.breach') {
        const title = event.type === 'antitheft.breach' ? 'CẢNH BÁO CHỐNG TRỘM!' : 'Cảnh báo vùng Geofence';
        const transition = event.type === 'geofence.enter' ? 'đã đi vào' : event.type === 'geofence.exit' ? 'đã đi ra khỏi' : 'đã vi phạm';
        const msg = event.payload?.message || `Thiết bị ${event.deviceId} ${transition} vùng giám sát ${event.payload?.geofenceId || ''}`;
        setToast({ message: `${title}: ${msg}`, type: event.type === 'antitheft.breach' ? 'error' : 'info' });
      }
      });

      socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.io server');
      });

      socket.on('connect_error', (socketError) => {
        console.error('Socket authentication failed:', socketError.message);
      });
    }).catch((sessionError) => {
      console.error('Could not start realtime connection:', sessionError);
    });

    return () => {
      socket?.disconnect();
    };
  }, [isAuthenticated, applyRealtimeEvent]);



  // Poll devices from the backend while on the map view
  useDevicePolling(fetchDevices, activeView === 'map');

  const handleDeviceSelect = (device, zoomToDevice = true) => {
    setSelectedDevice(device);
    if (zoomToDevice && device?.position) {
      setActiveView('map');
      setMapFocusPending({ center: [device.position[0], device.position[1]], zoom: 16 });
    }
  };

  useEffect(() => {
    if (activeView === 'map' && mapFocusPending && mapRef.current) {
      // Small timeout to ensure the map canvas has resized properly before flying
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: mapFocusPending.center,
            zoom: mapFocusPending.zoom,
            duration: 1500,
          });
        }
      }, 100);
      setMapFocusPending(null);
    }
  }, [activeView, mapFocusPending]);

  const handleDeviceCreate = async (formData) => {
    try {
      await createDevice(formData);
      setToast({ message: `Device "${formData.deviceId}" created successfully`, type: 'success' });
    } catch (err) {
      setToast({ message: `Failed to create device: ${err.message}`, type: 'error' });
      throw err; // keep modal open so the user can see the error
    }
  };

  const handleDeviceUpdate = async (id, formData) => {
    try {
      await updateDevice(id, formData);
      setToast({ message: `Device "${id}" updated successfully`, type: 'success' });
    } catch (err) {
      setToast({ message: `Failed to update device: ${err.message}`, type: 'error' });
      throw err;
    }
  };

  const handleDeviceDelete = async (deviceId) => {
    try {
      await deleteDevice(deviceId);
      setToast({ message: `Device "${deviceId}" permanently deleted`, type: 'success' });
    } catch (err) {
      setToast({ message: `Failed to delete device: ${err.message}`, type: 'error' });
      throw err;
    }
  };

  const handlePanelChange = (panel) => {
    setOpenedPanel(panel);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface-dark">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-brand-500 dark:text-brand-400 animate-spin mx-auto mb-4" />
          <p className="text-ink dark:text-ink-dark font-medium">Loading application...</p>
          <p className="text-sm text-muted dark:text-muted-dark mt-2">Connecting to secure services</p>
        </div>
      </div>
    );
  }

  // --- MÀN HÌNH ĐĂNG NHẬP SẼ KIỂM TRA TRƯỚC ---
  // Để người dùng vẫn có thể xem được giao diện Đăng Nhập/Đăng ký khi chưa cấu hình xong Map/Identity Pool
  if (!isAuthenticated) {
    if (!showAuthGate) {
      return <LandingPage onGetStarted={() => setShowAuthGate(true)} />;
    }
    return (
      <AuthLayout
        onLoginSuccess={() => setIsAuthenticated(true)}
        onBack={() => setShowAuthGate(false)}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex bg-surface dark:bg-surface-dark overflow-hidden text-ink dark:text-ink-dark">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={activeView}
        onViewChange={setActiveView}
        onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={async () => {
            try {
              await signOut();
              setIsAuthenticated(false);
            } catch (err) {
              console.error("Logout error", err);
            }
          }}
        />

        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-20 right-4 z-50">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          </div>
        )}

        <main className="flex-1 overflow-hidden min-h-0 relative">
          {activeView === 'dashboard' && (
            <DashboardView
              devices={devices}
              onViewChange={setActiveView}
              onDeviceSelect={handleDeviceSelect}
              onAddDevice={() => setActiveView('devices')}
            />
          )}

          {activeView === 'map' && (
            <div className="h-full w-full relative">
              {/* Map Container */}
              <Map
                ref={mapRef}
                style={{ width: '100%', height: '100%' }}
                initialViewState={{
                  longitude: 105.804817,
                  latitude: 21.028511,
                  zoom: 13,
                }}
                mapStyle={`https://maps.geo.${REGION}.amazonaws.com/v2/styles/${MAP.STYLE}/descriptor?key=${API_KEY}&color-scheme=${theme === 'dark' ? 'Dark' : 'Light'}`}
                maxZoom={18}
                validateStyle={false}
              >
                <NavigationControl position="bottom-right" />

                {/* Device Markers */}
                <DeviceMarkers
                  devices={devices}
                  onDeviceClick={handleDeviceSelect}
                />

                {/* Geofences Layer */}
                <GeofencesLayer
                  isOpenedPanel={openedPanel === 'geofences'}
                  onPanelChange={handlePanelChange}
                  isDrawing={isDrawing}
                  onDrawingChange={setIsDrawing}
                  breachingGeofences={[]}
                />

                {/* Device Path History Layer */}
                 <DeviceHistoryPathLayer
                   deviceId={selectedDevice?.deviceId}
                   isVisible={!!selectedDevice}
                   history={historyPoints}
                   matchedPath={matchedPath}
                 />

                {/* Devices Overlay Panel (Locate Button) */}
                <DevicesMapOverlay
                  devices={devices}
                  isOpenedPanel={openedPanel === 'devices_overlay'}
                  onPanelChange={(p) => handlePanelChange(p === 'devices' ? 'devices_overlay' : p)}
                  onDeviceSelect={(dev, zoom) => {
                    // small timeout to ensure map layout updates
                    setTimeout(() => handleDeviceSelect(dev, zoom), 50);
                  }}
                />
              </Map>

              {/* Map toolbar — single row so the toggles never collide */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => setOpenedPanel(openedPanel === 'geofences' ? null : 'geofences')}
                  className="btn-primary shadow-panel dark:shadow-panel-dark"
                >
                  <MapPin className="w-5 h-5" />
                  <span>Geofences</span>
                </button>
                <button
                  onClick={() => setOpenedPanel(openedPanel === 'devices_overlay' ? null : 'devices_overlay')}
                  className="btn-primary shadow-panel dark:shadow-panel-dark"
                >
                  <Navigation2 className="w-5 h-5" />
                  <span>Devices</span>
                </button>
              </div>

              {/* Floating selected device detail sidebar */}
               {selectedDevice && (
                 <DeviceDetailPanel
                   device={selectedDevice}
                   selectedDate={selectedDate}
                   onSelectedDateChange={setSelectedDate}
                   historyPoints={historyPoints}
                   onHistoryPointsChange={setHistoryPoints}
                   onMatchedPathChange={setMatchedPath}
                   onClose={() => {
                     setSelectedDevice(null);
                     setHistoryPoints([]);
                     setMatchedPath([]);
                   }}
                 />
               )}
            </div>
          )}

          {activeView === 'devices' && (
            <div className="h-full overflow-y-auto p-4 md:p-6 w-full">
              <div className="w-full">
                <DeviceList
                  devices={devices}
                  unregisteredDevices={unregisteredDevices}
                  selectedDevice={selectedDevice}
                  onDeviceSelect={handleDeviceSelect}
                  onDeviceCreate={handleDeviceCreate}
                  onDeviceUpdate={handleDeviceUpdate}
                  onDeviceDelete={handleDeviceDelete}
                  loading={devicesLoading}
                  onRefresh={fetchDevices}
                />
              </div>
            </div>
          )}

          {activeView === 'geofences' && (
            <div className="h-full overflow-y-auto p-4 md:p-6 w-full">
              <div className="w-full">
                <GeofenceManagement />
              </div>
            </div>
          )}



          {activeView === 'settings' && (
            <div className="h-full overflow-y-auto p-4 md:p-6 w-full">
              <div className="w-full max-w-2xl space-y-6">
                <h1 className="text-2xl font-bold text-ink dark:text-ink-dark">
                  Settings
                </h1>

                <div className="card">
                  <h2 className="text-base font-semibold text-ink dark:text-ink-dark mb-1">
                    Appearance
                  </h2>
                  <p className="text-sm text-muted dark:text-muted-dark mb-4">
                    Choose how Vsmart Tracking looks on this device.
                  </p>
                  <div className="flex gap-3">
                    {[
                      { id: 'light', label: 'Light' },
                      { id: 'dark', label: 'Dark' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setTheme(opt.id)}
                        className={
                          theme === opt.id
                            ? 'flex-1 rounded-xl border-2 border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-400/10 px-4 py-3 text-sm font-semibold text-brand-600 dark:text-brand-300 transition-colors'
                            : 'flex-1 rounded-xl border border-hairline dark:border-hairline-dark bg-card dark:bg-white/5 px-4 py-3 text-sm font-medium text-muted dark:text-muted-dark hover:bg-surface dark:hover:bg-white/10 transition-colors'
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h2 className="text-base font-semibold text-ink dark:text-ink-dark mb-4">
                    AWS Configuration
                  </h2>
                  <div className="space-y-4 text-sm">
                    <div>
                      <label className="block text-muted dark:text-muted-dark font-medium mb-1.5">
                        Region
                      </label>
                      <input
                        type="text"
                        value={REGION}
                        disabled
                        className="input-field opacity-60 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-muted dark:text-muted-dark font-medium mb-1.5">
                        Tracker Name
                      </label>
                      <input
                        type="text"
                        value="Vsmart-Tracker"
                        disabled
                        className="input-field opacity-60 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-subtle dark:text-subtle-dark text-xs mt-2">
                      To update configuration, edit src/configuration.js
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

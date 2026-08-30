import { useEffect, useRef, useState } from 'react';
import Map, { Marker, Popup, NavigationControl, ScaleControl } from 'react-map-gl/maplibre';
import { MapPin, Navigation2 } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { REGION, MAP, API_KEY } from '../../configuration';
import { useTheme } from '../../hooks/useTheme.js';

export default function MapView({ devices = [], onDeviceClick }) {
  const { theme } = useTheme();
  const mapRef = useRef();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: 105.804817,
    latitude: 21.028511,
    zoom: 12
  });

  // Fit bounds to show all devices
  useEffect(() => {
    if (devices.length > 0 && mapRef.current) {
      const bounds = devices.reduce(
        (acc, device) => {
          return {
            minLng: Math.min(acc.minLng, device.position[0]),
            maxLng: Math.max(acc.maxLng, device.position[0]),
            minLat: Math.min(acc.minLat, device.position[1]),
            maxLat: Math.max(acc.maxLat, device.position[1]),
          };
        },
        {
          minLng: devices[0].position[0],
          maxLng: devices[0].position[0],
          minLat: devices[0].position[1],
          maxLat: devices[0].position[1],
        }
      );

      mapRef.current.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding: 100, duration: 1000 }
      );
    }
  }, [devices]);

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={`https://maps.geo.${REGION}.amazonaws.com/v2/styles/${MAP.STYLE}/descriptor?key=${API_KEY}&color-scheme=${theme === 'dark' ? 'Dark' : 'Light'}`}
        style={{ width: '100%', height: '100%' }}
        validateStyle={false}
      >
        {/* Navigation Controls */}
        <NavigationControl position="top-right" />
        <ScaleControl position="bottom-right" />

        {/* Device Markers */}
        {devices.map((device) => (
          <Marker
            key={device.deviceId}
            longitude={device.position[0]}
            latitude={device.position[1]}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedDevice(device);
              onDeviceClick?.(device);
            }}
          >
            <div className="relative cursor-pointer group">
              <div className="absolute -inset-2 bg-brand-500 dark:bg-brand-400 opacity-20 rounded-full animate-ping"></div>
              <div className="relative bg-brand-500 dark:bg-brand-400 text-white dark:text-[#16161b] p-2 rounded-full shadow-panel dark:shadow-panel-dark group-hover:scale-110 transition-transform">
                <Navigation2 className="w-5 h-5" />
              </div>
            </div>
          </Marker>
        ))}

        {/* Selected Device Popup */}
        {selectedDevice && (
          <Popup
            longitude={selectedDevice.position[0]}
            latitude={selectedDevice.position[1]}
            anchor="top"
            onClose={() => setSelectedDevice(null)}
            closeButton={true}
            closeOnClick={false}
            className="device-popup"
          >
            <div className="p-2 min-w-[200px]">
              <h3 className="font-semibold text-ink dark:text-ink-dark mb-2 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-brand-500 dark:text-brand-400" />
                {selectedDevice.deviceId}
              </h3>
              <div className="space-y-1 text-sm text-muted dark:text-muted-dark">
                <p>
                  <span className="font-medium text-ink dark:text-ink-dark">Position:</span>{' '}
                  {selectedDevice.position[1].toFixed(6)}, {selectedDevice.position[0].toFixed(6)}
                </p>
                {selectedDevice.accuracy && (
                  <p>
                    <span className="font-medium text-ink dark:text-ink-dark">Accuracy:</span>{' '}
                    {selectedDevice.accuracy.Horizontal}m
                  </p>
                )}
                {selectedDevice.sampleTime && (
                  <p>
                    <span className="font-medium text-ink dark:text-ink-dark">Last Update:</span>{' '}
                    {new Date(selectedDevice.sampleTime).toLocaleString()}
                  </p>
                )}
                {selectedDevice.properties && Object.keys(selectedDevice.properties).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-hairline dark:border-hairline-dark">
                    <p className="font-medium mb-1 text-ink dark:text-ink-dark">Properties:</p>
                    {Object.entries(selectedDevice.properties).map(([key, value]) => (
                      <p key={key} className="text-xs">
                        {key}: {value}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Popup>
        )}

        {/* Geofence Layers */}
        {/* TODO: Add geofence polygons rendering */}
      </Map>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-card dark:bg-card-dark border border-hairline dark:border-hairline-dark rounded-lg shadow-panel dark:shadow-panel-dark p-4 max-w-xs">
        <h4 className="font-semibold text-ink dark:text-ink-dark mb-2">Legend</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-brand-500 dark:bg-brand-400 rounded-full"></div>
            <span className="text-muted dark:text-muted-dark">Active Device</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
            <span className="text-muted dark:text-muted-dark">Geofence Zone</span>
          </div>
        </div>
      </div>
    </div>
  );
}

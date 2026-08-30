import { useEffect, useState, useCallback, useRef } from "react";
import { useMap, Source, Layer } from "react-map-gl/maplibre";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";
import { geofenceApi } from "../../api/deviceApi";
import GeofencesPanel from "./GeofencesPanel";
import DrawControl from "./DrawControl";
import DrawnGeofences from "./DrawnGeofences";
import { X, CircleDot } from "lucide-react";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// ─── Draw instance ────────────────────────────────────────────────────────

const draw = new MapboxDraw({
  displayControlsDefault: false,
  defaultMode: "simple_select",
  styles: [
    {
      id: "gl-draw-line",
      type: "line",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#6664d8", "line-width": 2 },
    },
    {
      id: "gl-draw-polygon-fill",
      type: "fill",
      paint: { "fill-color": "#6664d8", "fill-opacity": 0.18 },
    },
    {
      id: "gl-draw-point",
      type: "circle",
      paint: { "circle-radius": 6, "circle-color": "#6664d8" },
    },
  ],
});

// ─── Helpers ──────────────────────────────────────────────────────────────

const convertCounterClockwise = (vertices) => {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }
  return area / 2 > 0 ? vertices : vertices.reverse();
};

const callPutGeofenceCommand = async (polygon, geofenceId) => {
  try {
    const id = geofenceId || "Geofence-" + Date.now();
    return await geofenceApi.put(id, polygon);
  } catch (error) {
    if (error.name === "ConflictException") {
      console.log(`Geofence ${geofenceId} already exists. Skipping.`);
      return null;
    }
    throw error;
  }
};

/**
 * Build a circle GeoJSON polygon via turf.
 * @param {[number,number]} center [lng, lat]
 * @param {number}          radiusM radius in metres
 */
const buildCirclePolygon = (center, radiusM) => {
  const circle = turf.circle(center, radiusM / 1000, {
    steps: 64,
    units: "kilometers",
  });
  return circle.geometry.coordinates[0]; // array of [lng, lat]
};

// ─── GeofencesLayer ───────────────────────────────────────────────────────

const CIRCLE_STEPS = {
  IDLE: "idle",
  CENTER: "center",  // waiting for user to click center
  RADIUS: "radius",  // center selected, adjusting radius
  SAVING: "saving",
};

const GeofencesLayer = ({
  isOpenedPanel,
  onPanelChange,
  isDrawing,
  onDrawingChange,
  breachingGeofences,
}) => {
  const { current: map } = useMap();

  // Polygon mode state
  const [geofences, setGeofences] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [geofencesVisible, setGeofencesVisible] = useState(true);
  const [isAddingGeofence, setIsAddingGeofence] = useState(false);
  const [totalGeofences, setTotalGeofences] = useState();
  const [isGeofenceCompletable, setIsGeofenceCompletable] = useState(false);
  const [drawnPolygon, setDrawnPolygon] = useState(null);
  const [drawInstance, setDrawInstance] = useState(null);

  // Circle mode state
  const [circleStep, setCircleStep] = useState(CIRCLE_STEPS.IDLE);
  const [circleCenter, setCircleCenter] = useState(null); // [lng, lat]
  const [circleRadiusM, setCircleRadiusM] = useState(500);  // metres
  const [circleGeoJSON, setCircleGeoJSON] = useState(null); // preview GeoJSON

  // Keep radius in a ref so the map click handler always has the latest value
  const circleRadiusRef = useRef(circleRadiusM);
  useEffect(() => { circleRadiusRef.current = circleRadiusM; }, [circleRadiusM]);

  const exitCircleMode = useCallback(() => {
    setCircleStep(CIRCLE_STEPS.IDLE);
    setCircleCenter(null);
    setCircleGeoJSON(null);
    if (map) map.getCanvas().style.cursor = "";
  }, [map]);

  // ── Fetch geofences ────────────────────────────────────────────────────

  const fetchGeofences = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await geofenceApi.list();
      setTotalGeofences(res.Entries.length);
      setGeofences(res.Entries.reverse().slice(0, 10));
    } catch (err) {
      console.error("Error fetching geofences:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  useEffect(() => {
    if (isOpenedPanel) {
      fetchGeofences();
    } else {
      onDrawingChange(false);
      setIsGeofenceCompletable(false);
      exitCircleMode();
    }
  }, [exitCircleMode, fetchGeofences, isOpenedPanel, onDrawingChange]);

  // Polygon draw mode sync
  useEffect(() => {
    if (draw) {
      draw.changeMode(isDrawing ? "draw_polygon" : "simple_select");
    }
  }, [isDrawing]);

  // ── Circle mode — map click handler ────────────────────────────────────

  useEffect(() => {
    if (!map || circleStep !== CIRCLE_STEPS.CENTER) return;

    const handleMapClick = (e) => {
      const center = [e.lngLat.lng, e.lngLat.lat];
      setCircleCenter(center);
      setCircleStep(CIRCLE_STEPS.RADIUS);

      // Build initial preview
      const coords = buildCirclePolygon(center, circleRadiusRef.current);
      setCircleGeoJSON({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
      });
    };

    map.on("click", handleMapClick);
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      map.off("click", handleMapClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, circleStep]);

  // Live-update circle preview when radius changes
  useEffect(() => {
    if (circleCenter && circleStep === CIRCLE_STEPS.RADIUS) {
      const coords = buildCirclePolygon(circleCenter, circleRadiusM);
      setCircleGeoJSON({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
      });
    }
  }, [circleCenter, circleRadiusM, circleStep]);

  // ── Circle mode helpers ────────────────────────────────────────────────

  const enterCircleMode = () => {
    // Make sure polygon mode is off
    onDrawingChange(false);
    if (draw) draw.changeMode("simple_select");
    setDrawnPolygon(null);

    setCircleStep(CIRCLE_STEPS.CENTER);
    setCircleCenter(null);
    setCircleRadiusM(500);
    setCircleGeoJSON(null);
  };

  // ── Polygon mode handlers ──────────────────────────────────────────────

  const handleDeleteGeofences = async (ids) => {
    if (ids.length > 0) {
      await geofenceApi.delete(ids);
      fetchGeofences();
    }
  };

  const handleCreate = useCallback(
    (e) => {
      if (e.features?.length > 0) {
        const polygon = convertCounterClockwise(
          e.features[0].geometry.coordinates[0]
        );
        setDrawnPolygon(polygon);
        setIsGeofenceCompletable(false);
        setTimeout(() => onDrawingChange(false), 100);
      }
    },
    [onDrawingChange]
  );

  const handleSavePolygonGeofence = async () => {
    if (!drawnPolygon) return;
    setIsAddingGeofence(true);
    try {
      const result = await callPutGeofenceCommand(drawnPolygon);
      if (result?.CreateTime) {
        await fetchGeofences();
        draw.deleteAll();
        setDrawnPolygon(null);
        onDrawingChange(false);
        alert("Geofence saved successfully!");
      } else {
        alert("There was an error saving the geofence. Please try again.");
      }
    } catch (err) {
      console.error("Error saving geofence:", err);
      alert(`Error saving geofence: ${err.message}`);
    } finally {
      setIsAddingGeofence(false);
    }
  };

  const handleCancelPolygonDrawing = () => {
    try {
      const d = drawInstance || draw;
      if (d && typeof d.getAll === "function") {
        const features = d.getAll();
        if (features?.features?.length > 0) {
          const f = features.features[0];
          if (
            f.geometry.type === "Polygon" &&
            f.geometry.coordinates[0].length >= 4
          ) {
            const polygon = convertCounterClockwise(f.geometry.coordinates[0]);
            setDrawnPolygon(polygon);
            onDrawingChange(false);
            setIsGeofenceCompletable(false);
            return;
          }
        }
        d.deleteAll();
      }
    } catch (err) {
      console.error("Error in handleCancelPolygonDrawing:", err);
    }
    setDrawnPolygon(null);
    onDrawingChange(false);
    setIsGeofenceCompletable(false);
  };

  const handleModeChange = useCallback(
    (e) => {
      if (e.mode === "simple_select") {
        onDrawingChange(false);
        setIsGeofenceCompletable(false);
      }
    },
    [onDrawingChange]
  );

  // ── Save circle geofence ───────────────────────────────────────────────

  const handleSaveCircleGeofence = async () => {
    if (!circleCenter) return;
    setCircleStep(CIRCLE_STEPS.SAVING);
    try {
      const polygon = buildCirclePolygon(circleCenter, circleRadiusM);
      const ccw = convertCounterClockwise(polygon);
      const result = await callPutGeofenceCommand(ccw);
      if (result?.CreateTime) {
        await fetchGeofences();
        exitCircleMode();
        alert("Circle geofence saved successfully!");
      } else {
        setCircleStep(CIRCLE_STEPS.RADIUS);
        alert("There was an error saving the geofence. Please try again.");
      }
    } catch (err) {
      console.error("Error saving circle geofence:", err);
      setCircleStep(CIRCLE_STEPS.RADIUS);
      alert(`Error saving geofence: ${err.message}`);
    }
  };

  // ── Radius label helper ────────────────────────────────────────────────

  const formatRadius = (m) =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Geofences panel */}
      {isOpenedPanel && (
        <GeofencesPanel
          onClose={() => onPanelChange()}
          geofences={geofences}
          onDeleteGeofences={handleDeleteGeofences}
          onAddPolygonGeofence={() => onDrawingChange(true)}
          onAddCircleGeofence={enterCircleMode}
          isLoading={isLoading}
          geofencesVisible={geofencesVisible}
          onToggleGeofences={() => setGeofencesVisible((p) => !p)}
          totalGeofences={totalGeofences}
        />
      )}

      {/* mapbox-gl-draw control */}
      <DrawControl
        draw={draw}
        onCreate={handleCreate}
        onModeChange={handleModeChange}
        onGeofenceCompletable={(c) => setIsGeofenceCompletable(c)}
        onDrawReady={setDrawInstance}
      />

      {/* ── Polygon drawing UI ── */}
      {isDrawing && !drawnPolygon && (
        <div className="absolute top-16 left-4 right-4 sm:top-4 sm:right-4 sm:left-auto sm:w-80 bg-card/95 dark:bg-card-dark/95 backdrop-blur-md rounded-2xl shadow-panel-lg dark:shadow-panel-lg-dark border border-hairline dark:border-hairline-dark p-4 z-50">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold text-ink dark:text-ink-dark text-sm">Draw Polygon Geofence</h3>
            <button onClick={handleCancelPolygonDrawing} className="text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-xs text-muted dark:text-muted-dark space-y-2 font-medium">
            {isGeofenceCompletable ? (
              <>
                <p className="font-semibold text-brand-600 dark:text-brand-400">Almost done!</p>
                <p>Click the <strong>first point</strong> (indigo dot) to close the shape.</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-ink dark:text-ink-dark">How to draw:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click on the map to add points</li>
                  <li>Add at least 3 points</li>
                  <li>Click the first point to close the shape</li>
                  <li>Then click Save</li>
                </ol>
              </>
            )}
          </div>
          <button onClick={handleCancelPolygonDrawing} className="mt-4 w-full btn-secondary text-xs font-bold py-2 rounded-xl">
            Cancel
          </button>
        </div>
      )}

      {/* Polygon ready to save */}
      {drawnPolygon && !isAddingGeofence && (
        <div className="absolute top-16 left-4 right-4 sm:top-4 sm:right-4 sm:left-auto sm:w-80 bg-card/95 dark:bg-card-dark/95 backdrop-blur-md rounded-2xl shadow-panel-lg dark:shadow-panel-lg-dark border border-hairline dark:border-hairline-dark p-4 z-50">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold text-ink dark:text-ink-dark text-sm">Polygon Geofence Ready</h3>
            <button onClick={handleCancelPolygonDrawing} className="text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">✓ Polygon drawn successfully!</p>
          <p className="text-xs text-subtle dark:text-subtle-dark font-medium mb-4">
            Click "Save" to submit to AWS or "Discard" to start over.
          </p>
          <div className="space-y-2">
            <button onClick={handleSavePolygonGeofence} className="w-full btn-primary flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold">
              <span>Save Geofence</span>
            </button>
            <button onClick={handleCancelPolygonDrawing} className="w-full btn-secondary text-xs font-bold py-2 rounded-xl">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Polygon saving spinner */}
      {isAddingGeofence && (
        <div className="absolute top-16 left-4 right-4 sm:top-4 sm:right-4 sm:left-auto sm:w-80 bg-card/95 dark:bg-card-dark/95 backdrop-blur-md rounded-2xl shadow-panel-lg dark:shadow-panel-lg-dark border border-hairline dark:border-hairline-dark p-4 z-50">
          <h3 className="font-bold text-ink dark:text-ink-dark text-sm mb-3">Saving Geofence...</h3>
          <div className="flex items-center space-x-2 text-xs font-semibold text-muted dark:text-muted-dark">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-500 dark:border-brand-400"></div>
            <p>Saving to AWS Location Service...</p>
          </div>
        </div>
      )}

      {/* ── Circle drawing UI — step: CENTER ── */}
      {circleStep === CIRCLE_STEPS.CENTER && (
        <div className="absolute top-16 left-4 right-4 sm:top-4 sm:right-4 sm:left-auto sm:w-80 bg-card/95 dark:bg-card-dark/95 backdrop-blur-md rounded-2xl shadow-panel-lg dark:shadow-panel-lg-dark border border-hairline dark:border-hairline-dark p-4 z-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <CircleDot className="w-5 h-5 text-brand-500 dark:text-brand-400" />
              <h3 className="font-bold text-ink dark:text-ink-dark text-sm">Draw Circle Geofence</h3>
            </div>
            <button onClick={exitCircleMode} className="text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-xs text-muted dark:text-muted-dark space-y-2 font-medium">
            <p className="font-semibold text-brand-600 dark:text-brand-400 animate-pulse">Click on the map to set the center point</p>
            <p className="text-xs text-subtle dark:text-subtle-dark">
              The cursor will change to a crosshair. Click anywhere on the map to place the center of the circle.
            </p>
          </div>
          <button onClick={exitCircleMode} className="mt-4 w-full btn-secondary text-xs font-bold py-2 rounded-xl">
            Cancel
          </button>
        </div>
      )}

      {/* ── Circle drawing UI — step: RADIUS ── */}
      {circleStep === CIRCLE_STEPS.RADIUS && (
        <div className="absolute top-16 left-4 right-4 sm:top-4 sm:right-4 sm:left-auto sm:w-80 bg-card/95 dark:bg-card-dark/95 backdrop-blur-md rounded-2xl shadow-panel-lg dark:shadow-panel-lg-dark border border-hairline dark:border-hairline-dark p-4 z-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <CircleDot className="w-5 h-5 text-brand-500 dark:text-brand-400" />
              <h3 className="font-bold text-ink dark:text-ink-dark text-sm">Adjust Radius</h3>
            </div>
            <button onClick={exitCircleMode} className="text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Center coords */}
          <div className="bg-surface dark:bg-white/5 rounded-xl p-2.5 mb-4 text-[10px] text-muted dark:text-muted-dark font-mono font-semibold">
            Center: {circleCenter?.[1].toFixed(5)}, {circleCenter?.[0].toFixed(5)}
          </div>

          {/* Radius label */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted dark:text-muted-dark">Radius</span>
            <span className="text-xs font-extrabold text-brand-600 dark:text-brand-400">{formatRadius(circleRadiusM)}</span>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={100}
            max={50000}
            step={100}
            value={circleRadiusM}
            onChange={(e) => setCircleRadiusM(Number(e.target.value))}
            className="w-full h-2 bg-card-muted dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-500 dark:accent-brand-400 mb-3"
          />

          {/* Preset buttons */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {[250, 500, 1000, 2000, 5000].map((m) => (
              <button
                key={m}
                onClick={() => setCircleRadiusM(m)}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors font-bold ${circleRadiusM === m
                  ? "bg-brand-500 dark:bg-brand-400 text-white dark:text-[#16161b] border-brand-500 dark:border-brand-400"
                  : "bg-card dark:bg-card-dark text-muted dark:text-muted-dark border-hairline dark:border-hairline-dark hover:border-brand-500 dark:hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400"
                  }`}
              >
                {formatRadius(m)}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="number"
              min={100}
              max={50000}
              step={100}
              value={circleRadiusM}
              onChange={(e) => setCircleRadiusM(Math.max(100, Math.min(50000, Number(e.target.value))))}
              className="input-field flex-1 !py-1.5 text-xs"
            />
            <span className="text-xs text-muted dark:text-muted-dark font-semibold">metres</span>
          </div>

          <div className="space-y-2">
            <button onClick={handleSaveCircleGeofence} className="w-full btn-primary flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold">
              <CircleDot className="w-4 h-4" />
              <span>Save Circle Geofence</span>
            </button>
            <button onClick={exitCircleMode} className="w-full btn-secondary text-xs font-bold py-2 rounded-xl">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Circle saving spinner ── */}
      {circleStep === CIRCLE_STEPS.SAVING && (
        <div className="absolute top-16 left-4 right-4 sm:top-4 sm:right-4 sm:left-auto sm:w-80 bg-card/95 dark:bg-card-dark/95 backdrop-blur-md rounded-2xl shadow-panel-lg dark:shadow-panel-lg-dark border border-hairline dark:border-hairline-dark p-4 z-50">
          <h3 className="font-bold text-ink dark:text-ink-dark text-sm mb-3">Saving Circle Geofence...</h3>
          <div className="flex items-center space-x-2 text-xs font-semibold text-muted dark:text-muted-dark">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-500 dark:border-brand-400"></div>
            <p>Saving to AWS Location Service...</p>
          </div>
        </div>
      )}

      {/* ── Circle preview on map ── */}
      {circleGeoJSON && (
        <Source id="circle-preview" type="geojson" data={circleGeoJSON}>
          <Layer
            id="circle-preview-fill"
            type="fill"
            paint={{ "fill-color": "#3B82F6", "fill-opacity": 0.15 }}
          />
          <Layer
            id="circle-preview-outline"
            type="line"
            paint={{ "line-color": "#3B82F6", "line-width": 2, "line-dasharray": [4, 2] }}
          />
        </Source>
      )}

      {/* Saved geofences on map */}
      <DrawnGeofences
        geofences={geofences}
        breachingGeofences={breachingGeofences}
        geofencesVisible={geofencesVisible}
      />
    </>
  );
};

export default GeofencesLayer;

import { useCallback } from "react";
import { useControl } from "react-map-gl/maplibre";

// Geofence drawing control using mapbox-gl-draw
const DrawControl = ({
  draw,
  onCreate,
  onModeChange,
  onGeofenceCompletable,
  onDrawReady,
}) => {
  const onRender = () => {
    //mapbox-gl-draw initiates control with two items
    if (!draw) return;

    try {
      const featureCollection = draw.getAll();
      if (
        featureCollection &&
        featureCollection.features &&
        featureCollection.features.length > 0 &&
        featureCollection.features[0].geometry.coordinates[0].length > 2
      ) {
        onGeofenceCompletable(true);
      }
    } catch (error) {
      console.error('Error in onRender:', error);
    }
  };

  // This is needed because the bundler is not making the passed
  // function available to the mapbox-gl-draw library.
  const drawCreate = useCallback((e) => onCreate(e), [onCreate]);
  const drawModeChange = useCallback((e) => onModeChange(e), [onModeChange]);

  useControl(
    ({ map }) => {
      map.on("draw.create", drawCreate);
      map.on("draw.modechange", drawModeChange);
      map.on("draw.render", onRender);

      // Notify parent that draw is ready - use setTimeout to avoid state updates during render
      if (onDrawReady) {
        setTimeout(() => onDrawReady(draw), 0);
      }

      return draw;
    },
    ({ map }) => {
      map.off("draw.create", drawCreate);
      map.off("draw.modechange", drawModeChange);
      map.off("draw.render", onRender);
    }
  );

  return null;
};

export default DrawControl;

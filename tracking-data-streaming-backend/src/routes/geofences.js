const express = require('express');
const geofenceController = require('../controllers/geofenceController');

const router = express.Router();

router.get('/', geofenceController.listGeofences);
router.put('/:id', (req, res, next) => {
    req.body = { ...req.body, geofenceId: req.params.id };
    return geofenceController.putGeofence(req, res, next);
});
router.delete('/', geofenceController.deleteGeofences);

module.exports = router;

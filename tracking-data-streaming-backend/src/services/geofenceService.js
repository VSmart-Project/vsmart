const {
    BatchDeleteGeofenceCommand,
    GetGeofenceCommand,
    PutGeofenceCommand,
    paginateListGeofences,
} = require('@aws-sdk/client-location');
const { locationClient } = require('../config/aws');
const { GEOFENCE } = require('../config/constants');

const OWNER_PROPERTY = 'ownerUserId';

const listGeofencesForOwner = async (ownerUserId) => {
    const entries = [];
    const paginator = paginateListGeofences({ client: locationClient }, {
        CollectionName: GEOFENCE,
    });
    for await (const page of paginator) {
        entries.push(...(page.Entries || []).filter(
            (entry) => entry.GeofenceProperties?.[OWNER_PROPERTY] === ownerUserId
        ));
    }
    return entries;
};

const getGeofence = async (geofenceId) => {
    try {
        return await locationClient.send(new GetGeofenceCommand({
            CollectionName: GEOFENCE,
            GeofenceId: geofenceId,
        }));
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') return null;
        throw error;
    }
};

const putGeofenceForOwner = async (ownerUserId, geofenceId, geometry) => {
    const existing = await getGeofence(geofenceId);
    if (existing && existing.GeofenceProperties?.[OWNER_PROPERTY] !== ownerUserId) {
        const error = new Error('Forbidden: You do not own this geofence');
        error.statusCode = 403;
        error.userMessage = error.message;
        throw error;
    }

    return locationClient.send(new PutGeofenceCommand({
        CollectionName: GEOFENCE,
        GeofenceId: geofenceId,
        Geometry: geometry,
        GeofenceProperties: {
            ...(existing?.GeofenceProperties || {}),
            [OWNER_PROPERTY]: ownerUserId,
        },
    }));
};

const deleteGeofencesForOwner = async (ownerUserId, geofenceIds) => {
    const geofences = await Promise.all(geofenceIds.map(getGeofence));
    const forbidden = geofences.find(
        (entry) => entry && entry.GeofenceProperties?.[OWNER_PROPERTY] !== ownerUserId
    );
    if (forbidden) {
        const error = new Error('Forbidden: You do not own this geofence');
        error.statusCode = 403;
        error.userMessage = error.message;
        throw error;
    }

    const ownedIds = geofenceIds.filter((_, index) => geofences[index]);
    if (!ownedIds.length) return { Errors: [] };

    return locationClient.send(new BatchDeleteGeofenceCommand({
        CollectionName: GEOFENCE,
        GeofenceIds: ownedIds,
    }));
};

module.exports = {
    deleteGeofencesForOwner,
    getGeofence,
    listGeofencesForOwner,
    putGeofenceForOwner,
};

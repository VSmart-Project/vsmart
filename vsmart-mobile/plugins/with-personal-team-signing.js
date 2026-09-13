const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Personal Apple development teams cannot provision the APNs entitlement.
 * Keep expo-notifications available for local notifications while removing
 * remote push capability from local iOS development builds.
 */
module.exports = function withPersonalTeamSigning(config) {
    return withEntitlementsPlist(config, (configWithEntitlements) => {
        delete configWithEntitlements.modResults['aps-environment'];
        return configWithEntitlements;
    });
};

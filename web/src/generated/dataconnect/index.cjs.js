const { queryRef, executeQuery, validateArgsWithOptions, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'vetted',
  service: 'vetted',
  location: 'us-west1'
};
exports.connectorConfig = connectorConfig;

const listSyntheticDemoProfilesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSyntheticDemoProfiles');
}
listSyntheticDemoProfilesRef.operationName = 'ListSyntheticDemoProfiles';
exports.listSyntheticDemoProfilesRef = listSyntheticDemoProfilesRef;

exports.listSyntheticDemoProfiles = function listSyntheticDemoProfiles(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listSyntheticDemoProfilesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

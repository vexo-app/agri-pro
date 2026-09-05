// src/config/constants.js
// Thin re-export barrel. All the actual constant groups were split by
// domain into ./constants/* for readability — this file only re-exports
// them so every existing `import ... from "../config/constants"` (or any
// relative path to this file) keeps working unchanged.

export * from "./constants/admin";
export * from "./constants/collections";
export * from "./constants/backup";
export * from "./constants/equipment";
export * from "./constants/workTypes";
export * from "./constants/maintenance";
export * from "./constants/payments";
export * from "./constants/team";
export * from "./constants/driverCosts";
export * from "./constants/notifications";
export * from "./constants/misc";
export * from "./constants/salary";
export * from "./constants/taxDeductions";
export * from "./constants/custody";

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaptureError = exports.SyncError = exports.StorageError = exports.VSCodeExtensionError = void 0;
// Error types
class VSCodeExtensionError extends Error {
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'VSCodeExtensionError';
    }
}
exports.VSCodeExtensionError = VSCodeExtensionError;
class StorageError extends VSCodeExtensionError {
    constructor(message, context) {
        super(message, 'STORAGE_ERROR', context);
    }
}
exports.StorageError = StorageError;
class SyncError extends VSCodeExtensionError {
    constructor(message, context) {
        super(message, 'SYNC_ERROR', context);
    }
}
exports.SyncError = SyncError;
class CaptureError extends VSCodeExtensionError {
    constructor(message, context) {
        super(message, 'CAPTURE_ERROR', context);
    }
}
exports.CaptureError = CaptureError;
//# sourceMappingURL=types.js.map
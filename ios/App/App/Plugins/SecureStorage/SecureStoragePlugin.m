#import <Capacitor/Capacitor.h>

CAP_PLUGIN(SecureStoragePlugin, "SecureStorage",
    CAP_PLUGIN_METHOD(encryptString, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(decryptString, CAPPluginReturnPromise);
)

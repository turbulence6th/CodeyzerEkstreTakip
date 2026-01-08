#import <Capacitor/Capacitor.h>

CAP_PLUGIN(SmsReaderPlugin, "SmsReader",
    CAP_PLUGIN_METHOD(checkPermissions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getMessages, CAPPluginReturnPromise);
)

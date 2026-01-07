#import <Capacitor/Capacitor.h>

CAP_PLUGIN(GoogleAuthPlugin, "GoogleAuth",
    CAP_PLUGIN_METHOD(signIn, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(trySilentSignIn, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(signOut, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createCalendarEvent, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(searchCalendarEvents, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(searchGmailMessages, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getGmailMessageDetails, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getGmailAttachment, CAPPluginReturnPromise);
)

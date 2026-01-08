#import <Capacitor/Capacitor.h>

CAP_PLUGIN(OcrPlugin, "Ocr",
    CAP_PLUGIN_METHOD(recognizeText, CAPPluginReturnPromise);
)

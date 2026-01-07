#import <Capacitor/Capacitor.h>

CAP_PLUGIN(PdfParserPlugin, "PdfParser",
    CAP_PLUGIN_METHOD(parsePdfText, CAPPluginReturnPromise);
)
